"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccountDoc, OrderDoc, OrderStatus, AccountRequestDoc } from "@/lib/types";
import { getAuth } from "firebase/auth";
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
  const [accountRequests, setAccountRequests] = useState<Array<AccountRequestDoc & { id: string }>>([]);
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"accounts" | "requests" | "orders" | "notifications">(
    (tabParam === "orders" || tabParam === "notifications" || tabParam === "requests" ? tabParam : "accounts") as "accounts" | "requests" | "orders" | "notifications"
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [accountsSnap, requestsSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, "accounts"), orderBy("name"))),
        getDocs(query(collection(db, "accountRequests"), where("status", "==", "PENDING"), orderBy("requestedAt", "desc"))),
        getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), where("status", "!=", "CANCELLED"))),
      ]);

      const accountsData = accountsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        status: "APPROVED" as const, // Default status, can be extended
      })) as AccountWithUsers[];

      const requestsData = requestsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<AccountRequestDoc & { id: string }>;

      const ordersData = ordersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<OrderDoc & { id: string }>;

      setAccounts(accountsData);
      setAccountRequests(requestsData);
      setOrders(ordersData);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function approveAccountRequest(requestId: string) {
    try {
      const requestDoc = await getDoc(doc(db, "accountRequests", requestId));
      if (!requestDoc.exists()) {
        alert("Request not found");
        return;
      }

      const request = requestDoc.data() as AccountRequestDoc;
      const auth = getAuth();
      const currentUser = auth.currentUser;

      // Create the account document
      const accountId = `acct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, "accounts", accountId), {
        name: request.companyName,
        tierId: "TIER_A", // Default tier, can be adjusted by admin
        currency: "USD", // Default currency, can be adjusted by admin
        territory: request.territory || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create user document
      await setDoc(doc(db, "users", request.uid), {
        role: request.accountType,
        accountId: accountId,
        email: request.email,
        name: request.contactName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Update the request status
      await updateDoc(doc(db, "accountRequests", requestId), {
        status: "APPROVED",
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser?.uid || null,
        accountId: accountId,
      });

      // Note: Admin would need to set custom claims via Cloud Function or admin script
      // For now, we'll just create the documents. The user will need custom claims set.
      
      const claimsCommand = request.accountType === "DEALER" 
        ? `node scripts/setDealerClaims.mjs ${request.email}`
        : `node scripts/setDistributorClaims.mjs ${request.email}`;

      if (window.confirm(
        `Account approved! Account ID: ${accountId}\n\n` +
        `The account and user documents have been created.\n\n` +
        `To complete the setup, you need to set custom claims for the user.\n\n` +
        `Run this command:\n${claimsCommand}\n\n` +
        `Click OK to continue, or Cancel to view details.`
      )) {
        await fetchData();
      } else {
        // Show detailed information
        alert(
          `Account Details:\n` +
          `Account ID: ${accountId}\n` +
          `Email: ${request.email}\n` +
          `Account Type: ${request.accountType}\n` +
          `Company: ${request.companyName}\n\n` +
          `Next Step:\n` +
          `Run: ${claimsCommand}`
        );
        await fetchData();
      }
    } catch (err) {
      console.error("Error approving account request:", err);
      alert("Failed to approve account request");
    }
  }

  async function rejectAccountRequest(requestId: string) {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      await updateDoc(doc(db, "accountRequests", requestId), {
        status: "REJECTED",
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser?.uid || null,
      });
      
      await fetchData();
    } catch (err) {
      console.error("Error rejecting account request:", err);
      alert("Failed to reject account request");
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
  
  const pendingRequests = accountRequests.filter((req) => req.status === "PENDING");

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
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "requests"
                ? "border-b-2 border-accent text-accent"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <CheckCircleIcon className="mr-2 inline h-4 w-4" />
            Requests ({pendingRequests.length} pending)
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

        {/* Account Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-neutral-400">Loading requests...</p>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-sm text-neutral-400">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-white">{request.companyName}</h3>
                          <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-400 uppercase">
                            {request.accountType}
                          </span>
                          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400">
                            PENDING
                          </span>
                        </div>
                        <div className="grid gap-3 text-sm text-neutral-300 sm:grid-cols-2">
                          <div>
                            <span className="text-neutral-500">Contact:</span>{" "}
                            <span className="text-white">{request.contactName}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Email:</span>{" "}
                            <span className="text-white">{request.email}</span>
                          </div>
                          {request.phone && (
                            <div>
                              <span className="text-neutral-500">Phone:</span>{" "}
                              <span className="text-white">{request.phone}</span>
                            </div>
                          )}
                          {request.territory && (
                            <div>
                              <span className="text-neutral-500">Territory:</span>{" "}
                              <span className="text-white">{request.territory}</span>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <span className="text-neutral-500">Requested:</span>{" "}
                            <span className="text-white">
                              {new Date(request.requestedAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {request.notes && (
                            <div className="sm:col-span-2 mt-2 p-3 rounded-lg bg-black/20 border border-white/5">
                              <p className="text-xs text-neutral-400 mb-1">Notes:</p>
                              <p className="text-sm text-neutral-300">{request.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => approveAccountRequest(request.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 transition hover:bg-green-500/30"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectAccountRequest(request.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/30"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          Reject
                        </button>
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

