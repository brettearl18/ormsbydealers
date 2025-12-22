"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, OrderStatus } from "@/lib/types";
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

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
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

    async function fetchOrders() {
      setFetching(true);
      setError(null);
      try {
        const ordersRef = collection(db, "orders");
        const q = query(
          ordersRef,
          where("accountId", "==", user.accountId),
          orderBy("createdAt", "desc"),
        );
        const snap = await getDocs(q);
        const ordersData = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamps to ISO strings
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
          };
        }) as Array<OrderDoc & { id: string }>;
        setOrders(ordersData);
      } catch (err) {
        console.error(err);
        setError("Unable to load orders");
      } finally {
        setFetching(false);
      }
    }

    fetchOrders();
  }, [user, authLoading, router]);

  if (authLoading || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading orders…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="flex flex-1 flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Your orders</h1>
          <p className="mt-2 text-sm text-neutral-400">
            View and track your purchase orders
          </p>
        </div>
        {orders.length > 0 && (
          <div className="hidden sm:block">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <p className="text-sm font-semibold text-white">
                {orders.length} {orders.length === 1 ? "order" : "orders"}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl bg-surface/80 p-12 text-center">
          <p className="text-sm text-neutral-400">No orders yet</p>
          <Link
            href="/dealer"
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-black shadow-soft transition hover:bg-accent-soft"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const formattedDate = order.createdAt
              ? new Date(order.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Unknown date";

            return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="group block rounded-2xl border border-white/10 bg-white/5 p-6 shadow-soft transition-all hover:border-accent/30 hover:bg-white/10 hover:shadow-lg hover:shadow-accent/10"
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex flex-1 items-center gap-6">
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm ${
                          STATUS_COLORS[order.status]
                        }`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="font-medium text-neutral-300">{formattedDate}</span>
                      </div>
                      {order.poNumber && (
                        <div className="flex items-center gap-1.5">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span className="text-neutral-500">PO: {order.poNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total Amount */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-white">
                      {order.currency === "USD" ? "$" : order.currency}{" "}
                      {order.totals.subtotal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-neutral-400">
                      <svg
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

