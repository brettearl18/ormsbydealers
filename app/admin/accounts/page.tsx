"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccountDoc, OrderDoc, OrderStatus } from "@/lib/types";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  DocumentArrowUpIcon,
  CalendarIcon,
  BellIcon,
  UserGroupIcon,
  MagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

interface AccountWithUsers extends AccountDoc {
  id: string;
  status?: "PENDING" | "APPROVED" | "SUSPENDED";
  requestDate?: string;
  users?: Array<{
    uid: string;
    email: string;
    name: string;
  }>;
}

function ManageAccountsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountWithUsers[]>([]);
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"accounts" | "orders" | "notifications">(
    (tabParam === "orders" || tabParam === "notifications" ? tabParam : "accounts") as "accounts" | "orders" | "notifications"
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [accountsSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, "accounts"), orderBy("name"))),
        getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), where("status", "!=", "CANCELLED"))),
      ]);

      const accountsData = accountsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        status: "APPROVED" as const, // Default status, can be extended
      })) as AccountWithUsers[];

      const ordersData = ordersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<OrderDoc & { id: string }>;

      setAccounts(accountsData);
      setOrders(ordersData);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function approveAccount(accountId: string) {
    try {
      // Update account status
      await updateDoc(doc(db, "accounts", accountId), {
        status: "APPROVED",
        approvedAt: new Date().toISOString(),
      });
      await fetchData();
    } catch (err) {
      console.error("Error approving account:", err);
      alert("Failed to approve account");
    }
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status,
        updatedAt: new Date().toISOString(),
      });
      await fetchData();
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Failed to update order status");
    }
  }

  const filteredAccounts = accounts.filter((account) =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingOrders = orders.filter((o) => o.status === "SUBMITTED" || o.status === "APPROVED");

  return (
      <main className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Manage Dealers
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Approve requests, manage orders, and send notifications
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "accounts"
                ? "border-b-2 border-accent text-accent"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <UserGroupIcon className="mr-2 inline h-4 w-4" />
            Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "orders"
                ? "border-b-2 border-accent text-accent"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <DocumentArrowUpIcon className="mr-2 inline h-4 w-4" />
            Orders ({pendingOrders.length} pending)
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "notifications"
                ? "border-b-2 border-accent text-accent"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <BellIcon className="mr-2 inline h-4 w-4" />
            Notifications
          </button>
        </div>

        {/* Accounts Tab */}
        {activeTab === "accounts" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-10 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent focus:bg-white/10"
              />
            </div>

            {/* Accounts List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-neutral-400">Loading accounts...</p>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-sm text-neutral-400">No accounts found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white">{account.name}</h3>
                          {account.status === "PENDING" && (
                            <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-400">
                              Pending Approval
                            </span>
                          )}
                          {account.status === "APPROVED" && (
                            <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-medium text-green-400">
                              Approved
                            </span>
                          )}
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-neutral-400 sm:grid-cols-3">
                          <div>
                            <span className="text-neutral-500">Tier:</span>{" "}
                            <span className="text-white">{account.tierId}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Currency:</span>{" "}
                            <span className="text-white">{account.currency}</span>
                          </div>
                          {account.territory && (
                            <div>
                              <span className="text-neutral-500">Territory:</span>{" "}
                              <span className="text-white">{account.territory}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {account.status === "PENDING" && (
                          <button
                            onClick={() => approveAccount(account.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 transition hover:bg-green-500/30"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Approve
                          </button>
                        )}
                        <Link
                          href={`/admin/accounts/${account.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-neutral-400">Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-sm text-neutral-400">No orders found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-semibold text-white hover:text-accent transition"
                        >
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </Link>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              order.status === "SUBMITTED"
                                ? "bg-blue-500/20 text-blue-400"
                                : order.status === "APPROVED"
                                ? "bg-green-500/20 text-green-400"
                                : order.status === "SHIPPED"
                                ? "bg-purple-500/20 text-purple-400"
                                : "bg-neutral-500/20 text-neutral-400"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-neutral-400">
                          {order.shippingAddress.company || "No company name"}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                        >
                          <DocumentArrowUpIcon className="h-4 w-4" />
                          Manage
                        </Link>
                        {order.status === "SUBMITTED" && (
                          <button
                            onClick={() => updateOrderStatus(order.id, "APPROVED")}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 transition hover:bg-green-500/30"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <BellIcon className="mx-auto h-12 w-12 text-neutral-400" />
              <h3 className="mt-4 text-lg font-semibold text-white">
                Internal Notifications
              </h3>
              <p className="mt-2 text-sm text-neutral-400">
                Send notifications to dealers about order updates, delivery ETAs, and important announcements.
              </p>
              <button className="mt-6 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft">
                Create Notification
              </button>
            </div>
          </div>
        )}
      </main>
  );
}

export default function ManageAccountsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </div>
    }>
      <AdminGuard>
        <ManageAccountsContent />
      </AdminGuard>
    </Suspense>
  );
}

