"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, OrderStatus, OrderLineDoc, GuitarDoc } from "@/lib/types";
import Link from "next/link";
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
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

interface GuitarOrderSummary {
  guitarId: string;
  sku: string;
  name: string;
  totalQty: number;
  variations: Array<{
    selectedOptions: Record<string, string>;
    selectedOptionsLabels: Record<string, string>; // optionId -> label
    qty: number;
    orders: string[];
  }>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [orderLines, setOrderLines] = useState<Map<string, Array<OrderLineDoc & { id: string }>>>(new Map());
  const [guitarsMap, setGuitarsMap] = useState<Map<string, GuitarDoc>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [showReport, setShowReport] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<OrderStatus[]>(["SUBMITTED", "APPROVED", "IN_PRODUCTION"]);

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

      // Fetch all order lines and guitar data
      const linesMap = new Map<string, Array<OrderLineDoc & { id: string }>>();
      const guitarIds = new Set<string>();

      for (const order of ordersData) {
        const linesRef = collection(db, "orders", order.id, "lines");
        const linesSnap = await getDocs(linesRef);
        const lines = linesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<OrderLineDoc & { id: string }>;
        linesMap.set(order.id, lines);

        // Collect guitar IDs
        lines.forEach((line) => guitarIds.add(line.guitarId));
      }

      setOrderLines(linesMap);

      // Fetch all guitar data
      const guitars = new Map<string, GuitarDoc>();
      for (const guitarId of guitarIds) {
        const guitarDoc = await getDoc(doc(db, "guitars", guitarId));
        if (guitarDoc.exists()) {
          guitars.set(guitarId, guitarDoc.data() as GuitarDoc);
        }
      }
      setGuitarsMap(guitars);
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

  // Filter orders for report
  const reportOrders = orders.filter((order) => 
    reportStatusFilter.includes(order.status)
  );

  // Generate manufacturer report - aggregate guitars from orders
  const generateManufacturerReport = (): GuitarOrderSummary[] => {
    // Aggregate guitars from all order lines
    const guitarSummary = new Map<string, GuitarOrderSummary>();

    for (const order of reportOrders) {
      const lines = orderLines.get(order.id) || [];
      
      for (const line of lines) {
        const guitar = guitarsMap.get(line.guitarId);
        const key = `${line.guitarId}-${JSON.stringify(line.selectedOptions || {})}`;
        
        if (!guitarSummary.has(key)) {
          guitarSummary.set(key, {
            guitarId: line.guitarId,
            sku: line.sku,
            name: line.name,
            totalQty: 0,
            variations: [],
          });
        }

        const summary = guitarSummary.get(key)!;
        summary.totalQty += line.qty;

        // Track variations
        const optionsKey = JSON.stringify(line.selectedOptions || {});
        const existingVariation = summary.variations.find(
          (v) => JSON.stringify(v.selectedOptions) === optionsKey
        );

        if (existingVariation) {
          existingVariation.qty += line.qty;
          if (!existingVariation.orders.includes(order.id)) {
            existingVariation.orders.push(order.id);
          }
          // Update labels if not already set
          if (Object.keys(existingVariation.selectedOptionsLabels).length === 0 && guitar?.options && line.selectedOptions) {
            for (const [optionId, valueId] of Object.entries(line.selectedOptions)) {
              const option = guitar.options.find((opt) => opt.optionId === optionId);
              if (option) {
                const value = option.values.find((val) => val.valueId === valueId);
                if (value) {
                  existingVariation.selectedOptionsLabels[optionId] = `${option.label}: ${value.label}`;
                }
              }
            }
          }
        } else {
          // Map option IDs and value IDs to their labels
          const selectedOptionsLabels: Record<string, string> = {};
          if (guitar?.options && line.selectedOptions) {
            for (const [optionId, valueId] of Object.entries(line.selectedOptions)) {
              const option = guitar.options.find((opt) => opt.optionId === optionId);
              if (option) {
                const value = option.values.find((val) => val.valueId === valueId);
                if (value) {
                  selectedOptionsLabels[optionId] = `${option.label}: ${value.label}`;
                }
              }
            }
          }

          summary.variations.push({
            selectedOptions: line.selectedOptions || {},
            selectedOptionsLabels,
            qty: line.qty,
            orders: [order.id],
          });
        }
      }
    }

    // Convert to array and sort by total quantity (descending)
    return Array.from(guitarSummary.values()).sort((a, b) => b.totalQty - a.totalQty);
  };

  const manufacturerReport = generateManufacturerReport();

  // Helper function to format variation string with labels, prioritizing colors
  const formatVariationString = (variation: GuitarOrderSummary["variations"][0], guitar?: GuitarDoc): string => {
    if (Object.keys(variation.selectedOptionsLabels).length === 0) {
      return "Base";
    }

    // Sort options to prioritize colors
    const sortedLabels = Object.entries(variation.selectedOptionsLabels).sort(([optionIdA], [optionIdB]) => {
      const isColorA = optionIdA.toLowerCase().includes("color") || optionIdA.toLowerCase().includes("colour");
      const isColorB = optionIdB.toLowerCase().includes("color") || optionIdB.toLowerCase().includes("colour");
      if (isColorA && !isColorB) return -1;
      if (!isColorA && isColorB) return 1;
      return 0;
    });

    return sortedLabels.map(([, label]) => label).join(", ");
  };

  // Export report as CSV
  const exportReportAsCSV = () => {
    const headers = ["SKU", "Guitar Name", "Variation", "Quantity", "Orders"];
    const rows = manufacturerReport.flatMap((guitar) => {
      const guitarDoc = guitarsMap.get(guitar.guitarId);
      if (guitar.variations.length === 0) {
        return [[guitar.sku, guitar.name, "Base", guitar.totalQty, ""]];
      }
      return guitar.variations.map((variation) => {
        const variationStr = formatVariationString(variation, guitarDoc);
        return [
          guitar.sku,
          guitar.name,
          variationStr || "Base",
          variation.qty.toString(),
          variation.orders.length.toString(),
        ];
      });
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `manufacturer-report-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <button
            onClick={() => setShowReport(!showReport)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-accent/30 hover:bg-white/10"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            {showReport ? "Hide" : "Show"} Manufacturer Report
          </button>
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

        {/* Manufacturer Report */}
        {showReport && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Manufacturer Report</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Aggregated guitar quantities from all orders for manufacturing
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-neutral-400">Include Status:</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => {
                      const isSelected = reportStatusFilter.includes(status as OrderStatus);
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setReportStatusFilter(reportStatusFilter.filter((s) => s !== status));
                            } else {
                              setReportStatusFilter([...reportStatusFilter, status as OrderStatus]);
                            }
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            isSelected
                              ? "bg-accent text-black"
                              : "border border-white/10 bg-white/5 text-white hover:border-accent/30"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={exportReportAsCSV}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent-soft"
                >
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-accent/30 hover:bg-white/10"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print
                </button>
              </div>
            </div>

            {manufacturerReport.length === 0 ? (
              <div className="rounded-lg border border-white/5 bg-black/20 p-8 text-center">
                <p className="text-sm text-neutral-400">No guitars found in selected orders</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-white/10 bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Guitar Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Variation
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {manufacturerReport.map((guitar, idx) => (
                      <tr key={`${guitar.guitarId}-${idx}`} className="transition hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-sm font-medium text-white">
                          {guitar.sku}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{guitar.name}</td>
                        <td className="px-4 py-3 text-sm text-neutral-300">
                          {guitar.variations.length === 0 ? (
                            <span className="text-neutral-500">Base</span>
                          ) : (
                            <div className="space-y-1">
                              {guitar.variations.map((variation, vIdx) => {
                                const guitarDoc = guitarsMap.get(guitar.guitarId);
                                const variationStr = formatVariationString(variation, guitarDoc);
                                return (
                                  <div key={vIdx} className="text-xs">
                                    {variationStr || "Base"}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {guitar.variations.length === 0 ? (
                            <span className="text-lg font-bold text-accent">{guitar.totalQty}</span>
                          ) : (
                            <div className="space-y-1 text-right">
                              {guitar.variations.map((variation, vIdx) => (
                                <div key={vIdx} className="text-sm font-semibold text-white">
                                  {variation.qty}
                                </div>
                              ))}
                              <div className="border-t border-white/10 pt-1 text-xs font-bold text-accent">
                                Total: {guitar.totalQty}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-neutral-400">
                          {guitar.variations.length === 0 ? (
                            <span>{reportOrders.filter((o) => orderLines.get(o.id)?.some((l) => l.guitarId === guitar.guitarId)).length}</span>
                          ) : (
                            <div className="space-y-1">
                              {guitar.variations.map((variation, vIdx) => (
                                <div key={vIdx} className="text-xs">
                                  {variation.orders.length}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-white/10 bg-white/5">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-white">
                        Total Quantity:
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xl font-bold text-accent">
                          {manufacturerReport.reduce((sum, g) => sum + g.totalQty, 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

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

