"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveAccountId, useDealerView } from "@/lib/dealer-view-context";
import { useEffect, useState, use, useMemo } from "react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  Timestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import Link from "next/link";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";
import { OptionSelector } from "@/components/guitars/OptionSelector";
import { fetchActiveGuitarDocsForPicker } from "@/lib/fetch-active-guitars";
import { resolveLineOptionLabels } from "@/lib/order-line-options";

const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  IN_PRODUCTION: "In Production",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: "bg-neutral-700",
  SUBMITTED: "bg-blue-600",
  APPROVED: "bg-green-600",
  IN_PRODUCTION: "bg-yellow-600",
  SHIPPED: "bg-purple-600",
  COMPLETED: "bg-green-700",
  CANCELLED: "bg-red-600",
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const effectiveAccountId = useEffectiveAccountId();
  const { isAdminDealerPreview } = useDealerView();
  const router = useRouter();
  const previewReadOnly = isAdminDealerPreview;
  const [order, setOrder] = useState<(OrderDoc & { id: string }) | null>(null);
  const [orderLines, setOrderLines] = useState<Array<OrderLineDoc & { id: string }>>([]);
  const [guitarsMap, setGuitarsMap] = useState<Map<string, GuitarDoc>>(new Map());
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(null);
  const [addRequests, setAddRequests] = useState<Array<OrderAddRequestDoc & { id: string }>>([]);
  const [removeRequests, setRemoveRequests] = useState<Array<OrderRemoveRequestDoc & { id: string }>>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // --- Add guitar section state ---
  const [catalogGuitars, setCatalogGuitars] = useState<Array<GuitarDoc & { id: string }>>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedAddGuitarId, setSelectedAddGuitarId] = useState<string | null>(null);
  const [selectedAddOptions, setSelectedAddOptions] = useState<Record<string, string>>({});
  const [addQty, setAddQty] = useState(1);
  const [selectedAddPrices, setSelectedAddPrices] = useState<PricesDoc | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // --- Remove guitar section state ---
  const [removeQtyByLineId, setRemoveQtyByLineId] = useState<Record<string, number>>({});
  const [removeSubmitting, setRemoveSubmitting] = useState(false);
  const [resubmittingAddRequestId, setResubmittingAddRequestId] = useState<string | null>(null);
  const [resubmittingOrder, setResubmittingOrder] = useState(false);
  const [notifyingOrmsbyOfUpdates, setNotifyingOrmsbyOfUpdates] = useState(false);
  const [respondingToAdminProposal, setRespondingToAdminProposal] = useState<
    "accept" | "reject" | null
  >(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!effectiveAccountId) {
      setFetching(false);
      return;
    }

    async function fetchOrder() {
      setFetching(true);
      setError(null);
      try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (!orderDoc.exists()) {
          setError("Order not found");
          setFetching(false);
          return;
        }

        const orderDataRaw = orderDoc.data();
        const orderData = {
          id: orderDoc.id,
          ...orderDataRaw,
          // Convert Firestore Timestamps to strings/dates
          createdAt: orderDataRaw.createdAt instanceof Timestamp
            ? orderDataRaw.createdAt.toDate().toISOString()
            : orderDataRaw.createdAt,
          updatedAt: orderDataRaw.updatedAt instanceof Timestamp
            ? orderDataRaw.updatedAt.toDate().toISOString()
            : orderDataRaw.updatedAt,
        } as OrderDoc & { id: string };

        // Verify the order belongs to the effective account (dealer or admin preview)
        if (!effectiveAccountId || orderData.accountId !== effectiveAccountId) {
          setError("You don't have permission to view this order");
          setFetching(false);
          return;
        }

        setOrder(orderData);

        // Fetch account (for discount %) and any pending add/remove requests
        const [acctSnap, addReqSnap, removeReqSnap] = await Promise.all([
          getDoc(doc(db, "accounts", effectiveAccountId)),
          getDocs(collection(db, "orders", orderId, "addRequests")),
          getDocs(collection(db, "orders", orderId, "removeRequests")),
        ]);

        if (acctSnap.exists()) {
          setAccount({ id: acctSnap.id, ...(acctSnap.data() as AccountDoc) });
        } else {
          setAccount(null);
        }

        const addReqs = addReqSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as OrderAddRequestDoc),
        }));
        const removeReqs = removeReqSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as OrderRemoveRequestDoc),
        }));
        setAddRequests(addReqs);
        setRemoveRequests(removeReqs);

        // Fetch order lines
        const linesRef = collection(db, "orders", orderId, "lines");
        const linesSnap = await getDocs(linesRef);
        const linesData = linesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<OrderLineDoc & { id: string }>;
        setOrderLines(linesData);

        // Include guitars referenced on add/remove requests (for option labels in request cards)
        const uniqueGuitarIds = Array.from(
          new Set([
            ...linesData.map((line) => line.guitarId),
            ...addReqs.map((r) => r.guitarId),
            ...removeReqs.map((r) => r.guitarId),
          ]),
        );
        const guitars = new Map<string, GuitarDoc>();
        
        for (const guitarId of uniqueGuitarIds) {
          const guitarSnap = await getDoc(doc(db, "guitars", guitarId));
          if (guitarSnap.exists()) {
            guitars.set(guitarId, guitarSnap.data() as GuitarDoc);
          }
        }
        
        setGuitarsMap(guitars);
      } catch (err) {
        console.error(err);
        setError("Unable to load order");
      } finally {
        setFetching(false);
      }
    }

    fetchOrder();
  }, [orderId, user, authLoading, router, refreshToken, effectiveAccountId]);

  // Fetch a small catalog for "search and select guitar" when editing orders.
  useEffect(() => {
    if (!effectiveAccountId || previewReadOnly) return;

    let cancelled = false;
    async function run() {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const rows = await fetchActiveGuitarDocsForPicker(120);
        if (cancelled) return;
        setCatalogGuitars(rows);
      } catch (err: unknown) {
        console.error("Error fetching catalog for order edit:", err);
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err && "message" in err
              ? String((err as { message: unknown }).message)
              : "Unknown error";
        if (!cancelled) {
          setCatalogGuitars([]);
          setCatalogError(msg);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [effectiveAccountId, previewReadOnly]);

  // Load prices for the currently selected guitar to compute dealer unit prices.
  useEffect(() => {
    if (!selectedAddGuitarId) {
      setSelectedAddPrices(null);
      return;
    }

    const selectedId = selectedAddGuitarId;
    let cancelled = false;
    async function run() {
      try {
        const snap = await getDoc(doc(db, "prices", selectedId));
        if (cancelled) return;
        setSelectedAddPrices(snap.exists() ? (snap.data() as PricesDoc) : null);
      } catch (err) {
        console.error("Error loading selected guitar prices:", err);
        if (!cancelled) setSelectedAddPrices(null);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedAddGuitarId]);

  // All hooks must run before any conditional return (Rules of Hooks)
  const selectedAddGuitar = useMemo(() => {
    if (!selectedAddGuitarId) return null;
    return (
      catalogGuitars.find((g) => g.id === selectedAddGuitarId) ?? null
    );
  }, [catalogGuitars, selectedAddGuitarId]);

  const discountPercent = account?.discountPercent ?? 0;
  const canDirectModify =
    !previewReadOnly &&
    (order?.status === "DRAFT" ||
      order?.status === "SUBMITTED" ||
      order?.status === "APPROVED");
  const isInProductionFlow =
    !previewReadOnly &&
    (order?.status === "IN_PRODUCTION" ||
      order?.status === "SHIPPED" ||
      order?.status === "COMPLETED");

  /** Same as Firestore rule for creating add requests — needed to resubmit after rejection. */
  const canCreateAddRequest =
    order?.status === "IN_PRODUCTION" ||
    order?.status === "SHIPPED" ||
    order?.status === "COMPLETED";

  const addRrp = useMemo(() => {
    if (!selectedAddPrices || !selectedAddGuitar) return null;
    return getRRPForVariant(
      selectedAddPrices,
      selectedAddGuitar.options ?? null,
      selectedAddOptions,
      discountPercent,
    );
  }, [selectedAddPrices, selectedAddGuitar, selectedAddOptions, discountPercent]);

  const addUnitPrice = useMemo(() => {
    if (addRrp == null) return null;
    return getDealerPriceFromRRP(addRrp, discountPercent);
  }, [addRrp, discountPercent]);

  const addOptionsValid = useMemo(() => {
    if (!selectedAddGuitar?.options || selectedAddGuitar.options.length === 0) {
      return true;
    }
    return selectedAddGuitar.options.every((opt) => {
      if (!opt.required) return true;
      return selectedAddOptions[opt.optionId] != null;
    });
  }, [selectedAddGuitar, selectedAddOptions]);

  const addTotal = useMemo(() => {
    if (addUnitPrice == null) return 0;
    return addUnitPrice * addQty;
  }, [addUnitPrice, addQty]);

  const totalGuitars = orderLines.reduce((sum, line) => sum + line.qty, 0);
  const depositRequired = totalGuitars * 200;

  const buildFinalSku = (g: GuitarDoc, opts: Record<string, string>) => {
    let finalSku = g.sku;
    if (g.options) {
      for (const option of g.options) {
        const valueId = opts[option.optionId];
        if (!valueId) continue;
        const val = option.values.find((v) => v.valueId === valueId);
        if (val?.skuSuffix) finalSku += val.skuSuffix;
      }
    }
    return finalSku;
  };

  const pendingRemoveQtyByLineId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of removeRequests) {
      if (r.status !== "PENDING") continue;
      map[r.lineId] = (map[r.lineId] ?? 0) + r.qtyToRemove;
    }
    return map;
  }, [removeRequests]);

  const addRequestsForDealerBanner = useMemo(() => {
    return addRequests
      .filter((r) => r.status === "PENDING" || r.status === "REJECTED")
      .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
  }, [addRequests]);

  /** Unsaved work in the “add another guitar” section (not yet added to the order). */
  const addFormDirty = useMemo(() => {
    return (
      catalogSearch.trim().length > 0 ||
      selectedAddGuitarId != null ||
      Object.keys(selectedAddOptions).length > 0
    );
  }, [catalogSearch, selectedAddGuitarId, selectedAddOptions]);

  /** New lines you added yourself (not created from an Ormsby-approved add request). */
  const hasDealerDirectNewLines = useMemo(() => {
    return orderLines.some(
      (l) => l.isNewOnOrder === true && l.addedViaOrmsbyApproval !== true,
    );
  }, [orderLines]);

  if (authLoading || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading order…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !order) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-semibold">Order not found</h1>
          <p className="text-sm text-neutral-400">{error || "This order could not be loaded"}</p>
        </div>
        <Link
          href="/orders"
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-black shadow-soft transition hover:bg-accent-soft"
        >
          Back to orders
        </Link>
      </main>
    );
  }

  async function handleAddToOrder() {
    if (!order || !selectedAddGuitar || !selectedAddPrices) return;
    if (!canDirectModify) return;
    if (!addOptionsValid) {
      alert("Please select all required options.");
      return;
    }
    if (addUnitPrice == null) {
      alert("Unable to calculate unit price for this configuration.");
      return;
    }
    if (addQty <= 0) {
      alert("Quantity must be at least 1.");
      return;
    }

    setAddSubmitting(true);
    try {
      const lineRef = doc(
        collection(db, "orders", orderId, "lines"),
      );
      const unitPrice = addUnitPrice;
      const selectedSku = buildFinalSku(selectedAddGuitar, selectedAddOptions);

      const batch = writeBatch(db);
      batch.set(lineRef, {
        guitarId: selectedAddGuitar.id,
        sku: selectedSku,
        name: selectedAddGuitar.name,
        qty: addQty,
        unitPrice,
        lineTotal: unitPrice * addQty,
        selectedOptions: selectedAddOptions,
        isNewOnOrder: true,
      });

      batch.update(doc(db, "orders", orderId), {
        totals: {
          subtotal: order.totals.subtotal + unitPrice * addQty,
          currency: order.currency,
        },
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      setRefreshToken((t) => t + 1);
      alert("Added to order.");
    } catch (err) {
      console.error("Error adding to order:", err);
      alert("Failed to add to order.");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleRequestAddToOrder() {
    if (!order || !selectedAddGuitar || !selectedAddPrices) return;
    if (!user?.accountId) return;
    if (!addOptionsValid) {
      alert("Please select all required options.");
      return;
    }
    if (addUnitPrice == null) {
      alert("Unable to calculate requested unit price for this configuration.");
      return;
    }
    if (addQty <= 0) {
      alert("Quantity must be at least 1.");
      return;
    }

    setAddSubmitting(true);
    try {
      const requestRef = doc(
        collection(db, "orders", orderId, "addRequests"),
      );

      await setDoc(requestRef, {
        guitarId: selectedAddGuitar.id,
        sku: buildFinalSku(selectedAddGuitar, selectedAddOptions),
        name: selectedAddGuitar.name,
        qty: addQty,
        unitPrice: addUnitPrice,
        selectedOptions: selectedAddOptions,
        requestedByUid: user.uid,
        requestedByAccountId: user.accountId,
        status: "PENDING",
        requestedAt: new Date().toISOString(),
        processedAt: null,
        rejectionReason: null,
      } as OrderAddRequestDoc);

      setRefreshToken((t) => t + 1);
      alert("Request sent to add this guitar.");
    } catch (err) {
      console.error("Error creating add request:", err);
      alert("Failed to send add request.");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleRemoveFromOrder(line: OrderLineDoc & { id: string }, removeQty: number) {
    if (!order) return;
    if (!canDirectModify) return;
    if (removeQty <= 0) return;
    if (removeQty > line.qty) {
      alert("Cannot remove more than the current quantity.");
      return;
    }

    setRemoveSubmitting(true);
    try {
      const batch = writeBatch(db);

      const lineRef = doc(db, "orders", orderId, "lines", line.id);
      const removedSubtotal = line.unitPrice * removeQty;
      const newQty = line.qty - removeQty;

      if (newQty <= 0) {
        batch.delete(lineRef);
      } else {
        batch.update(lineRef, {
          qty: newQty,
          lineTotal: line.unitPrice * newQty,
        });
      }

      batch.update(doc(db, "orders", orderId), {
        totals: {
          subtotal: order.totals.subtotal - removedSubtotal,
          currency: order.currency,
        },
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();
      setRefreshToken((t) => t + 1);
      alert("Removed from order.");
    } catch (err) {
      console.error("Error removing from order:", err);
      alert("Failed to remove.");
    } finally {
      setRemoveSubmitting(false);
    }
  }

  async function handleRequestRemoveFromOrder(line: OrderLineDoc & { id: string }, removeQty: number) {
    if (!order) return;
    if (!user?.accountId) return;
    if (removeQty <= 0) return;
    if (removeQty > line.qty) {
      alert("Cannot remove more than the current quantity.");
      return;
    }

    setRemoveSubmitting(true);
    try {
      const requestRef = doc(
        collection(db, "orders", orderId, "removeRequests"),
      );

      await setDoc(requestRef, {
        lineId: line.id,
        guitarId: line.guitarId,
        qtyToRemove: removeQty,
        unitPrice: line.unitPrice,
        requestedByUid: user.uid,
        requestedByAccountId: user.accountId,
        status: "PENDING",
        requestedAt: new Date().toISOString(),
        processedAt: null,
        rejectionReason: null,
      } as OrderRemoveRequestDoc);

      setRefreshToken((t) => t + 1);
      alert("Removal request sent.");
    } catch (err) {
      console.error("Error creating removal request:", err);
      alert("Failed to send removal request.");
    } finally {
      setRemoveSubmitting(false);
    }
  }

  async function handleNotifyOrmsbyOfOrderUpdates() {
    if (!order || previewReadOnly) return;
    if (!canDirectModify) return;
    if (!hasDealerDirectNewLines) return;
    if (order.pendingOrmsbyRevisionReview) {
      alert("This order is already waiting for Ormsby approval.");
      return;
    }
    if (order.dealerPendingAdminProposedChanges) {
      alert("Please accept or request changes on Ormsby's proposed update first.");
      return;
    }

    setNotifyingOrmsbyOfUpdates(true);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        dealerNotifiedOrmsbyOfUpdatesAt: new Date().toISOString(),
        pendingOrmsbyRevisionReview: true,
        updatedAt: new Date().toISOString(),
      });
      router.push(`/orders/${orderId}/revision-submitted`);
    } catch (err) {
      console.error("Error notifying Ormsby:", err);
      alert("Could not send that update. Please try again.");
    } finally {
      setNotifyingOrmsbyOfUpdates(false);
    }
  }

  async function handleAcceptAdminProposal() {
    if (!order || previewReadOnly) return;
    setRespondingToAdminProposal("accept");
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "orders", orderId), {
        dealerPendingAdminProposedChanges: false,
        dealerAcceptedAdminChangesAt: now,
        updatedAt: now,
      });
      setRefreshToken((t) => t + 1);
      alert("Thanks — your order is updated as proposed.");
    } catch (err) {
      console.error("Error accepting proposal:", err);
      alert("Could not record your acceptance. Please try again.");
    } finally {
      setRespondingToAdminProposal(null);
    }
  }

  async function handleRequestChangesAfterAdminProposal() {
    if (!order || previewReadOnly) return;
    const note =
      typeof window !== "undefined"
        ? window.prompt(
            "Tell Ormsby what still needs to change (optional). This sends the order back for their review.",
          )
        : null;
    if (note === null) return;

    setRespondingToAdminProposal("reject");
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "orders", orderId), {
        dealerPendingAdminProposedChanges: false,
        pendingOrmsbyRevisionReview: true,
        dealerRejectedAdminProposedAt: now,
        dealerRejectedAdminProposedNote: note.trim() || null,
        updatedAt: now,
      });
      setRefreshToken((t) => t + 1);
      alert("Your feedback was sent. Ormsby will review the order again.");
    } catch (err) {
      console.error("Error requesting changes:", err);
      alert("Could not send your request. Please try again.");
    } finally {
      setRespondingToAdminProposal(null);
    }
  }

  async function handleResubmitOrderToOrmsby() {
    if (!order || previewReadOnly) return;
    if (order.status !== "COMPLETED") return;

    const ok = window.confirm(
      "Resubmit this order to Ormsby? Status will change to Submitted so Ormsby can review the order again (including any new guitars or requests).",
    );
    if (!ok) return;

    setResubmittingOrder(true);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "SUBMITTED",
        updatedAt: new Date().toISOString(),
        resubmittedAt: new Date().toISOString(),
        resubmittedFromStatus: "COMPLETED",
      });
      setRefreshToken((t) => t + 1);
      alert("Order resubmitted. Status is now Submitted.");
    } catch (err) {
      console.error("Error resubmitting order:", err);
      alert("Could not resubmit the order. Please try again.");
    } finally {
      setResubmittingOrder(false);
    }
  }

  async function handleResubmitRejectedAddRequest(
    req: OrderAddRequestDoc & { id: string },
  ) {
    if (!order || !user?.accountId) return;
    if (req.status !== "REJECTED") return;
    if (!canCreateAddRequest) {
      alert("You can’t resubmit add requests for this order status.");
      return;
    }

    setResubmittingAddRequestId(req.id);
    try {
      const newRef = doc(collection(db, "orders", orderId, "addRequests"));
      await setDoc(newRef, {
        guitarId: req.guitarId,
        sku: req.sku,
        name: req.name,
        qty: req.qty,
        unitPrice: req.unitPrice,
        selectedOptions: req.selectedOptions ?? null,
        requestedByUid: user.uid,
        requestedByAccountId: user.accountId,
        status: "PENDING",
        requestedAt: new Date().toISOString(),
        processedAt: null,
        rejectionReason: null,
      } as OrderAddRequestDoc);

      setRefreshToken((t) => t + 1);
      alert("Request resubmitted to Ormsby for approval.");
    } catch (err) {
      console.error("Error resubmitting add request:", err);
      alert("Failed to resubmit. Please try again.");
    } finally {
      setResubmittingAddRequestId(null);
    }
  }

  function resetAddGuitarForm() {
    setCatalogSearch("");
    setSelectedAddGuitarId(null);
    setSelectedAddOptions({});
    setAddQty(1);
  }

  function handleDiscardAddFormUpdates() {
    if (!addFormDirty) return;
    const ok = window.confirm(
      "Discard your guitar selection and search? Nothing will be added to the order.",
    );
    if (!ok) return;
    resetAddGuitarForm();
  }

  async function handleSubmitChangesFromBar() {
    if (!order) return;
    if (!canDirectModify && !isInProductionFlow) {
      alert("You can’t add guitars to this order in its current state.");
      return;
    }
    if (!selectedAddGuitarId || !selectedAddGuitar || !selectedAddPrices) {
      alert("Select a model and configure options below first.");
      return;
    }
    if (!addOptionsValid) {
      alert("Please select all required options.");
      return;
    }
    if (addUnitPrice == null) {
      alert("Unable to calculate price for this configuration.");
      return;
    }
    if (canDirectModify) {
      await handleAddToOrder();
    } else {
      await handleRequestAddToOrder();
    }
  }

  const canSubmitAddFromBar =
    Boolean(selectedAddGuitarId && selectedAddGuitar && selectedAddPrices) &&
    addOptionsValid &&
    addUnitPrice != null &&
    addQty > 0 &&
    (canDirectModify || isInProductionFlow);

  return (
    <main className="flex flex-1 flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/orders"
            className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              {previewReadOnly && (
                <span className="mb-1 block text-amber-200/90">
                  Read-only preview — matches dealer view; changes are disabled.
                </span>
              )}
              Placed on{" "}
              {order.createdAt
                ? new Date(order.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Unknown date"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          {order.pendingOrmsbyRevisionReview && (
            <span className="rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-amber-900/30">
              Pending approval
            </span>
          )}
          {order.dealerPendingAdminProposedChanges && (
            <span className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-violet-900/30">
              Confirm updates
            </span>
          )}
          <span
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wide text-white ${
              STATUS_COLORS[order.status]
            }`}
          >
            {STATUS_LABELS[order.status]}
          </span>
          {order.pendingOrmsbyRevisionReview && (
            <p className="max-w-[14rem] text-[10px] leading-snug text-neutral-500">
              Ormsby is reviewing your latest changes. This clears when they approve.
            </p>
          )}
          {order.dealerPendingAdminProposedChanges && (
            <p className="max-w-[14rem] text-[10px] leading-snug text-neutral-500">
              Ormsby changed line items or pricing — please accept or request changes below.
            </p>
          )}
        </div>
      </div>

      {/* Ormsby proposed line/qty/pricing — dealer must confirm */}
      {!previewReadOnly && order.dealerPendingAdminProposedChanges && (
        <div className="rounded-2xl border border-violet-500/35 bg-violet-500/[0.12] p-5 shadow-lg shadow-violet-900/20">
          <h2 className="text-sm font-semibold text-violet-100">
            Ormsby updated your order — please confirm
          </h2>
          <p className="mt-2 max-w-3xl text-xs text-neutral-400">
            Review the line quantities and prices on this page. If everything looks right, accept the
            update. If something still needs to change, request changes and Ormsby will review again.
          </p>
          {order.adminProposedChangesNote && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
                Note from Ormsby
              </p>
              <p className="mt-1 text-sm text-neutral-200">{order.adminProposedChangesNote}</p>
            </div>
          )}
          {order.adminProposedChangesAt && (
            <p className="mt-3 text-[11px] text-neutral-500">
              Proposed:{" "}
              {new Date(order.adminProposedChangesAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void handleAcceptAdminProposal()}
              disabled={respondingToAdminProposal !== null}
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
            >
              {respondingToAdminProposal === "accept" ? "Saving…" : "Accept updated order"}
            </button>
            <button
              type="button"
              onClick={() => void handleRequestChangesAfterAdminProposal()}
              disabled={respondingToAdminProposal !== null}
              className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-6 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50"
            >
              {respondingToAdminProposal === "reject" ? "Sending…" : "Request changes"}
            </button>
          </div>
        </div>
      )}

      {/* Completed orders: send back to Ormsby for review */}
      {!previewReadOnly && order.status === "COMPLETED" && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.08] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-sky-100">
                Order completed — resubmit to Ormsby?
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-neutral-400">
                If you’ve added guitars or need Ormsby to review this order again, resubmit it. This
                sets the order to <span className="font-medium text-neutral-300">Submitted</span> so
                it appears in Ormsby&apos;s active queue. You can still use add requests below until
                you resubmit.
              </p>
              {order.resubmittedAt && (
                <p className="mt-2 text-[11px] text-neutral-500">
                  Last resubmitted:{" "}
                  {new Date(order.resubmittedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleResubmitOrderToOrmsby}
              disabled={resubmittingOrder}
              className="shrink-0 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-50"
            >
              {resubmittingOrder ? "Resubmitting…" : "Resubmit order to Ormsby"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Order Items - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {!previewReadOnly && hasDealerDirectNewLines && canDirectModify && (
            order.pendingOrmsbyRevisionReview ? (
              <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] p-5">
                <h3 className="text-sm font-semibold text-amber-100">
                  Updates submitted — awaiting Ormsby approval
                </h3>
                <p className="mt-2 text-xs text-neutral-400">
                  Your new guitars are on this order. Ormsby will review them; the order shows{" "}
                  <span className="font-medium text-amber-200/90">Pending approval</span> until then.
                </p>
                {order.dealerNotifiedOrmsbyOfUpdatesAt && (
                  <p className="mt-3 text-[11px] text-neutral-500">
                    Submitted:{" "}
                    {new Date(order.dealerNotifiedOrmsbyOfUpdatesAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.08] p-5">
                <h3 className="text-sm font-semibold text-emerald-100">
                  New guitars are already on this order
                </h3>
                <p className="mt-2 text-xs text-neutral-400">
                  Items with the green <span className="font-medium text-emerald-200/90">New</span>{" "}
                  badge are saved as soon as you add them.{" "}
                  <span className="font-medium text-neutral-300">Submit changes</span> in the sidebar
                  only applies to the guitar you&apos;re building in{" "}
                  <span className="text-neutral-300">Add another guitar</span> — not to lines already
                  listed above.
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  When you&apos;re done editing, submit for Ormsby review — you&apos;ll get a
                  confirmation page and this order will show as pending until approved.
                </p>
                <button
                  type="button"
                  onClick={() => void handleNotifyOrmsbyOfOrderUpdates()}
                  disabled={notifyingOrmsbyOfUpdates}
                  className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {notifyingOrmsbyOfUpdates ? "Sending…" : "Submit updated order to Ormsby"}
                </button>
                {order.dealerNotifiedOrmsbyOfUpdatesAt && (
                  <p className="mt-3 text-[11px] text-neutral-500">
                    Last submitted to Ormsby:{" "}
                    {new Date(order.dealerNotifiedOrmsbyOfUpdatesAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
            )
          )}

          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">Order Items</h2>

            {addRequestsForDealerBanner.length > 0 && (
              <div className="mb-6 space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <div>
                  <h3 className="text-sm font-semibold text-amber-100/95">
                    Guitars with Ormsby
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Models you asked to add after this order was in production. Ormsby reviews each
                    request before it appears as a line item.
                  </p>
                </div>
                <ul className="space-y-3">
                  {addRequestsForDealerBanner.map((req) => {
                    const g = guitarsMap.get(req.guitarId);
                    return (
                      <li
                        key={req.id}
                        className="rounded-xl border border-white/10 bg-black/25 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{req.name}</p>
                              {req.status === "PENDING" && (
                                <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                                  Pending approval
                                </span>
                              )}
                              {req.status === "REJECTED" && (
                                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
                                  Rejected
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-neutral-400">
                              SKU: {req.sku} · Qty: {req.qty}
                            </p>
                            {req.selectedOptions &&
                              Object.keys(req.selectedOptions).length > 0 && (
                                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {Object.entries(req.selectedOptions).map(([oid, vid]) => {
                                    const { optionLabel, valueLabel } = resolveLineOptionLabels(
                                      g,
                                      oid,
                                      vid,
                                    );
                                    return (
                                      <div key={oid} className="min-w-0 text-xs">
                                        <dt className="text-neutral-500">{optionLabel}</dt>
                                        <dd className="font-medium text-neutral-200">{valueLabel}</dd>
                                      </div>
                                    );
                                  })}
                                </dl>
                              )}
                            {req.status === "REJECTED" && req.rejectionReason && (
                              <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-xs text-red-100/90">
                                <span className="font-semibold text-red-200/95">Ormsby note: </span>
                                {req.rejectionReason}
                              </p>
                            )}
                          </div>
                          {req.status === "REJECTED" && (
                            <button
                              type="button"
                              disabled={
                                previewReadOnly ||
                                !canCreateAddRequest ||
                                resubmittingAddRequestId === req.id
                              }
                              onClick={() => handleResubmitRejectedAddRequest(req)}
                              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50"
                            >
                              {resubmittingAddRequestId === req.id
                                ? "Sending…"
                                : "Resubmit for approval"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {orderLines.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <p className="text-sm text-neutral-400">No items found in this order</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orderLines.map((line) => {
                  // Get guitar data for this line
                  const guitar = guitarsMap.get(line.guitarId);
                  
                  // Determine image URL: use option-specific image if available, otherwise base image
                  let imageUrl: string | null = null;
                  if (guitar) {
                    // Try to get image from selected options first
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
                    // Fall back to base image if no option image found
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
                          : "rounded-lg border border-white/10 bg-white/5 p-4"
                    }
                  >
                    <div className="flex gap-4">
                      {/* Guitar Thumbnail */}
                      {imageUrl && (
                        <Link
                          href={`/dealer/guitars/${line.guitarId}`}
                          className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-900 transition hover:opacity-80"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageUrl}
                            alt={line.name}
                            className="h-full w-full object-cover"
                          />
                        </Link>
                      )}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">{line.name}</h3>
                          {linePendingOrmsbyReview ? (
                            <span
                              className="rounded-full border border-amber-400/35 bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100"
                              title="Submitted for Ormsby review — awaiting approval"
                            >
                              Pending
                            </span>
                          ) : isNewAddition ? (
                            <span
                              className="rounded-full border border-emerald-400/30 bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200"
                              title="Added to this order after it was placed"
                            >
                              New
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">SKU: {line.sku}</p>
                        
                        {/* Selected Options */}
                        {line.selectedOptions && Object.keys(line.selectedOptions).length > 0 && (
                          <div
                            className={
                              linePendingOrmsbyReview
                                ? "mt-3 rounded-xl border border-amber-500/25 bg-black/20 p-4"
                                : isNewAddition
                                  ? "mt-3 rounded-xl border border-emerald-500/20 bg-black/20 p-4"
                                  : "mt-3 rounded-xl border border-white/10 bg-black/30 p-4"
                            }
                          >
                            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                              Configuration
                            </p>
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3">
                              {Object.entries(line.selectedOptions).map(
                                ([optionId, valueId]) => {
                                  const { optionLabel, valueLabel } = resolveLineOptionLabels(
                                    guitar,
                                    optionId,
                                    valueId,
                                  );
                                  return (
                                    <div key={optionId} className="min-w-0">
                                      <dt className="text-sm font-medium text-neutral-300">
                                        {optionLabel}
                                      </dt>
                                      <dd className="mt-1 text-base font-semibold leading-snug text-white">
                                        {valueLabel}
                                      </dd>
                                    </div>
                                  );
                                },
                              )}
                            </dl>
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                          <span className="text-sm text-neutral-400">
                            Quantity: <span className="font-semibold text-white">{line.qty}</span>
                          </span>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">
                              {order.currency === "USD" ? "$" : order.currency}{" "}
                              {line.lineTotal.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {order.currency === "USD" ? "$" : order.currency}{" "}
                              {line.unitPrice.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              each
                            </p>
                          </div>
                        </div>

                        {/* Remove / Request removal (partial qty) */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-400">Remove:</span>
                            <div className="flex items-center rounded border border-white/15 bg-white/5">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() => {
                                  const cur = removeQtyByLineId[line.id] ?? 1;
                                  setRemoveQtyByLineId((prev) => ({
                                    ...prev,
                                    [line.id]: Math.max(1, cur - 1),
                                  }));
                                }}
                                disabled={(removeQtyByLineId[line.id] ?? 1) <= 1}
                                className="flex h-8 w-8 items-center justify-center rounded-l border-r border-white/10 text-neutral-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                              >
                                −
                              </button>
                              <span className="min-w-[2rem] px-2 py-1 text-center text-xs font-medium tabular-nums text-white">
                                {removeQtyByLineId[line.id] ?? 1}
                              </span>
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                onClick={() => {
                                  const cur = removeQtyByLineId[line.id] ?? 1;
                                  setRemoveQtyByLineId((prev) => ({
                                    ...prev,
                                    [line.id]: Math.min(line.qty, cur + 1),
                                  }));
                                }}
                                disabled={(removeQtyByLineId[line.id] ?? 1) >= line.qty}
                                className="flex h-8 w-8 items-center justify-center rounded-r border-l border-white/10 text-neutral-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs text-neutral-500">units</span>
                          </div>

                          {(() => {
                            const hasPendingRemoval =
                              (pendingRemoveQtyByLineId[line.id] ?? 0) > 0;
                            if (canDirectModify) {
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveFromOrder(
                                      line,
                                      removeQtyByLineId[line.id] ?? 1,
                                    )
                                  }
                                  disabled={removeSubmitting}
                                  className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              );
                            }

                            if (isInProductionFlow) {
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestRemoveFromOrder(
                                      line,
                                      removeQtyByLineId[line.id] ?? 1,
                                    )
                                  }
                                  disabled={removeSubmitting || hasPendingRemoval}
                                  className="rounded-lg bg-yellow-500/20 px-3 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500/30 disabled:opacity-50"
                                >
                                  {hasPendingRemoval
                                    ? "Pending…"
                                    : "Request to remove"}
                                </button>
                              );
                            }

                            return (
                              <button
                                type="button"
                                disabled
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-400 disabled:opacity-50"
                              >
                                Removal unavailable
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Order Summary - 1/3 width */}
        <div className="space-y-6">
          {/* Add guitars — hidden in admin dealer preview (read-only) */}
          {!previewReadOnly && (
          <>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Add to order
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              <span className="font-medium text-neutral-400">Submit changes</span> adds the guitar you
              are configuring in <span className="text-neutral-400">Add another guitar</span> — not
              guitars already in the list above (those save as soon as you add them). Removals apply
              immediately when you use Remove.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={addSubmitting || !canSubmitAddFromBar}
                onClick={() => void handleSubmitChangesFromBar()}
                className="order-1 flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40 sm:order-none sm:min-w-[140px]"
              >
                {addSubmitting ? "Working…" : "Submit changes"}
              </button>
              <button
                type="button"
                disabled={addSubmitting}
                onClick={handleDiscardAddFormUpdates}
                className="order-2 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 sm:order-none sm:min-w-[160px]"
              >
                Do not save updates
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Add another guitar
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              {canDirectModify
                ? "Choose a model, set options and quantity, then add to this order."
                : "This order is in production. Pick a model and send a request — Ormsby will approve or adjust it."}
            </p>

            <ol className="mt-4 flex flex-wrap gap-2 text-[11px] text-neutral-500">
              <li className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
                <span className="font-semibold text-accent-soft">1</span> Find model
              </li>
              <li className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
                <span className="font-semibold text-accent-soft">2</span> Options &amp; qty
              </li>
              <li className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
                <span className="font-semibold text-accent-soft">3</span>{" "}
                {canDirectModify ? "Add to order" : "Send request"}
              </li>
            </ol>

            <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
              <div>
                <label
                  htmlFor="order-add-guitar-search"
                  className="mb-1.5 block text-sm font-medium text-neutral-200"
                >
                  Find a model
                </label>
                <p className="mb-2 text-xs text-neutral-500">
                  Type part of the name, SKU, or series. Leave empty to see a short list of available models.
                </p>
                <input
                  id="order-add-guitar-search"
                  type="search"
                  autoComplete="off"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="e.g. Hype, DC, Run 19…"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {catalogLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-400">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  Loading models from the catalog…
                </div>
              ) : catalogGuitars.length === 0 ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
                  {catalogError ? (
                    <>
                      <p className="font-medium text-amber-100/95">
                        Couldn&apos;t load models (connection or permission issue).
                      </p>
                      <p className="mt-2 font-mono text-[11px] leading-relaxed text-neutral-500 break-all">
                        {catalogError}
                      </p>
                    </>
                  ) : (
                    <p className="font-medium text-amber-100/95">
                      No active guitars are available in the catalog right now.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-neutral-400">
                    You can still add from the full catalog — pick a guitar there, or refresh this page.
                  </p>
                  <Link
                    href="/dealer"
                    className="mt-3 inline-flex text-sm font-semibold text-accent hover:text-accent-soft"
                  >
                    Browse full guitar catalog →
                  </Link>
                </div>
              ) : (
                (() => {
                  const termRaw = catalogSearch.trim();
                  const term = termRaw.toLowerCase();
                  const allMatching = catalogGuitars.filter((g) => {
                    if (!term) return true;
                    return (
                      g.name.toLowerCase().includes(term) ||
                      g.sku.toLowerCase().includes(term) ||
                      (g.series ?? "").toLowerCase().includes(term)
                    );
                  });
                  const maxShow = term ? 12 : 9;
                  const filtered = allMatching.slice(0, maxShow);
                  const totalMatch = allMatching.length;

                  if (term && filtered.length === 0) {
                    return (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm text-neutral-300">
                          No models match <span className="font-medium text-white">&quot;{termRaw}&quot;</span>.
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Check spelling, try a shorter word, or clear the search to browse the list.
                        </p>
                        <button
                          type="button"
                          onClick={() => setCatalogSearch("")}
                          className="mt-3 text-sm font-semibold text-accent hover:text-accent-soft"
                        >
                          Clear search
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                        <span>
                          {term ? (
                            <>
                              {totalMatch === 0
                                ? "No results"
                                : `Showing ${filtered.length} of ${totalMatch} match${totalMatch !== 1 ? "es" : ""}`}
                            </>
                          ) : (
                            <>Showing {filtered.length} models — search to narrow down</>
                          )}
                        </span>
                        <Link
                          href="/dealer"
                          className="shrink-0 font-medium text-accent hover:text-accent-soft"
                        >
                          Full catalog
                        </Link>
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        Tap a row to select. Selected model is highlighted in orange.
                      </p>
                      <ul className="flex flex-col gap-2" role="listbox" aria-label="Guitar models">
                        {filtered.map((g) => (
                          <li key={g.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selectedAddGuitarId === g.id}
                              onClick={() => {
                                setSelectedAddGuitarId(g.id);
                                setSelectedAddOptions({});
                                setAddQty(1);
                              }}
                              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                                selectedAddGuitarId === g.id
                                  ? "border-accent bg-accent/15 ring-1 ring-accent/40"
                                  : "border-white/10 bg-black/25 hover:border-white/25 hover:bg-white/5"
                              }`}
                            >
                              {g.images?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={g.images[0]}
                                  alt=""
                                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover bg-neutral-900"
                                />
                              ) : (
                                <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-neutral-800" />
                              )}
                              <div className="min-w-0 flex-1">
                                {g.series ? (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-soft/90">
                                    {g.series}
                                  </span>
                                ) : null}
                                <div className="truncate text-sm font-semibold text-white">{g.name}</div>
                                <div className="truncate text-xs text-neutral-500">SKU {g.sku}</div>
                              </div>
                              <span className="shrink-0 text-xs font-medium text-accent">
                                {selectedAddGuitarId === g.id ? "Selected" : "Select"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {totalMatch > maxShow && (
                        <p className="text-xs text-neutral-500">
                          Type more in the search box to narrow results — only the first {maxShow} are shown here.
                        </p>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {selectedAddGuitar && (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[11px] text-accent">
                    2
                  </span>
                  Configure &amp; add
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-neutral-500">
                        {selectedAddGuitar.series}
                      </p>
                      <p className="text-base font-semibold text-white">{selectedAddGuitar.name}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        Built SKU:{" "}
                        <span className="font-mono text-neutral-300">
                          {buildFinalSku(selectedAddGuitar, selectedAddOptions)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAddGuitarId(null)}
                      className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-white/25 hover:bg-white/10"
                    >
                      Change model
                    </button>
                  </div>
                </div>

                {selectedAddGuitar.options && selectedAddGuitar.options.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-neutral-400">Required options</p>
                    {selectedAddGuitar.options.map((opt) => (
                      <OptionSelector
                        key={opt.optionId}
                        option={opt}
                        value={selectedAddOptions[opt.optionId] ?? null}
                        onChange={(valueId) =>
                          setSelectedAddOptions((prev) => ({
                            ...prev,
                            [opt.optionId]: valueId,
                          }))
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">This model has no extra options to choose.</p>
                )}

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <label
                    htmlFor="order-add-qty"
                    className="text-sm font-medium text-neutral-200"
                  >
                    How many?
                  </label>
                  <input
                    id="order-add-qty"
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="w-24 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-center text-sm text-white outline-none transition focus:border-accent"
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Unit price</span>
                    <span className="font-semibold text-white">
                      {addUnitPrice == null
                        ? "—"
                        : `${order.currency === "USD" ? "$" : order.currency} ${addUnitPrice.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Line total</span>
                    <span className="font-semibold text-white">
                      {addUnitPrice == null
                        ? "—"
                        : `${order.currency === "USD" ? "$" : order.currency} ${addTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Dealer price uses your discount: RRP × (1 − discount%).
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    addSubmitting ||
                    !addOptionsValid ||
                    addUnitPrice == null ||
                    (!canDirectModify && !isInProductionFlow)
                  }
                  onClick={() => {
                    if (canDirectModify) {
                      handleAddToOrder();
                    } else {
                      handleRequestAddToOrder();
                    }
                  }}
                  className={`w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition ${
                    canDirectModify
                      ? "bg-accent text-black hover:bg-accent-soft disabled:opacity-50"
                      : "bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30 disabled:opacity-50"
                  }`}
                >
                  {addSubmitting
                    ? "Working…"
                    : canDirectModify
                      ? "Add to this order"
                      : "Send request to add"}
                </button>
              </div>
            )}
          </div>
          </>
          )}

          {/* Order Summary */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Order Summary
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="font-medium text-white">
                  {order.currency === "USD" ? "$" : order.currency}{" "}
                  {order.totals.subtotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {totalGuitars > 0 && (
                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Deposit Required</span>
                    <span className="font-semibold text-accent">
                      {order.currency === "USD" ? "$" : order.currency}{" "}
                      {depositRequired.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    $200 per guitar deposit required
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Shipping Address
            </h2>
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

          {/* Order Details */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Order Details
            </h2>
            <div className="space-y-3 text-sm">
              {order.poNumber && (
                <div>
                  <p className="text-neutral-400">PO Number</p>
                  <p className="font-medium text-white">{order.poNumber}</p>
                </div>
              )}
              {order.notes && (
                <div>
                  <p className="text-neutral-400">Notes</p>
                  <p className="text-neutral-300">{order.notes}</p>
                </div>
              )}
              <div>
                <p className="text-neutral-400">Order ID</p>
                <p className="font-mono text-xs text-neutral-300">{order.id}</p>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Terms & Conditions
            </h2>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>
                A deposit of $200 per guitar is required. Invoice will be sent separately from Ormsby Guitars.
              </p>
              <p>
                Final pricing, shipping, and taxes will be confirmed by Ormsby on your order confirmation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

