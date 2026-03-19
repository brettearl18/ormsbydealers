"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, use, useMemo } from "react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
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
  const router = useRouter();
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
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedAddGuitarId, setSelectedAddGuitarId] = useState<string | null>(null);
  const [selectedAddOptions, setSelectedAddOptions] = useState<Record<string, string>>({});
  const [addQty, setAddQty] = useState(1);
  const [selectedAddPrices, setSelectedAddPrices] = useState<PricesDoc | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // --- Remove guitar section state ---
  const [removeQtyByLineId, setRemoveQtyByLineId] = useState<Record<string, number>>({});
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user?.accountId) {
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

        // Verify the order belongs to the user's account
        if (!user?.accountId || orderData.accountId !== user.accountId) {
          setError("You don't have permission to view this order");
          setFetching(false);
          return;
        }

        setOrder(orderData);

        // Fetch account (for discount %) and any pending add/remove requests
        const [acctSnap, addReqSnap, removeReqSnap] = await Promise.all([
          getDoc(doc(db, "accounts", user.accountId)),
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

        // Fetch guitar data for all unique guitars in order lines
        const uniqueGuitarIds = Array.from(new Set(linesData.map((line) => line.guitarId)));
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
  }, [orderId, user, authLoading, router, refreshToken]);

  // Fetch a small catalog for "search and select guitar" when editing orders.
  useEffect(() => {
    if (!user?.accountId) return;

    let cancelled = false;
    async function run() {
      setCatalogLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "guitars"),
            where("status", "==", "ACTIVE"),
            orderBy("name"),
            limit(60),
          ),
        );
        if (cancelled) return;

        setCatalogGuitars(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as GuitarDoc),
          })),
        );
      } catch (err) {
        console.error("Error fetching catalog for order edit:", err);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.accountId]);

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

  const selectedAddGuitar = useMemo(() => {
    if (!selectedAddGuitarId) return null;
    return (
      catalogGuitars.find((g) => g.id === selectedAddGuitarId) ?? null
    );
  }, [catalogGuitars, selectedAddGuitarId]);

  const discountPercent = account?.discountPercent ?? 0;
  const canDirectModify =
    order?.status === "DRAFT" ||
    order?.status === "SUBMITTED" ||
    order?.status === "APPROVED";
  const isInProductionFlow =
    order?.status === "IN_PRODUCTION" ||
    order?.status === "SHIPPED" ||
    order?.status === "COMPLETED";

  const addRrp = useMemo(() => {
    if (!selectedAddPrices || !selectedAddGuitar) return null;
    return getRRPForVariant(
      selectedAddPrices,
      selectedAddGuitar.options ?? null,
      selectedAddOptions,
    );
  }, [selectedAddPrices, selectedAddGuitar, selectedAddOptions]);

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
        <span
          className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wide text-white ${
            STATUS_COLORS[order.status]
          }`}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Order Items - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">Order Items</h2>
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

                  return (
                  <div
                    key={line.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-4"
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
                        <h3 className="font-semibold text-white">{line.name}</h3>
                        <p className="mt-1 text-xs text-neutral-400">SKU: {line.sku}</p>
                        
                        {/* Selected Options */}
                        {line.selectedOptions && Object.keys(line.selectedOptions).length > 0 && (
                          <div className="mt-3 space-y-1.5 rounded-lg border border-white/5 bg-black/20 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                              Configuration
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {Object.entries(line.selectedOptions).map(
                                ([optionId, valueId]) => (
                                  <div
                                    key={optionId}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="text-neutral-400 capitalize">
                                      {optionId.replace(/([A-Z])/g, " $1").trim()}:
                                    </span>
                                    <span className="font-medium text-white">{valueId}</span>
                                  </div>
                                ),
                              )}
                            </div>
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
                            <input
                              type="number"
                              min={1}
                              max={line.qty}
                              value={removeQtyByLineId[line.id] ?? 1}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val)) return;
                                setRemoveQtyByLineId((prev) => ({
                                  ...prev,
                                  [line.id]: Math.max(1, Math.min(line.qty, val)),
                                }));
                              }}
                              className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-accent"
                            />
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
          {/* Add guitars */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Add guitars to this order
            </h2>

            <p className="mb-4 text-xs text-neutral-500">
              {canDirectModify
                ? "Search, select, configure, and add items."
                : "This order is in production. You must request additions for approval."}
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Search
              </label>
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search by name or SKU…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:bg-white/10"
              />

              {catalogLoading ? (
                <p className="text-xs text-neutral-400">Loading catalog…</p>
              ) : (
                (() => {
                  const term = catalogSearch.trim().toLowerCase();
                  const filtered = catalogGuitars
                    .filter((g) => {
                      if (!term) return true;
                      return (
                        g.name.toLowerCase().includes(term) ||
                        g.sku.toLowerCase().includes(term) ||
                        (g.series ?? "").toLowerCase().includes(term)
                      );
                    })
                    .slice(0, 6);

                  if (filtered.length === 0) {
                    return (
                      <p className="text-xs text-neutral-500">No guitars found.</p>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-2">
                      {filtered.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedAddGuitarId(g.id);
                            setSelectedAddOptions({});
                            setAddQty(1);
                          }}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                            selectedAddGuitarId === g.id
                              ? "border-accent bg-accent/15"
                              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                          }`}
                        >
                          {g.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={g.images[0]}
                              alt={g.name}
                              className="h-10 w-10 flex-shrink-0 rounded-lg object-cover bg-neutral-900"
                            />
                          ) : (
                            <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-neutral-900" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">
                              {g.name}
                            </div>
                            <div className="truncate text-[11px] text-neutral-500">
                              SKU: {g.sku}
                            </div>
                          </div>
                          <div className="text-xs text-neutral-400">
                            Select →
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>

            {selectedAddGuitar && (
              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        {selectedAddGuitar.series}
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {selectedAddGuitar.name}
                      </p>
                      <p className="text-xs text-neutral-400">
                        SKU: {buildFinalSku(selectedAddGuitar, selectedAddOptions)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAddGuitarId(null)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-300 hover:border-white/20 hover:bg-white/10"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {selectedAddGuitar.options && selectedAddGuitar.options.length > 0 ? (
                  <div className="space-y-3">
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
                  <p className="text-xs text-neutral-500">No options for this guitar.</p>
                )}

                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none transition focus:border-accent"
                  />
                </div>

                <div className="space-y-1 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Unit price</span>
                    <span className="text-white font-semibold">
                      {addUnitPrice == null
                        ? "—"
                        : `${order.currency === "USD" ? "$" : order.currency} ${addUnitPrice.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Total</span>
                    <span className="text-white font-semibold">
                      {addUnitPrice == null
                        ? "—"
                        : `${order.currency === "USD" ? "$" : order.currency} ${addTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Dealer price = RRP × (1 − discount%).
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
                  className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${
                    canDirectModify
                      ? "bg-accent text-black hover:bg-accent-soft disabled:opacity-50"
                      : "bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30 disabled:opacity-50"
                  }`}
                >
                  {addSubmitting
                    ? "Working…"
                    : canDirectModify
                      ? "Add to order"
                      : "Request to add"}
                </button>
              </div>
            )}
          </div>

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

