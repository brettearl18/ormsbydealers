"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccountDoc, OrderDoc, TierDoc, OrderLineDoc, GuitarDoc, ShippingAddress } from "@/lib/types";
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

function AddressFields({
  address,
  onChange,
}: {
  address?: Partial<ShippingAddress> | null;
  onChange: (a: ShippingAddress) => void;
}) {
  const a = address ?? {};
  const update = (key: keyof ShippingAddress, value: string) => {
    onChange({ ...a, [key]: value || undefined } as ShippingAddress);
  };
  return (
    <div className="grid gap-2">
      <input
        type="text"
        placeholder="Company"
        value={a.company ?? ""}
        onChange={(e) => update("company", e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
      />
      <input
        type="text"
        placeholder="Address line 1"
        value={a.line1 ?? ""}
        onChange={(e) => update("line1", e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
      />
      <input
        type="text"
        placeholder="Address line 2"
        value={a.line2 ?? ""}
        onChange={(e) => update("line2", e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="City"
          value={a.city ?? ""}
          onChange={(e) => update("city", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
        />
        <input
          type="text"
          placeholder="Region / State"
          value={a.region ?? ""}
          onChange={(e) => update("region", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Postal code"
          value={a.postalCode ?? ""}
          onChange={(e) => update("postalCode", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
        />
        <input
          type="text"
          placeholder="Country"
          value={a.country ?? ""}
          onChange={(e) => update("country", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
        />
      </div>
    </div>
  );
}

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
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<AccountDoc> & { id?: string }>({});

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

        {/* Edit Account form */}
        {editMode && (
          <div className="rounded-2xl border border-accent/30 bg-white/5 p-6">
            <h2 className="mb-6 text-lg font-semibold text-white">Edit Account</h2>
            <form
              className="space-y-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  const payload: Record<string, unknown> = {
                    name: formData.name ?? account.name,
                    tierId: formData.tierId ?? account.tierId,
                    currency: formData.currency ?? account.currency,
                    updatedAt: new Date().toISOString(),
                  };
                  payload.discountPercent = formData.discountPercent ?? 0;
                  if (formData.territory !== undefined) payload.territory = formData.territory || "";
                  if (formData.terms !== undefined) payload.terms = formData.terms || "";
                  if (formData.contactName !== undefined) payload.contactName = formData.contactName || "";
                  if (formData.contactEmail !== undefined) payload.contactEmail = formData.contactEmail || "";
                  if (formData.contactPhone !== undefined) payload.contactPhone = formData.contactPhone || "";
                  if (formData.notes !== undefined) payload.notes = formData.notes || "";
                  const billing = formData.billingAddress;
                  if (billing && (billing.line1 || billing.city || billing.country)) {
                    payload.billingAddress = {
                      company: billing.company ?? "",
                      line1: billing.line1 || "",
                      line2: billing.line2 ?? "",
                      city: billing.city || "",
                      region: billing.region ?? "",
                      postalCode: billing.postalCode ?? "",
                      country: billing.country || "",
                    };
                  }
                  const shipping = formData.shippingAddress;
                  if (shipping && (shipping.line1 || shipping.city || shipping.country)) {
                    payload.shippingAddress = {
                      company: shipping.company ?? "",
                      line1: shipping.line1 || "",
                      line2: shipping.line2 ?? "",
                      city: shipping.city || "",
                      region: shipping.region ?? "",
                      postalCode: shipping.postalCode ?? "",
                      country: shipping.country || "",
                    };
                  }
                  await updateDoc(doc(db, "accounts", accountId), payload);
                  const updated = { ...account, ...payload } as AccountDoc & { id: string };
                  setAccount(updated);
                  setEditMode(false);
                } catch (err) {
                  console.error("Error updating account:", err);
                  alert("Failed to update account");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Company name</label>
                  <input
                    type="text"
                    value={formData.name ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Pricing tier</label>
                  <select
                    value={formData.tierId ?? account.tierId}
                    onChange={(e) => setFormData((p) => ({ ...p, tierId: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  >
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Currency</label>
                  <select
                    value={formData.currency ?? account.currency}
                    onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AUD">AUD</option>
                    <option value="CAD">CAD</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Discount % off RRP</label>
                  <select
                    value={formData.discountPercent ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, discountPercent: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  >
                    <option value="">Not set</option>
                    <option value="30">30% off RRP</option>
                    <option value="35">35% off RRP</option>
                    <option value="50">50% off RRP</option>
                  </select>
                  <p className="mt-1 text-xs text-neutral-500">Dealer price = RRP × (1 − discount%)</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Territory</label>
                  <input
                    type="text"
                    value={formData.territory ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, territory: e.target.value }))}
                    placeholder="e.g. US"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none placeholder:text-neutral-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Terms & conditions</label>
                <textarea
                  value={formData.terms ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, terms: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Contact name</label>
                  <input
                    type="text"
                    value={formData.contactName ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Contact email</label>
                  <input
                    type="email"
                    value={formData.contactEmail ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, contactEmail: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Contact phone</label>
                  <input
                    type="text"
                    value={formData.contactPhone ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, contactPhone: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Billing address</h3>
                  <AddressFields
                    address={formData.billingAddress}
                    onChange={(billingAddress) => setFormData((p) => ({ ...p, billingAddress }))}
                  />
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Shipping address</h3>
                  <AddressFields
                    address={formData.shippingAddress}
                    onChange={(shippingAddress) => setFormData((p) => ({ ...p, shippingAddress }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-400">Notes</label>
                <textarea
                  value={formData.notes ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-accent-soft disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  disabled={saving}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

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

                {/* Discount % off RRP */}
                <div className="flex items-start gap-3">
                  <TagIcon className="mt-1 h-5 w-5 flex-shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Discount off RRP
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {(account as AccountDoc).discountPercent != null &&
                      (account as AccountDoc).discountPercent !== 0
                        ? `${(account as AccountDoc).discountPercent}% off RRP`
                        : "Not set"}
                    </p>
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
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      name: account.name,
                      tierId: account.tierId,
                      currency: account.currency,
                      discountPercent: (account as AccountDoc).discountPercent ?? undefined,
                      territory: account.territory ?? "",
                      terms: account.terms ?? "",
                      contactName: (account as AccountDoc).contactName ?? "",
                      contactEmail: (account as AccountDoc).contactEmail ?? "",
                      contactPhone: (account as AccountDoc).contactPhone ?? "",
                      billingAddress: (account as AccountDoc).billingAddress
                        ? ({ ...(account as AccountDoc).billingAddress } as ShippingAddress)
                        : undefined,
                      shippingAddress: (account as AccountDoc).shippingAddress
                        ? ({ ...(account as AccountDoc).shippingAddress } as ShippingAddress)
                        : undefined,
                      notes: (account as AccountDoc).notes ?? "",
                    });
                    setEditMode(true);
                  }}
                  className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-accent/30 hover:bg-white/10"
                >
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

