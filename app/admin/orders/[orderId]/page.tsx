"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, use } from "react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  writeBatch,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  AccountDoc,
  GuitarDoc,
  OrderAddRequestDoc,
  OrderDoc,
  OrderLineDoc,
  OrderRemoveRequestDoc,
  OrderStatus,
  PricesDoc,
} from "@/lib/types";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";
import Link from "next/link";
import { 
  ArrowLeftIcon,
  DocumentArrowUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";

const STATUS_OPTIONS: OrderStatus[] = [
  "SUBMITTED",
  "APPROVED",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

/** Two decimal places for unit price inputs and Firestore (currency). */
function formatUnitPriceForInput(n: number): string {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function roundMoney2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<(OrderDoc & { id: string }) | null>(null);
  const [orderLines, setOrderLines] = useState<Array<OrderLineDoc & { id: string }>>([]);
  const [guitarsMap, setGuitarsMap] = useState<Map<string, GuitarDoc>>(new Map());
  const [pricesMap, setPricesMap] = useState<Map<string, PricesDoc>>(new Map());
  const [orderAccount, setOrderAccount] = useState<(AccountDoc & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addRequests, setAddRequests] = useState<
    Array<OrderAddRequestDoc & { id: string }>
  >([]);
  const [removeRequests, setRemoveRequests] = useState<
    Array<OrderRemoveRequestDoc & { id: string }>
  >([]);

  const [accounts, setAccounts] = useState<
    Array<{ id: string; name?: string; discountPercent?: number }>
  >([]);
  const [targetAccountId, setTargetAccountId] = useState<string>("");
  const [movingOrder, setMovingOrder] = useState(false);
  
  // Form states
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [etaDate, setEtaDate] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [approvingRevision, setApprovingRevision] = useState(false);
  const [updatingEta, setUpdatingEta] = useState(false);
  const [recalculatingPrices, setRecalculatingPrices] = useState(false);

  /** Inline line edits (qty / unit price) before “Submit proposed changes to dealer”. */
  const [lineDrafts, setLineDrafts] = useState<
    Record<string, { qty: string; unitPrice: string }>
  >({});
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const [adminProposeNote, setAdminProposeNote] = useState("");
  const [submittingProposedChanges, setSubmittingProposedChanges] = useState(false);

  useEffect(() => {
    const next: Record<string, { qty: string; unitPrice: string }> = {};
    for (const l of orderLines) {
      next[l.id] = {
        qty: String(l.qty),
        unitPrice: formatUnitPriceForInput(l.unitPrice),
      };
    }
    setLineDrafts(next);
  }, [orderLines]);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const accountsSnap = await getDocs(collection(db, "accounts"));
        setAccounts(
          accountsSnap.docs.map((doc) => {
            const data = doc.data() as AccountDoc;
            return {
              id: doc.id,
              name: data?.name,
              discountPercent: data?.discountPercent,
            };
          }),
        );
      } catch (err) {
        console.error("Error fetching accounts:", err);
      }
    }

    fetchAccounts();
  }, []);

  useEffect(() => {
    if (!order) return;
    if (targetAccountId) return;

    const preferredId = "acct_zjon-guitar-store";
    const preferredExists = accounts.some((a) => a.id === preferredId);
    setTargetAccountId(preferredExists ? preferredId : order.accountId);
  }, [order, accounts, targetAccountId]);

  async function fetchOrder() {
    setLoading(true);
    setError(null);
    try {
      const orderDoc = await getDoc(doc(db, "orders", orderId));
      if (!orderDoc.exists()) {
        setError("Order not found");
        setLoading(false);
        return;
      }

      const orderDataRaw = orderDoc.data();
      const orderData = {
        id: orderDoc.id,
        ...orderDataRaw,
        createdAt: orderDataRaw.createdAt instanceof Timestamp
          ? orderDataRaw.createdAt.toDate().toISOString()
          : orderDataRaw.createdAt,
        updatedAt: orderDataRaw.updatedAt instanceof Timestamp
          ? orderDataRaw.updatedAt.toDate().toISOString()
          : orderDataRaw.updatedAt,
        invoiceUrl: orderDataRaw.invoiceUrl || null,
        etaDate: orderDataRaw.etaDate || null,
      } as OrderDoc & { id: string; invoiceUrl?: string | null; etaDate?: string | null };

      setOrder(orderData);
      setInvoiceUrl(orderData.invoiceUrl || null);
      setEtaDate(orderData.etaDate || "");

      // Fetch order lines
      const linesRef = collection(db, "orders", orderId, "lines");
      const linesSnap = await getDocs(linesRef);
      const linesData = linesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<OrderLineDoc & { id: string }>;
      setOrderLines(linesData);

      // Fetch guitar data for all unique guitars in order lines
      const uniqueGuitarIds = Array.from(
        new Set(linesData.map((line) => line.guitarId)),
      );
      const guitars = new Map<string, GuitarDoc>();
      const prices = new Map<string, PricesDoc>();
      for (const guitarId of uniqueGuitarIds) {
        const [guitarSnap, priceSnap] = await Promise.all([
          getDoc(doc(db, "guitars", guitarId)),
          getDoc(doc(db, "prices", guitarId)),
        ]);
        if (guitarSnap.exists()) {
          guitars.set(guitarId, guitarSnap.data() as GuitarDoc);
        }
        if (priceSnap.exists()) {
          prices.set(guitarId, priceSnap.data() as PricesDoc);
        }
      }
      setGuitarsMap(guitars);
      setPricesMap(prices);

      const accountSnap = await getDoc(doc(db, "accounts", orderData.accountId));
      if (accountSnap.exists()) {
        setOrderAccount({ id: accountSnap.id, ...accountSnap.data() } as AccountDoc & { id: string });
      } else {
        setOrderAccount(null);
      }

      const [addReqSnap, removeReqSnap] = await Promise.all([
        getDocs(collection(db, "orders", orderId, "addRequests")),
        getDocs(collection(db, "orders", orderId, "removeRequests")),
      ]);

      setAddRequests(
        addReqSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as OrderAddRequestDoc),
        })),
      );
      setRemoveRequests(
        removeReqSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as OrderRemoveRequestDoc),
        })),
      );
    } catch (err) {
      console.error(err);
      setError("Unable to load order");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvoiceUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceFile || !order) return;

    setUploadingInvoice(true);
    try {
      const invoiceRef = ref(storage, `invoices/${orderId}/${invoiceFile.name}`);
      await uploadBytes(invoiceRef, invoiceFile);
      const url = await getDownloadURL(invoiceRef);

      await updateDoc(doc(db, "orders", orderId), {
        invoiceUrl: url,
        invoiceUploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setInvoiceUrl(url);
      setInvoiceFile(null);
      await fetchOrder();
      alert("Invoice uploaded successfully!");
    } catch (err) {
      console.error("Error uploading invoice:", err);
      alert("Failed to upload invoice");
    } finally {
      setUploadingInvoice(false);
    }
  }

  async function handleEtaUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    setUpdatingEta(true);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        etaDate: etaDate || null,
        updatedAt: new Date().toISOString(),
      });
      await fetchOrder();
      alert("ETA updated successfully!");
    } catch (err) {
      console.error("Error updating ETA:", err);
      alert("Failed to update ETA");
    } finally {
      setUpdatingEta(false);
    }
  }

  async function handleStatusUpdate(newStatus: OrderStatus) {
    if (!order) return;

    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      await fetchOrder();
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update order status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleApproveDealerRevision() {
    if (!order || !order.pendingOrmsbyRevisionReview) return;

    setApprovingRevision(true);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        pendingOrmsbyRevisionReview: false,
        revisionReviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await fetchOrder();
      alert('Revision approved — dealer will no longer see "Pending approval" for this update.');
    } catch (err) {
      console.error("Error approving revision:", err);
      alert("Failed to approve revision");
    } finally {
      setApprovingRevision(false);
    }
  }

  async function handleSaveLine(lineId: string) {
    if (!order) return;
    const draft = lineDrafts[lineId];
    if (!draft) return;
    const qty = parseInt(draft.qty, 10);
    const unitPrice = parseFloat(draft.unitPrice);
    if (!Number.isFinite(qty) || qty < 1) {
      alert("Quantity must be a whole number ≥ 1.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      alert("Unit price must be a valid number ≥ 0.");
      return;
    }
    const unitPrice2 = roundMoney2(unitPrice);
    const lineTotal = roundMoney2(qty * unitPrice2);
    const newSubtotal = roundMoney2(
      orderLines.reduce((sum, l) => {
        if (l.id === lineId) return sum + lineTotal;
        return sum + l.lineTotal;
      }, 0),
    );

    setSavingLineId(lineId);
    try {
      await updateDoc(doc(db, "orders", orderId, "lines", lineId), {
        qty,
        unitPrice: unitPrice2,
        lineTotal,
      });
      await updateDoc(doc(db, "orders", orderId), {
        totals: { subtotal: newSubtotal, currency: order.currency },
        updatedAt: new Date().toISOString(),
      });
      await fetchOrder();
    } catch (err) {
      console.error("Error saving line:", err);
      alert("Failed to save line");
    } finally {
      setSavingLineId(null);
    }
  }

  async function handleRemoveLine(lineId: string) {
    if (!order) return;
    if (!window.confirm("Remove this line from the order? This cannot be undone.")) return;

    setRemovingLineId(lineId);
    try {
      const remaining = orderLines.filter((l) => l.id !== lineId);
      const newSubtotal = roundMoney2(
        remaining.reduce((sum, l) => sum + l.lineTotal, 0),
      );
      await deleteDoc(doc(db, "orders", orderId, "lines", lineId));
      await updateDoc(doc(db, "orders", orderId), {
        totals: { subtotal: newSubtotal, currency: order.currency },
        updatedAt: new Date().toISOString(),
      });
      await fetchOrder();
    } catch (err) {
      console.error("Error removing line:", err);
      alert("Failed to remove line");
    } finally {
      setRemovingLineId(null);
    }
  }

  async function handleSubmitProposedChangesToDealer() {
    if (!order || order.status === "DRAFT") return;
    if (order.dealerPendingAdminProposedChanges) {
      alert("This order is already waiting for the dealer to confirm.");
      return;
    }

    setSubmittingProposedChanges(true);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "orders", orderId), {
        pendingOrmsbyRevisionReview: false,
        ...(order.pendingOrmsbyRevisionReview ? { revisionReviewedAt: now } : {}),
        dealerPendingAdminProposedChanges: true,
        adminProposedChangesAt: now,
        adminProposedChangesNote: adminProposeNote.trim() || null,
        updatedAt: now,
      });
      await fetchOrder();
      setAdminProposeNote("");
      alert("Proposed changes sent — the dealer can accept or request changes.");
    } catch (err) {
      console.error("Error submitting proposed changes:", err);
      alert("Failed to submit proposed changes");
    } finally {
      setSubmittingProposedChanges(false);
    }
  }

  async function handleRecalculatePrices() {
    if (!order || orderLines.length === 0) return;

    const discountPercent = orderAccount?.discountPercent ?? 0;

    setRecalculatingPrices(true);
    try {
      let newSubtotal = 0;
      const batch = writeBatch(db);

      for (const line of orderLines) {
        const prices = pricesMap.get(line.guitarId);
        const guitar = guitarsMap.get(line.guitarId);
        const rrp = getRRPForVariant(
          prices ?? null,
          guitar?.options ?? null,
          line.selectedOptions ?? null,
          discountPercent,
        );
        const unitPrice = rrp != null ? getDealerPriceFromRRP(rrp, discountPercent) : 0;
        const lineTotal = unitPrice * line.qty;
        newSubtotal += lineTotal;
        const lineRef = doc(db, "orders", orderId, "lines", line.id);
        batch.update(lineRef, {
          unitPrice,
          lineTotal,
        });
      }

      const orderRef = doc(db, "orders", orderId);
      batch.update(orderRef, {
        totals: { subtotal: newSubtotal, currency: order.currency },
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      await fetchOrder();
      alert("Prices recalculated from guitar pricing.");
    } catch (err) {
      console.error("Error recalculating prices:", err);
      alert("Failed to recalculate prices");
    } finally {
      setRecalculatingPrices(false);
    }
  }

  async function handleMoveOrderToAccount() {
    if (!order || orderLines.length === 0) return;
    if (!targetAccountId) return;
    if (targetAccountId === order.accountId) {
      alert("Order is already assigned to that account.");
      return;
    }

    setMovingOrder(true);
    try {
      const targetAccountSnap = await getDoc(doc(db, "accounts", targetAccountId));
      if (!targetAccountSnap.exists()) {
        alert("Target account not found.");
        return;
      }

      const targetAccount = targetAccountSnap.data() as AccountDoc;
      const discountPercent = targetAccount?.discountPercent ?? 0;

      let newSubtotal = 0;
      const batch = writeBatch(db);

      for (const line of orderLines) {
        const prices = pricesMap.get(line.guitarId);
        const guitar = guitarsMap.get(line.guitarId);
        const rrp = getRRPForVariant(
          prices ?? null,
          guitar?.options ?? null,
          line.selectedOptions ?? null,
          discountPercent,
        );

        const unitPrice = rrp != null ? getDealerPriceFromRRP(rrp, discountPercent) : 0;
        const lineTotal = unitPrice * line.qty;
        newSubtotal += lineTotal;

        batch.update(doc(db, "orders", orderId, "lines", line.id), {
          unitPrice,
          lineTotal,
        });
      }

      batch.update(doc(db, "orders", orderId), {
        accountId: targetAccountId,
        totals: { subtotal: newSubtotal, currency: order.currency },
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      await fetchOrder();
      alert("Order moved successfully.");
    } catch (err) {
      console.error("Error moving order:", err);
      alert("Failed to move order.");
    } finally {
      setMovingOrder(false);
    }
  }

  const [processingRequests, setProcessingRequests] = useState(false);

  async function handleApproveAddRequest(requestId: string) {
    if (!order || processingRequests) return;

    const req = addRequests.find((r) => r.id === requestId);
    if (!req) return;

    setProcessingRequests(true);
    try {
      const orderSnap = await getDoc(doc(db, "orders", orderId));
      if (!orderSnap.exists()) throw new Error("Order not found");

      const discountPercent = orderAccount?.discountPercent ?? 0;

      const [guitarSnap, pricesSnap] = await Promise.all([
        getDoc(doc(db, "guitars", req.guitarId)),
        getDoc(doc(db, "prices", req.guitarId)),
      ]);

      if (!guitarSnap.exists() || !pricesSnap.exists()) {
        throw new Error("Missing guitar/prices for add request.");
      }

      const guitar = guitarSnap.data() as GuitarDoc;
      const prices = pricesSnap.data() as PricesDoc;
      const rrp = getRRPForVariant(
        prices,
        guitar.options ?? null,
        req.selectedOptions ?? null,
        discountPercent,
      );
      const unitPrice = rrp != null ? getDealerPriceFromRRP(rrp, discountPercent) : 0;
      const lineTotal = unitPrice * req.qty;

      // Create a new line for this approved request.
      const lineRef = doc(collection(db, "orders", orderId, "lines"));
      const batch = writeBatch(db);
      batch.set(lineRef, {
        guitarId: req.guitarId,
        sku: req.sku,
        name: req.name,
        qty: req.qty,
        unitPrice,
        lineTotal,
        selectedOptions: req.selectedOptions ?? null,
        isNewOnOrder: true,
        addedViaOrmsbyApproval: true,
      });
      await batch.commit();

      // Update order subtotal.
      const orderData = orderSnap.data() as OrderDoc;
      await updateDoc(doc(db, "orders", orderId), {
        totals: {
          subtotal: (orderData.totals?.subtotal ?? 0) + lineTotal,
          currency: order.currency,
        },
        updatedAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, "orders", orderId, "addRequests", requestId), {
        status: "APPROVED",
        processedAt: new Date().toISOString(),
        rejectionReason: null,
      });

      await fetchOrder();
      alert("Add request approved.");
    } catch (err) {
      console.error("Error approving add request:", err);
      alert("Failed to approve add request.");
    } finally {
      setProcessingRequests(false);
    }
  }

  async function handleRejectAddRequest(requestId: string) {
    if (!order || processingRequests) return;
    const note =
      typeof window !== "undefined"
        ? window.prompt(
            "Optional note to the dealer (why this was rejected). Cancel to abort rejection.",
          )
        : null;
    if (note === null) return;

    setProcessingRequests(true);
    try {
      await updateDoc(doc(db, "orders", orderId, "addRequests", requestId), {
        status: "REJECTED",
        processedAt: new Date().toISOString(),
        rejectionReason: note.trim() || null,
      });
      await fetchOrder();
      alert("Add request rejected.");
    } catch (err) {
      console.error("Error rejecting add request:", err);
      alert("Failed to reject add request.");
    } finally {
      setProcessingRequests(false);
    }
  }

  async function handleApproveRemoveRequest(requestId: string) {
    if (!order || processingRequests) return;

    const req = removeRequests.find((r) => r.id === requestId);
    if (!req) return;

    setProcessingRequests(true);
    try {
      const [orderSnap, lineSnap] = await Promise.all([
        getDoc(doc(db, "orders", orderId)),
        getDoc(doc(db, "orders", orderId, "lines", req.lineId)),
      ]);

      if (!orderSnap.exists()) throw new Error("Order not found");
      if (!lineSnap.exists()) throw new Error("Order line not found");

      const orderData = orderSnap.data() as OrderDoc;
      const lineData = lineSnap.data() as OrderLineDoc;

      // Unit price on the line is the captured unit price at request time.
      // We keep it to avoid changing price assumptions mid-flight.
      const actualRemoveQty = Math.min(req.qtyToRemove, lineData.qty);
      const removedSubtotal = lineData.unitPrice * actualRemoveQty;
      const newQty = lineData.qty - actualRemoveQty;

      const batch = writeBatch(db);

      if (newQty <= 0) {
        batch.delete(doc(db, "orders", orderId, "lines", req.lineId));
      } else {
        batch.update(doc(db, "orders", orderId, "lines", req.lineId), {
          qty: newQty,
          lineTotal: lineData.unitPrice * newQty,
        });
      }

      batch.update(doc(db, "orders", orderId), {
        totals: {
          subtotal: (orderData.totals?.subtotal ?? 0) - removedSubtotal,
          currency: order.currency,
        },
        updatedAt: new Date().toISOString(),
      });

      batch.update(
        doc(db, "orders", orderId, "removeRequests", requestId),
        {
          status: "APPROVED",
          processedAt: new Date().toISOString(),
          rejectionReason: null,
        },
      );

      await batch.commit();
      await fetchOrder();
      alert("Removal request approved.");
    } catch (err) {
      console.error("Error approving remove request:", err);
      alert("Failed to approve removal request.");
    } finally {
      setProcessingRequests(false);
    }
  }

  async function handleRejectRemoveRequest(requestId: string) {
    if (!order || processingRequests) return;
    setProcessingRequests(true);
    try {
      await updateDoc(doc(db, "orders", orderId, "removeRequests", requestId), {
        status: "REJECTED",
        processedAt: new Date().toISOString(),
      });
      await fetchOrder();
      alert("Removal request rejected.");
    } catch (err) {
      console.error("Error rejecting remove request:", err);
      alert("Failed to reject removal request.");
    } finally {
      setProcessingRequests(false);
    }
  }

  if (loading) {
    return (
      <AdminGuard>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading order…</p>
        </main>
      </AdminGuard>
    );
  }

  if (error || !order) {
    return (
      <AdminGuard>
        <main className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-semibold">Order not found</h1>
            <p className="text-sm text-neutral-400">{error || "This order could not be loaded"}</p>
          </div>
          <Link
            href="/admin/accounts"
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-black shadow-soft transition hover:bg-accent-soft"
          >
            Back to orders
          </Link>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/orders"
              className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="mt-2 text-sm text-neutral-400">
                {order.shippingAddress.company || "No company name"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {order.pendingOrmsbyRevisionReview && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                Revision pending approval
              </span>
            )}
            {order.dealerPendingAdminProposedChanges && (
              <span
                className="rounded-full border border-violet-500/40 bg-violet-500/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200"
                title="Dealer must confirm line/qty/price updates"
              >
                Awaiting dealer confirmation
              </span>
            )}
            {order.dealerNotifiedOrmsbyOfUpdatesAt && (
              <span
                className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
                title="Dealer submitted updated order for review"
              >
                Update submitted{" "}
                {new Date(order.dealerNotifiedOrmsbyOfUpdatesAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {order.resubmittedAt && (
              <span
                className="rounded-full border border-sky-500/30 bg-sky-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300"
                title={
                  order.resubmittedFromStatus
                    ? `Resubmitted from ${order.resubmittedFromStatus}`
                    : undefined
                }
              >
                Dealer resubmit{" "}
                {new Date(order.resubmittedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            <span
              className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                order.status === "SUBMITTED"
                  ? "bg-blue-500/20 text-blue-400"
                  : order.status === "APPROVED"
                  ? "bg-green-500/20 text-green-400"
                  : order.status === "SHIPPED"
                  ? "bg-purple-500/20 text-purple-400"
                  : order.status === "CANCELLED"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-neutral-500/20 text-neutral-400"
              }`}
            >
              {order.status}
            </span>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Order Details - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Order Items</h2>
              <div className="space-y-4">
                {orderLines.map((line) => {
                  const guitar = guitarsMap.get(line.guitarId);

                  // Determine image URL: prefer option-specific image, fallback to base image
                  let imageUrl: string | null = null;
                  if (guitar) {
                    if (guitar.options && line.selectedOptions) {
                      for (const option of guitar.options) {
                        const selectedValueId = line.selectedOptions[option.optionId];
                        if (selectedValueId) {
                          const selectedValue = option.values.find(
                            (v) => v.valueId === selectedValueId,
                          );
                          if (selectedValue?.images && selectedValue.images.length > 0) {
                            imageUrl = selectedValue.images[0];
                            break;
                          }
                        }
                      }
                    }
                    if (!imageUrl && guitar.images && guitar.images.length > 0) {
                      imageUrl = guitar.images[0];
                    }
                  }

                  const isNewAddition =
                    line.isNewOnOrder === true || line.addedViaOrmsbyApproval === true;
                  const isDealerDirectNewLine =
                    line.isNewOnOrder === true && line.addedViaOrmsbyApproval !== true;
                  const linePendingOrmsbyReview =
                    order.pendingOrmsbyRevisionReview === true && isDealerDirectNewLine;

                  return (
                    <div
                      key={line.id}
                      className={
                        linePendingOrmsbyReview
                          ? "rounded-lg border-2 border-amber-500/50 bg-amber-500/[0.08] p-4 shadow-[0_0_24px_-12px_rgba(245,158,11,0.35)] ring-1 ring-amber-500/25"
                          : isNewAddition
                            ? "rounded-lg border-2 border-emerald-500/50 bg-emerald-500/[0.07] p-4 shadow-[0_0_24px_-12px_rgba(16,185,129,0.45)] ring-1 ring-emerald-500/25"
                            : "rounded-lg border border-white/10 bg-black/20 p-4"
                      }
                    >
                      <div className="flex gap-4">
                        {imageUrl && (
                          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={line.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 flex items-start justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-white">{line.name}</h3>
                              {linePendingOrmsbyReview ? (
                                <span
                                  className="rounded-full border border-amber-400/35 bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100"
                                  title="Dealer submitted this addition for review"
                                >
                                  Pending
                                </span>
                              ) : isNewAddition ? (
                                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                                  New
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-neutral-400">SKU: {line.sku}</p>
                            {line.selectedOptions &&
                              Object.keys(line.selectedOptions).length > 0 && (
                                <div className="mt-2 space-y-1 text-xs text-neutral-400">
                                  {Object.entries(line.selectedOptions).map(
                                    ([key, value]) => (
                                      <div key={key}>
                                        <span className="capitalize">{key}:</span> {value}
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                          </div>
                          <div className="text-right min-w-[11rem]">
                            <div className="flex flex-col items-end gap-2">
                              <label className="block w-full text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 sm:text-right">
                                Qty
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={lineDrafts[line.id]?.qty ?? String(line.qty)}
                                  onChange={(e) =>
                                    setLineDrafts((prev) => ({
                                      ...prev,
                                      [line.id]: {
                                        qty: e.target.value,
                                        unitPrice:
                                          prev[line.id]?.unitPrice ??
                                          formatUnitPriceForInput(line.unitPrice),
                                      },
                                    }))
                                  }
                                  className="mt-0.5 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-accent sm:max-w-[5rem] sm:text-right"
                                />
                              </label>
                              <label className="block w-full text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 sm:text-right">
                                Unit ({order.currency})
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={
                                    lineDrafts[line.id]?.unitPrice ??
                                    formatUnitPriceForInput(line.unitPrice)
                                  }
                                  onChange={(e) =>
                                    setLineDrafts((prev) => ({
                                      ...prev,
                                      [line.id]: {
                                        qty: prev[line.id]?.qty ?? String(line.qty),
                                        unitPrice: e.target.value,
                                      },
                                    }))
                                  }
                                  onBlur={() => {
                                    setLineDrafts((prev) => {
                                      const d = prev[line.id];
                                      const raw = parseFloat(d?.unitPrice ?? "");
                                      if (!Number.isFinite(raw)) return prev;
                                      return {
                                        ...prev,
                                        [line.id]: {
                                          qty: d?.qty ?? String(line.qty),
                                          unitPrice: formatUnitPriceForInput(raw),
                                        },
                                      };
                                    });
                                  }}
                                  className="mt-0.5 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-accent sm:max-w-[6.5rem] sm:text-right"
                                />
                              </label>
                            </div>
                            <p className="mt-2 text-xs text-neutral-400">
                              Saved: {order.currency === "USD" ? "$" : order.currency}{" "}
                              {line.unitPrice.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              × {line.qty}
                            </p>
                            {(() => {
                              const prices = pricesMap.get(line.guitarId);
                              const discountPercent = orderAccount?.discountPercent ?? 0;
                              const rrp = getRRPForVariant(
                                prices ?? null,
                                guitar?.options ?? null,
                                line.selectedOptions ?? null,
                                discountPercent,
                              );
                              const currentUnit =
                                rrp != null ? getDealerPriceFromRRP(rrp, discountPercent) : null;

                              return currentUnit != null ? (
                                <p className="mt-0.5 text-xs text-neutral-500">
                                  Current: {order.currency === "USD" ? "$" : order.currency}{" "}
                                  {currentUnit.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  each
                                </p>
                              ) : null;
                            })()}
                            <p className="mt-1 text-sm font-semibold text-white">
                              {order.currency === "USD" ? "$" : order.currency}{" "}
                              {(line.unitPrice * line.qty).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              total
                            </p>
                            <div className="mt-2 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSaveLine(line.id)}
                                disabled={savingLineId !== null || removingLineId !== null}
                                className="rounded-lg bg-accent/90 px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-accent disabled:opacity-50"
                              >
                                {savingLineId === line.id ? "Saving…" : "Save line"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRemoveLine(line.id)}
                                disabled={removingLineId !== null || savingLineId !== null}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                              >
                                {removingLineId === line.id ? "Removing…" : "Remove line"}
                              </button>
                              <Link
                                href={`/admin/pricing/${line.guitarId}`}
                                className="text-xs text-accent hover:text-accent-soft"
                              >
                                Edit pricing
                              </Link>
                              <Link
                                href={`/admin/guitars/${line.guitarId}/preview`}
                                className="text-xs text-neutral-400 hover:text-white"
                              >
                                View guitar
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Shipping Address</h2>
              <div className="space-y-1 text-sm text-neutral-300">
                {order.shippingAddress.company && (
                  <p className="font-medium text-white">{order.shippingAddress.company}</p>
                )}
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}
                  {order.shippingAddress.region && `, ${order.shippingAddress.region}`}
                  {order.shippingAddress.postalCode && ` ${order.shippingAddress.postalCode}`}
                </p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
          </div>

          {/* Admin Actions - 1/3 width */}
          <div className="space-y-6">
            {/* Status Update */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Update Status
              </h2>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={updatingStatus || order.status === status}
                    className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      order.status === status
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10"
                    } disabled:opacity-50`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {order.pendingOrmsbyRevisionReview && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200/90">
                  Dealer revision
                </h2>
                <p className="mb-4 text-xs text-neutral-400">
                  The dealer submitted updated line items and is waiting for Ormsby to review. Adjust
                  qty/prices or remove lines above, then either approve as-is or send your changes to
                  the dealer for confirmation.
                </p>
                {order.dealerNotifiedOrmsbyOfUpdatesAt && (
                  <p className="mb-4 text-[11px] text-neutral-500">
                    Submitted:{" "}
                    {new Date(order.dealerNotifiedOrmsbyOfUpdatesAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => void handleApproveDealerRevision()}
                    disabled={approvingRevision || order.dealerPendingAdminProposedChanges}
                    className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
                  >
                    {approvingRevision ? "Approving…" : "Approve revision (no dealer confirm)"}
                  </button>
                  {order.status !== "DRAFT" && !order.dealerPendingAdminProposedChanges && (
                    <>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-amber-100/80">
                        Note to dealer (optional)
                        <textarea
                          value={adminProposeNote}
                          onChange={(e) => setAdminProposeNote(e.target.value)}
                          rows={3}
                          placeholder="e.g. Reduced qty on Hype 7 due to batch limits…"
                          className="mt-1 w-full rounded-lg border border-amber-500/25 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-amber-400/50"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleSubmitProposedChangesToDealer()}
                        disabled={submittingProposedChanges}
                        className="w-full rounded-lg border border-violet-400/40 bg-violet-600/80 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                      >
                        {submittingProposedChanges
                          ? "Sending…"
                          : "Submit proposed changes to dealer"}
                      </button>
                      <p className="text-[10px] text-neutral-500">
                        Clears “revision pending” and emails the dealer to accept or request changes
                        (if notifications are on).
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {!order.pendingOrmsbyRevisionReview &&
              order.status !== "DRAFT" &&
              !order.dealerPendingAdminProposedChanges && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Propose updates to dealer
                  </h2>
                  <p className="mb-3 text-xs text-neutral-500">
                    After editing line qty/prices above, send the order to the dealer for
                    confirmation (e.g. repricing without a pending revision).
                  </p>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Note to dealer (optional)
                    <textarea
                      value={adminProposeNote}
                      onChange={(e) => setAdminProposeNote(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-accent"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSubmitProposedChangesToDealer()}
                    disabled={submittingProposedChanges}
                    className="mt-3 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {submittingProposedChanges
                      ? "Sending…"
                      : "Submit proposed changes to dealer"}
                  </button>
                </div>
              )}

            {order.dealerPendingAdminProposedChanges && (
              <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-violet-200/90">
                  Awaiting dealer
                </h2>
                <p className="text-xs text-neutral-400">
                  The dealer must open the order and accept your updates or request changes. You’ll
                  get an email when they respond (if enabled in settings).
                </p>
                {order.adminProposedChangesAt && (
                  <p className="mt-3 text-[11px] text-neutral-500">
                    Sent:{" "}
                    {new Date(order.adminProposedChangesAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                {order.adminProposedChangesNote && (
                  <p className="mt-2 text-xs text-neutral-300">
                    <span className="font-medium text-violet-200/90">Your note:</span>{" "}
                    {order.adminProposedChangesNote}
                  </p>
                )}
              </div>
            )}

            {/* Invoice Upload */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Invoice
              </h2>
              {invoiceUrl ? (
                <div className="space-y-3">
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                  >
                    View Invoice
                  </a>
                  <button
                    onClick={() => setInvoiceUrl(null)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                  >
                    Upload New Invoice
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInvoiceUpload} className="space-y-3">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black file:hover:bg-accent-soft"
                  />
                  <button
                    type="submit"
                    disabled={!invoiceFile || uploadingInvoice}
                    className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50"
                  >
                    {uploadingInvoice ? "Uploading..." : "Upload Invoice"}
                  </button>
                </form>
              )}
            </div>

            {/* ETA Update */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Delivery ETA
              </h2>
              <form onSubmit={handleEtaUpdate} className="space-y-3">
                <input
                  type="date"
                  value={etaDate}
                  onChange={(e) => setEtaDate(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-accent focus:bg-white/10"
                />
                <button
                  type="submit"
                  disabled={updatingEta}
                  className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50"
                >
                  {updatingEta ? "Updating..." : "Update ETA"}
                </button>
              </form>
            </div>

            {/* Recalculate prices (for seeded orders with 0 prices) */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Prices
              </h2>
              <p className="mb-3 text-xs text-neutral-500">
                Recalculate line prices from current RRP pricing using the order account discount.
              </p>
              <button
                type="button"
                onClick={handleRecalculatePrices}
                disabled={recalculatingPrices}
                className="w-full rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
              >
                {recalculatingPrices ? "Recalculating…" : "Recalculate prices"}
              </button>
            </div>

            {/* Move Order */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Move Order
              </h2>
              <p className="mb-3 text-xs text-neutral-500">
                Reassign this order to another dealer account and recalculate prices using that account&apos;s discount.
              </p>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Target account
              </label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                disabled={accounts.length === 0 || movingOrder}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-accent disabled:opacity-50"
              >
                {accounts.length === 0 ? (
                  <option value="">Loading accounts…</option>
                ) : (
                  accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name ? `${a.name} (${a.id})` : a.id}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={handleMoveOrderToAccount}
                disabled={
                  movingOrder ||
                  !targetAccountId ||
                  accounts.length === 0 ||
                  targetAccountId === order.accountId
                }
                className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50"
              >
                {movingOrder ? "Moving…" : "Move to selected account"}
              </button>
            </div>

            {/* Add / Remove Requests */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Pending Changes
              </h2>

              {addRequests.filter((r) => r.status === "PENDING").length === 0 &&
              removeRequests.filter((r) => r.status === "PENDING").length === 0 ? (
                <p className="text-xs text-neutral-500">No pending add/remove requests.</p>
              ) : (
                <div className="space-y-5">
                  {addRequests.filter((r) => r.status === "PENDING").length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Add requests
                      </p>
                      <div className="space-y-2">
                        {addRequests
                          .filter((r) => r.status === "PENDING")
                          .map((r) => (
                            <div
                              key={r.id}
                              className="rounded-lg border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {r.name}
                                  </p>
                                  <p className="text-xs text-neutral-400">
                                    SKU: {r.sku} · Qty: {r.qty}
                                  </p>
                                  {r.selectedOptions &&
                                    Object.keys(r.selectedOptions).length > 0 && (
                                      <p className="mt-1 text-[11px] text-neutral-500">
                                        {Object.entries(r.selectedOptions)
                                          .map(([k, v]) => `${k}: ${v}`)
                                          .join(" · ")}
                                      </p>
                                    )}
                                  <p className="mt-1 text-[11px] text-neutral-500">
                                    Requested unit:{" "}
                                    {order.currency === "USD" ? "$" : order.currency}{" "}
                                    {r.unitPrice.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAddRequest(r.id)}
                                    disabled={processingRequests}
                                    className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectAddRequest(r.id)}
                                    disabled={processingRequests}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {removeRequests.filter((r) => r.status === "PENDING").length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Remove requests
                      </p>
                      <div className="space-y-2">
                        {removeRequests
                          .filter((r) => r.status === "PENDING")
                          .map((r) => (
                            <div
                              key={r.id}
                              className="rounded-lg border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white">
                                    {guitarsMap.get(r.guitarId)?.name ?? r.guitarId}
                                  </p>
                                  <p className="text-xs text-neutral-400">
                                    Qty to remove: {r.qtyToRemove} · Line:{" "}
                                    {r.lineId.slice(0, 8)}
                                  </p>
                                  <p className="mt-1 text-[11px] text-neutral-500">
                                    Unit:{" "}
                                    {order.currency === "USD" ? "$" : order.currency}{" "}
                                    {r.unitPrice.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveRemoveRequest(r.id)}
                                    disabled={processingRequests}
                                    className="rounded-lg bg-yellow-500/20 px-3 py-2 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-500/30 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectRemoveRequest(r.id)}
                                    disabled={processingRequests}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Order Summary
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Subtotal</span>
                  <span className="font-medium text-white">
                    {order.currency === "USD" ? "$" : order.currency}{" "}
                    {order.totals.subtotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {order.poNumber && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-neutral-400">PO Number</p>
                    <p className="font-medium text-white">{order.poNumber}</p>
                  </div>
                )}
                {order.notes && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-neutral-400">Notes</p>
                    <p className="text-sm text-neutral-300">{order.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}

