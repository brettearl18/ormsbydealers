"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccountDoc, OrderDoc, TierDoc, OrderLineDoc, GuitarDoc } from "@/lib/types";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  TagIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

const STATUS_COLORS = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  APPROVED: "bg-green-500/20 text-green-400",
  SUSPENDED: "bg-red-500/20 text-red-400",
};

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(null);
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [orderLinesMap, setOrderLinesMap] = useState<Map<string, Array<OrderLineDoc & { id: string }>>>(new Map());
  const [guitarsMap, setGuitarsMap] = useState<Map<string, GuitarDoc>>(new Map());
  const [tiers, setTiers] = useState<Array<TierDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAccount() {
      setLoading(true);
      setError(null);
      try {
        // Fetch account, tiers, and orders in parallel
        const [accountDoc, tiersSnap] = await Promise.all([
          getDoc(doc(db, "accounts", accountId)),
          getDocs(collection(db, "tiers")),
        ]);

        if (!accountDoc.exists()) {
          setError("Account not found");
          setLoading(false);
          return;
        }

        const accountDataRaw = accountDoc.data();
        const accountData = {
          id: accountDoc.id,
          ...accountDataRaw,
        } as AccountDoc & { id: string };
        setAccount(accountData);
        setSelectedTier(accountData.tierId);
        setSelectedCurrency(accountData.currency);

        // Fetch tiers
        const tiersData = tiersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<TierDoc & { id: string }>;
        setTiers(tiersData.sort((a, b) => (a.order || 0) - (b.order || 0)));

        // Fetch orders for this account
        const ordersQuery = query(
          collection(db, "orders"),
          where("accountId", "==", accountId),
          where("status", "!=", "CANCELLED")
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
        
        // Sort by created date (newest first)
        ordersData.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        setOrders(ordersData);

        // Fetch order lines and guitar data for all orders
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

        setOrderLinesMap(linesMap);

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
        console.error("Error fetching account:", err);
        setError("Unable to load account");
      } finally {
        setLoading(false);
      }
    }

    fetchAccount();
  }, [accountId]);

  if (loading) {
    return (
      <AdminGuard>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading account...</p>
        </main>
      </AdminGuard>
    );
  }

  if (error || !account) {
    return (
      <AdminGuard>
        <main className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-semibold">Account not found</h1>
            <p className="text-sm text-neutral-400">{error || "This account could not be loaded"}</p>
          </div>
          <Link
            href="/admin/accounts"
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-black shadow-soft transition hover:bg-accent-soft"
          >
            Back to accounts
          </Link>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin/accounts"
            className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {account.name}
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Account ID: {account.id}
            </p>
          </div>
          {(account as any).status && (
            <span
              className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                STATUS_COLORS[(account as any).status as keyof typeof STATUS_COLORS] ||
                STATUS_COLORS.APPROVED
              }`}
            >
              {(account as any).status || "APPROVED"}
            </span>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Information */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-6 text-lg font-semibold text-white">Account Information</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Company Name */}
                <div className="flex items-start gap-3">
                  <BuildingOfficeIcon className="mt-1 h-5 w-5 flex-shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Company Name
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{account.name}</p>
                  </div>
                </div>

                {/* Tier */}
                <div className="flex items-start gap-3">
                  <TagIcon className="mt-1 h-5 w-5 flex-shrink-0 text-neutral-400" />
                  <div className="flex-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Pricing Tier
                    </p>
                    {editingTier ? (
                      <div className="mt-1 flex items-center gap-2">
                        <select
                          value={selectedTier}
                          onChange={(e) => setSelectedTier(e.target.value)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
                          disabled={saving}
                        >
                          {tiers.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.name} ({tier.id})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={async () => {
                            setSaving(true);
                            try {
                              await updateDoc(doc(db, "accounts", accountId), {
                                tierId: selectedTier,
                                updatedAt: new Date().toISOString(),
                              });
                              setAccount({ ...account, tierId: selectedTier });
                              setEditingTier(false);
                            } catch (err) {
                              console.error("Error updating tier:", err);
                              alert("Failed to update tier");
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving || selectedTier === account.tierId}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTier(account.tierId);
                            setEditingTier(false);
                          }}
                          disabled={saving}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{account.tierId}</p>
                        <button
                          onClick={() => setEditingTier(true)}
                          className="text-xs text-accent hover:text-accent-soft"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Currency */}
                <div className="flex items-start gap-3">
                  <CurrencyDollarIcon className="mt-1 h-5 w-5 flex-shrink-0 text-neutral-400" />
                  <div className="flex-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Currency
                    </p>
                    {editingCurrency ? (
                      <div className="mt-1 flex items-center gap-2">
                        <select
                          value={selectedCurrency}
                          onChange={(e) => setSelectedCurrency(e.target.value)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
                          disabled={saving}
                        >
                          <option value="USD">USD - US Dollar</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="GBP">GBP - British Pound</option>
                          <option value="AUD">AUD - Australian Dollar</option>
                          <option value="CAD">CAD - Canadian Dollar</option>
                          <option value="JPY">JPY - Japanese Yen</option>
                        </select>
                        <button
                          onClick={async () => {
                            setSaving(true);
                            try {
                              await updateDoc(doc(db, "accounts", accountId), {
                                currency: selectedCurrency,
                                updatedAt: new Date().toISOString(),
                              });
                              setAccount({ ...account, currency: selectedCurrency });
                              setEditingCurrency(false);
                            } catch (err) {
                              console.error("Error updating currency:", err);
                              alert("Failed to update currency");
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving || selectedCurrency === account.currency}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCurrency(account.currency);
                            setEditingCurrency(false);
                          }}
                          disabled={saving}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{account.currency}</p>
                        <button
                          onClick={() => setEditingCurrency(true)}
                          className="text-xs text-accent hover:text-accent-soft"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Territory */}
                {account.territory && (
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="mt-1 h-5 w-5 flex-shrink-0 text-neutral-400" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Territory
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">{account.territory}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Terms */}
            {account.terms && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-6 text-lg font-semibold text-white">Terms & Conditions</h2>
                <p className="text-sm text-neutral-300 whitespace-pre-line">{account.terms}</p>
              </div>
            )}

            {/* Orders History */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Order History</h2>
                <span className="text-sm text-neutral-400">
                  {orders.length} {orders.length === 1 ? "order" : "orders"}
                </span>
              </div>
              {orders.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-black/20 p-8 text-center">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-neutral-600" />
                  <p className="mt-4 text-sm text-neutral-400">No orders found</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {orders.map((order) => {
                    const lines = orderLinesMap.get(order.id) || [];
                    // Get the first guitar image from order lines
                    let primaryImage: string | null = null;
                    for (const line of lines) {
                      const guitar = guitarsMap.get(line.guitarId);
                      if (guitar) {
                        // Try option image first
                        if (guitar.options && line.selectedOptions) {
                          for (const option of guitar.options) {
                            const selectedValueId = line.selectedOptions[option.optionId];
                            if (selectedValueId) {
                              const selectedValue = option.values.find(
                                (v) => v.valueId === selectedValueId,
                              );
                              if (selectedValue?.images && selectedValue.images.length > 0) {
                                primaryImage = selectedValue.images[0];
                                break;
                              }
                            }
                          }
                        }
                        // Fall back to base image
                        if (!primaryImage && guitar.images && guitar.images.length > 0) {
                          primaryImage = guitar.images[0];
                          break;
                        }
                      }
                    }

                    return (
                      <Link
                        key={order.id}
                        href={`/admin/orders/${order.id}`}
                        className="group block overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all hover:border-accent/30 hover:bg-white/10 hover:shadow-lg"
                      >
                        {/* Image */}
                        <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                          {primaryImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={primaryImage}
                              alt={order.id}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <DocumentTextIcon className="h-12 w-12 text-neutral-600" />
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                          
                          {/* Status Badge */}
                          <div className="absolute top-3 right-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium backdrop-blur-sm ${
                                order.status === "SUBMITTED"
                                  ? "bg-blue-500/90 text-white"
                                  : order.status === "APPROVED"
                                  ? "bg-green-500/90 text-white"
                                  : order.status === "SHIPPED"
                                  ? "bg-purple-500/90 text-white"
                                  : order.status === "COMPLETED"
                                  ? "bg-green-600/90 text-white"
                                  : "bg-neutral-500/90 text-white"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Order Info */}
                        <div className="p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="font-semibold text-white">
                              Order #{order.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-sm font-bold text-accent">
                              {order.currency === "USD" ? "$" : order.currency}{" "}
                              {order.totals.subtotal.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <p className="text-xs text-neutral-400">
                            {new Date(order.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          {lines.length > 0 && (
                            <p className="mt-2 text-xs text-neutral-500">
                              {lines.length} {lines.length === 1 ? "item" : "items"}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - 1/3 width */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link
                  href={`/admin/accounts?tab=orders`}
                  className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-accent/30 hover:bg-white/10"
                >
                  View All Orders
                </Link>
                <button className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-accent/30 hover:bg-white/10">
                  Edit Account
                </button>
                <button className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-accent/30 hover:bg-white/10">
                  Send Message
                </button>
              </div>
            </div>

            {/* Account Stats */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Account Statistics
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-neutral-500">Total Orders</p>
                  <p className="mt-1 text-2xl font-bold text-white">{orders.length}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Total Value</p>
                  <p className="mt-1 text-2xl font-bold text-accent">
                    {account.currency === "USD" ? "$" : account.currency}{" "}
                    {orders
                      .reduce((sum, order) => sum + order.totals.subtotal, 0)
                      .toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </p>
                </div>
                {orders.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500">Last Order</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {new Date(orders[0].createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
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

