"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, OrderStatus } from "@/lib/types";
import Link from "next/link";
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

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
  DRAFT: "bg-neutral-500/20 text-neutral-400",
  SUBMITTED: "bg-blue-500/20 text-blue-400",
  APPROVED: "bg-green-500/20 text-green-400",
  IN_PRODUCTION: "bg-yellow-500/20 text-yellow-400",
  SHIPPED: "bg-purple-500/20 text-purple-400",
  COMPLETED: "bg-green-600/20 text-green-500",
  CANCELLED: "bg-red-500/20 text-red-400",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    try {
      const ordersQuery = query(
        collection(db, "orders"),
        orderBy("createdAt", "desc")
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersData = ordersSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
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
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate statistics
  const stats = {
    total: orders.length,
    totalValue: orders.reduce((sum, order) => sum + order.totals.subtotal, 0),
    byStatus: {
      DRAFT: orders.filter((o) => o.status === "DRAFT").length,
      SUBMITTED: orders.filter((o) => o.status === "SUBMITTED").length,
      APPROVED: orders.filter((o) => o.status === "APPROVED").length,
      IN_PRODUCTION: orders.filter((o) => o.status === "IN_PRODUCTION").length,
      SHIPPED: orders.filter((o) => o.status === "SHIPPED").length,
      COMPLETED: orders.filter((o) => o.status === "COMPLETED").length,
      CANCELLED: orders.filter((o) => o.status === "CANCELLED").length,
    },
    pending: orders.filter((o) => o.status === "SUBMITTED" || o.status === "APPROVED").length,
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchTerm === "" ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shippingAddress?.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.poNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Group orders by currency for total value calculation
  const totalByCurrency = filteredOrders.reduce((acc, order) => {
    const currency = order.currency || "USD";
    if (!acc[currency]) {
      acc[currency] = 0;
    }
    acc[currency] += order.totals.subtotal;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Manage Orders
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              View all orders, reports, and total values
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total Orders
              </p>
              <DocumentTextIcon className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {stats.pending} pending approval
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total Value
              </p>
              <CurrencyDollarIcon className="h-5 w-5 text-accent" />
            </div>
            <div className="space-y-1">
              {Object.entries(totalByCurrency).map(([currency, value]) => (
                <p key={currency} className="text-2xl font-bold text-accent">
                  {currency === "USD" ? "$" : currency}{" "}
                  {value.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              ))}
              {Object.keys(totalByCurrency).length === 0 && (
                <p className="text-2xl font-bold text-neutral-400">$0.00</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Pending
              </p>
              <CalendarIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="mt-1 text-xs text-neutral-400">
              Awaiting action
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Completed
              </p>
              <DocumentTextIcon className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-green-400">
              {stats.byStatus.COMPLETED}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {stats.total > 0
                ? Math.round((stats.byStatus.COMPLETED / stats.total) * 100)
                : 0}% of total
            </p>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Order Status Breakdown</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {Object.entries(STATUS_LABELS).map(([status, label]) => {
              const count = stats.byStatus[status as OrderStatus];
              return (
                <div key={status} className="text-center">
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="mt-1 text-xs text-neutral-400">{label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by order ID, company, or PO number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-10 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent focus:bg-white/10"
            />
          </div>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "ALL")}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none transition focus:border-accent focus:bg-white/10"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-neutral-400">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-neutral-600" />
            <p className="mt-4 text-sm text-neutral-400">
              {orders.length === 0
                ? "No orders found"
                : "No orders match your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="group block rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:border-accent/30 hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white group-hover:text-accent transition-colors">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          STATUS_COLORS[order.status]
                        }`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-neutral-500" />
                        <span>
                          {new Date(order.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {order.shippingAddress?.company && (
                        <div>
                          <span className="text-neutral-500">Company:</span>{" "}
                          <span className="font-medium text-white">
                            {order.shippingAddress.company}
                          </span>
                        </div>
                      )}
                      {order.poNumber && (
                        <div>
                          <span className="text-neutral-500">PO:</span>{" "}
                          <span className="font-medium text-white">{order.poNumber}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-neutral-500">Currency:</span>{" "}
                        <span className="font-medium text-white">{order.currency}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-accent">
                      {order.currency === "USD" ? "$" : order.currency}{" "}
                      {order.totals.subtotal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">Total value</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AdminGuard>
  );
}

