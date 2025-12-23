"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, use } from "react";
import { doc, getDoc, collection, getDocs, updateDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { OrderDoc, OrderLineDoc, OrderStatus } from "@/lib/types";
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

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<(OrderDoc & { id: string }) | null>(null);
  const [orderLines, setOrderLines] = useState<Array<OrderLineDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [etaDate, setEtaDate] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingEta, setUpdatingEta] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

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
          <div className="flex items-center gap-2">
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
                {orderLines.map((line) => (
                  <div
                    key={line.id}
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{line.name}</h3>
                        <p className="mt-1 text-xs text-neutral-400">SKU: {line.sku}</p>
                        {line.selectedOptions && Object.keys(line.selectedOptions).length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-neutral-400">
                            {Object.entries(line.selectedOptions).map(([key, value]) => (
                              <div key={key}>
                                <span className="capitalize">{key}:</span> {value}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          Qty: {line.qty}
                        </p>
                        <p className="text-xs text-neutral-400">
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
                ))}
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

