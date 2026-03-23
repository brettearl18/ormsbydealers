"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { use, useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db, auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { getIdToken } from "firebase/auth";
import { AccountDoc, AdminSettingsDoc } from "@/lib/types";
import {
  loadAdminOrderDraft,
  saveAdminOrderDraft,
  clearAdminOrderDraft,
  type AdminOrderDraftItem,
} from "@/lib/admin-order-draft";
import {
  ArrowLeftIcon,
  ShoppingBagIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

export default function AdminCreateOrderPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const router = useRouter();
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminOrderDraftItem[]>([]);
  const [company, setCompany] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmTerms, setConfirmTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsPreview, setTermsPreview] = useState<string>("");

  useEffect(() => {
    setItems(loadAdminOrderDraft(accountId));
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "accounts", accountId));
        if (cancelled) return;
        if (!snap.exists()) {
          setAccount(null);
          return;
        }
        const data = snap.data() as AccountDoc;
        setAccount({ id: snap.id, ...data });
        setCompany(data.name || "");
        const ship = data.shippingAddress;
        if (ship) {
          setLine1(ship.line1 || "");
          setLine2(ship.line2 || "");
          setCity(ship.city || "");
          setRegion(ship.region || "");
          setPostalCode(ship.postalCode || "");
          setCountry(ship.country || "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    (async () => {
      try {
        const termsSnap = await getDoc(doc(db, "adminSettings", "global"));
        if (termsSnap.exists()) {
          const t = (termsSnap.data() as AdminSettingsDoc).termsTemplate || "";
          setTermsPreview(t.trim().slice(0, 220));
        }
      } catch {
        setTermsPreview("");
      }
    })();
  }, []);

  /** Line totals are stored in AUD (dealer price), same as dealer checkout. */
  const moneyAud = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.unitPrice * i.qty, 0),
    [items],
  );

  function updateQty(idx: number, qty: number) {
    if (qty < 1) return;
    const next = [...items];
    next[idx] = { ...next[idx], qty };
    setItems(next);
    saveAdminOrderDraft(accountId, next);
  }

  function removeLine(idx: number) {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    saveAdminOrderDraft(accountId, next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) {
      setError("Add at least one guitar from the catalog.");
      return;
    }
    if (!line1.trim() || !city.trim() || !country.trim()) {
      setError("Shipping address needs line 1, city, and country.");
      return;
    }
    if (!confirmTerms) {
      setError("Confirm that dealer terms apply to this order.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("You must be signed in.");
      return;
    }

    setSubmitting(true);
    try {
      await getIdToken(currentUser, true);

      const submitOrderFn = httpsCallable<
        {
          cartItems: Array<{
            guitarId: string;
            sku: string;
            name: string;
            qty: number;
            unitPrice: number;
            selectedOptions?: Record<string, string>;
          }>;
          shippingAddress: {
            company?: string;
            line1: string;
            line2?: string;
            city: string;
            region?: string;
            postalCode?: string;
            country: string;
          };
          poNumber?: string;
          notes?: string;
          termsAccepted?: { accepted: boolean; acceptedAt: string };
          onBehalfOfAccountId: string;
        },
        { orderId: string }
      >(functions, "submitOrder");

      const adminNote =
        `[Order created by admin for account ${accountId}]` +
        (notes.trim() ? `\n${notes.trim()}` : "");

      const res = await submitOrderFn({
        cartItems: items.map((item) => ({
          guitarId: item.guitarId,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          selectedOptions: item.selectedOptions,
        })),
        shippingAddress: {
          company: company.trim() || undefined,
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          region: region.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          country: country.trim(),
        },
        poNumber: poNumber.trim() || undefined,
        notes: adminNote,
        termsAccepted: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
        },
        onBehalfOfAccountId: accountId,
      });

      const orderId = (res.data as { orderId?: string })?.orderId;
      clearAdminOrderDraft(accountId);
      if (orderId) {
        router.push(`/admin/orders/${orderId}`);
      } else {
        router.push(`/admin/accounts/${accountId}`);
      }
    } catch (err: unknown) {
      console.error(err);
      const e = err as { code?: string; message?: string };
      let msg =
        e?.message ||
        "Unable to submit order. Check Cloud Function logs if this persists.";
      if (e?.code === "functions/permission-denied") {
        msg = "Only admins can place orders on behalf of an account.";
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminGuard>
      <main className="mx-auto flex max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/admin/accounts/${accountId}`}
              className="mb-3 inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to account
            </Link>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              Create order for account
            </h1>
            {account && (
              <p className="mt-2 text-sm text-neutral-400">
                <span className="text-neutral-200">{account.name}</span> ·{" "}
                <span className="font-mono text-xs">{accountId}</span> · Pricing
                uses this account&apos;s discount (
                {account.discountPercent ?? 0}% off RRP)
              </p>
            )}
          </div>
          <Link
            href={`/admin/accounts/${accountId}/create-order/browse`}
            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
          >
            <ShoppingBagIcon className="h-5 w-5" />
            Browse catalog
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-400">Loading account…</p>
        ) : !account ? (
          <p className="text-sm text-red-400">Account not found.</p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="grid gap-8 lg:grid-cols-5"
          >
            <div className="space-y-6 lg:col-span-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Order lines
                </h2>
                {items.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-500">
                    No items yet. Use{" "}
                    <Link
                      href={`/admin/accounts/${accountId}/create-order/browse`}
                      className="text-accent hover:underline"
                    >
                      Browse catalog
                    </Link>{" "}
                    to add guitars.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {items.map((item, idx) => (
                      <li
                        key={`${item.guitarId}-${JSON.stringify(item.selectedOptions)}`}
                        className="flex flex-wrap items-center gap-4 border-b border-white/5 pb-4 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="font-mono text-xs text-neutral-500">
                            {item.sku}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="sr-only">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) =>
                              updateQty(idx, Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-16 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white"
                          />
                        </div>
                        <p className="text-sm text-neutral-300">
                          {moneyAud(item.unitPrice * item.qty)}{" "}
                          <span className="text-xs text-neutral-500">
                            ({moneyAud(item.unitPrice)} × {item.qty})
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="rounded p-2 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Remove line"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {items.length > 0 && (
                  <p className="mt-4 text-right text-lg font-semibold text-white">
                    Subtotal: {moneyAud(subtotal)}{" "}
                    <span className="text-xs font-normal text-neutral-500">
                      AUD (order currency for this account:{" "}
                      {account?.currency || "AUD"})
                    </span>
                  </p>
                )}
              </div>

              <p className="text-xs text-neutral-500">
                Line prices are dealer AUD (RRP × discount) at add-to-draft time,
                matching the normal checkout flow.
              </p>
            </div>

            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Ship to
                </h2>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="Address line 1 *"
                    required
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="Address line 2"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="City *"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="text"
                      placeholder="Region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Postal code"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="text"
                      placeholder="Country *"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  PO & notes
                </h2>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="PO number (optional)"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  <textarea
                    placeholder="Internal notes (appended to order)"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="checkbox"
                  checked={confirmTerms}
                  onChange={(e) => setConfirmTerms(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-neutral-300">
                  I confirm this order is placed on behalf of the dealer; standard
                  dealer terms apply.
                  {termsPreview && (
                    <span className="mt-2 block text-xs text-neutral-500">
                      Terms preview: {termsPreview}
                      …
                    </span>
                  )}
                </span>
              </label>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={
                  submitting || items.length === 0 || !confirmTerms
                }
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Submit order"}
              </button>
            </div>
          </form>
        )}
      </main>
    </AdminGuard>
  );
}
