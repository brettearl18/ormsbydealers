import Link from "next/link";
import { OrderDoc } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  IN_PRODUCTION: "In Production",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-neutral-700",
  SUBMITTED: "bg-blue-600",
  APPROVED: "bg-green-600",
  IN_PRODUCTION: "bg-yellow-600",
  SHIPPED: "bg-purple-600",
  COMPLETED: "bg-green-700",
  CANCELLED: "bg-red-600",
};

interface Props {
  orders: Array<OrderDoc & { id: string }>;
  currency: string;
  isLoading?: boolean;
  accountName?: string;
}

export function RecentOrdersList({ orders, currency, isLoading, accountName }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-neutral-800"
          />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 p-6 text-center">
        <p className="text-sm text-neutral-400">No orders yet</p>
        <Link
          href="/dealer"
          className="mt-2 inline-block text-xs text-accent-soft hover:text-accent"
        >
          Browse guitars →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.slice(0, 5).map((order) => (
        <Link
          key={order.id}
          href={`/orders/${order.id}`}
          className="group block overflow-hidden rounded-2xl border border-white/10 glass p-4 transition-all duration-300 hover:border-accent/30 hover:scale-[1.02] hover:shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white">
                  #{order.id.slice(0, 8).toUpperCase()}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white ${
                    STATUS_COLORS[order.status] || "bg-neutral-700"
                  }`}
                >
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </div>
              {accountName && (
                <p className="mt-1 text-xs text-neutral-500">
                  {accountName}
                </p>
              )}
              <p className="mt-1 text-xs text-neutral-400">
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Unknown date"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">
                {currency === "USD" ? "$" : currency}{" "}
                {order.totals.subtotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </Link>
      ))}
      {orders.length > 5 && (
        <Link
          href="/orders"
          className="block rounded-2xl border border-white/10 glass p-4 text-center text-xs font-semibold text-neutral-400 transition-all duration-300 hover:border-accent/30 hover:text-accent-soft hover:scale-105"
        >
          View all orders ({orders.length}) →
        </Link>
      )}
    </div>
  );
}

