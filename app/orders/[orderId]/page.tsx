"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, use } from "react";
import { doc, getDoc, collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, OrderLineDoc, OrderStatus, GuitarDoc } from "@/lib/types";
import Link from "next/link";

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
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [orderId, user, authLoading, router]);

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

  const totalGuitars = orderLines.reduce((sum, line) => sum + line.qty, 0);
  const depositRequired = totalGuitars * 200;

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

