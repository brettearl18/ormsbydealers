"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useDealerView } from "@/lib/dealer-view-context";
import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AccountDoc, FxRatesDoc, ShippingAddress } from "@/lib/types";
import { fetchDealerFxRates } from "@/lib/fx-client";

const CURRENCIES = [
  { value: "AUD", label: "AUD (Australian Dollar)" },
  { value: "USD", label: "USD (US Dollar)" },
  { value: "EUR", label: "EUR (Euro)" },
  { value: "GBP", label: "GBP (British Pound)" },
  { value: "CAD", label: "CAD (Canadian Dollar)" },
];

const TAX_LABEL_OPTIONS = [
  { value: "", label: "None" },
  { value: "VAT", label: "VAT" },
  { value: "GST", label: "GST" },
  { value: "Import duty", label: "Import duty" },
  { value: "Custom", label: "Custom" },
];

const FRANKFURTER_LATEST =
  "https://api.frankfurter.dev/v1/latest?base=AUD&symbols=USD,EUR,GBP,CAD";

const emptyAddress: Partial<ShippingAddress> = {
  company: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

function AddressFields({
  address,
  onChange,
}: {
  address: Partial<ShippingAddress>;
  onChange: (a: Partial<ShippingAddress>) => void;
}) {
  const a = address || emptyAddress;
  const update = (key: keyof ShippingAddress, value: string) => {
    onChange({ ...a, [key]: value || "" });
  };
  return (
    <div className="grid gap-3">
      <input
        type="text"
        placeholder="Company"
        value={a.company ?? ""}
        onChange={(e) => update("company", e.target.value)}
        className="w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
      />
      <input
        type="text"
        placeholder="Address line 1"
        value={a.line1 ?? ""}
        onChange={(e) => update("line1", e.target.value)}
        className="w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
      />
      <input
        type="text"
        placeholder="Address line 2"
        value={a.line2 ?? ""}
        onChange={(e) => update("line2", e.target.value)}
        className="w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="City"
          value={a.city ?? ""}
          onChange={(e) => update("city", e.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
        />
        <input
          type="text"
          placeholder="Region / State"
          value={a.region ?? ""}
          onChange={(e) => update("region", e.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Postal code"
          value={a.postalCode ?? ""}
          onChange={(e) => update("postalCode", e.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
        />
        <input
          type="text"
          placeholder="Country"
          value={a.country ?? ""}
          onChange={(e) => update("country", e.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
        />
      </div>
    </div>
  );
}

function toShippingAddress(a: Partial<ShippingAddress>): ShippingAddress | undefined {
  const line1 = (a.line1 ?? "").trim();
  const city = (a.city ?? "").trim();
  const country = (a.country ?? "").trim();
  if (!line1 && !city && !country) return undefined;
  return {
    company: (a.company ?? "").trim() || undefined,
    line1: line1 || "—",
    line2: (a.line2 ?? "").trim() || undefined,
    city: city || "—",
    region: (a.region ?? "").trim() || undefined,
    postalCode: (a.postalCode ?? "").trim() || undefined,
    country: country || "—",
  };
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const { isAdminDealerPreview, dealerView } = useDealerView();
  const router = useRouter();
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(null);
  const [fxRates, setFxRates] = useState<FxRatesDoc | null>(null);
  const [currency, setCurrency] = useState<string>("AUD");
  const [billingAddress, setBillingAddress] = useState<Partial<ShippingAddress>>(emptyAddress);
  const [shippingAddress, setShippingAddress] = useState<Partial<ShippingAddress>>(emptyAddress);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [estimatedTaxLabel, setEstimatedTaxLabel] = useState<string>("");
  const [estimatedTaxCustomLabel, setEstimatedTaxCustomLabel] = useState<string>("");
  const [estimatedTaxPercent, setEstimatedTaxPercent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!loading && user && isAdminDealerPreview && dealerView?.accountId) {
      router.replace(`/admin/accounts/${dealerView.accountId}`);
      return;
    }
    if (!user?.accountId) {
      router.push("/dashboard");
      return;
    }
  }, [user, loading, router, isAdminDealerPreview, dealerView?.accountId]);

  useEffect(() => {
    const accountId = user?.accountId;
    if (!accountId) return;
    let cancelled = false;
    Promise.all([
      getDoc(doc(db, "accounts", accountId)),
      fetchDealerFxRates(db),
    ])
      .then(([accountSnap, fxLive]) => {
        if (cancelled) return;
        if (accountSnap.exists()) {
          const data = accountSnap.data() as AccountDoc;
          setAccount({ id: accountSnap.id, ...data });
          setCurrency(data.currency || "AUD");
          setBillingAddress(data.billingAddress ?? emptyAddress);
          setShippingAddress(data.shippingAddress ?? emptyAddress);
          const taxLabel = data.estimatedTaxLabel ?? "";
          setEstimatedTaxLabel(TAX_LABEL_OPTIONS.some((o) => o.value === taxLabel) ? taxLabel : (taxLabel ? "Custom" : ""));
          setEstimatedTaxCustomLabel(taxLabel && !TAX_LABEL_OPTIONS.find((o) => o.value === taxLabel) ? taxLabel : "");
          setEstimatedTaxPercent(data.estimatedTaxPercent != null ? String(data.estimatedTaxPercent) : "");
        }
        if (fxLive) setFxRates(fxLive);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.accountId]);

  // When "Same as billing" is checked, keep shipping in sync with billing
  useEffect(() => {
    if (sameAsBilling) setShippingAddress({ ...billingAddress });
  }, [sameAsBilling, billingAddress]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.accountId) return;
    setSaving(true);
    setMessage(null);
    try {
      const billing = toShippingAddress(billingAddress);
      const shipping = sameAsBilling ? billing : toShippingAddress(shippingAddress);
      const taxLabel =
        estimatedTaxLabel === "Custom"
          ? estimatedTaxCustomLabel.trim()
          : estimatedTaxLabel;
      const rawPercent = estimatedTaxPercent.trim()
        ? parseFloat(estimatedTaxPercent)
        : undefined;
      let taxPercent =
        rawPercent != null && !Number.isNaN(rawPercent) ? rawPercent : null;
      // Type "None" — clear Firestore fields so cart/checkout don’t use stale %.
      if (!taxLabel) {
        taxPercent = null;
      }

      const payload: Record<string, unknown> = {
        currency,
        ...(billing && { billingAddress: billing }),
        ...(shipping && { shippingAddress: shipping }),
      };
      if (!taxLabel) {
        payload.estimatedTaxLabel = deleteField();
        payload.estimatedTaxPercent = deleteField();
      } else {
        payload.estimatedTaxLabel = taxLabel;
        payload.estimatedTaxPercent = taxPercent;
      }
      await updateDoc(doc(db, "accounts", user.accountId), payload);
      setAccount((prev) =>
        prev
          ? {
              ...prev,
              currency,
              ...(billing && { billingAddress: billing }),
              ...(shipping && { shippingAddress: shipping }),
              ...(!taxLabel
                ? { estimatedTaxLabel: undefined, estimatedTaxPercent: undefined }
                : { estimatedTaxLabel: taxLabel, estimatedTaxPercent: taxPercent ?? undefined }),
            }
          : null
      );
      setMessage({
        type: "success",
        text: "Settings saved. They will apply across the portal.",
      });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to save. You may not have permission to update settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="flex flex-1 flex-col gap-8">
      <div>
        <Link
          href="/dashboard"
          className="text-xs text-neutral-400 hover:text-accent-soft"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Your preferences and details for the dealer portal.
        </p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-8">
        {/* Display currency */}
        <div className="rounded-2xl bg-surface/80 p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-white">Display currency</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Prices will be shown in this currency across the catalog, cart, and orders. Saved for future logins.
          </p>
          <div className="mt-4">
            <label htmlFor="currency" className="block text-xs font-medium uppercase tracking-wide text-neutral-400">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Billing address */}
        <div className="rounded-2xl bg-surface/80 p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-white">Billing address</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Used for invoices and billing. Optional.
          </p>
          <div className="mt-4">
            <AddressFields address={billingAddress} onChange={setBillingAddress} />
          </div>
        </div>

        {/* Shipping address */}
        <div className="rounded-2xl bg-surface/80 p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-white">Shipping address</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Default delivery address for orders. Optional.
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-600 bg-black/40 text-accent focus:ring-accent"
            />
            <span className="text-sm text-neutral-300">Same as billing address</span>
          </label>
          {!sameAsBilling && (
            <div className="mt-4">
              <AddressFields address={shippingAddress} onChange={setShippingAddress} />
            </div>
          )}
        </div>

        {/* Estimated tax / tariff */}
        <div className="rounded-2xl bg-surface/80 p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-white">Estimated tax &amp; tariff</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Optional. Set a label and percentage for your own cost estimation (e.g. VAT, GST, import duty). The amount is added on{" "}
            <strong className="text-neutral-300">Cart</strong> and <strong className="text-neutral-300">Checkout</strong>{" "}
            (reference only; actual charges are determined at order time).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tax-label" className="block text-xs font-medium uppercase tracking-wide text-neutral-400">
                Type
              </label>
              <select
                id="tax-label"
                value={estimatedTaxLabel}
                onChange={(e) => setEstimatedTaxLabel(e.target.value)}
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {TAX_LABEL_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {estimatedTaxLabel === "Custom" && (
              <div>
                <label htmlFor="tax-custom" className="block text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Custom label
                </label>
                <input
                  id="tax-custom"
                  type="text"
                  value={estimatedTaxCustomLabel}
                  onChange={(e) => setEstimatedTaxCustomLabel(e.target.value)}
                  placeholder="e.g. Local tax"
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
                />
              </div>
            )}
            <div>
              <label htmlFor="tax-percent" className="block text-xs font-medium uppercase tracking-wide text-neutral-400">
                Percentage (%)
              </label>
              <input
                id="tax-percent"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={estimatedTaxPercent}
                onChange={(e) => setEstimatedTaxPercent(e.target.value)}
                placeholder="e.g. 20"
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-neutral-500"
              />
            </div>
          </div>
        </div>

        {/* Foreign exchange – last pull date and link */}
        <div className="rounded-2xl bg-surface/80 p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-white">Foreign exchange rates</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Prices in non-AUD currencies use today’s reference rates from Frankfurter (updated daily). If the live feed is unavailable, cached rates from your administrator are used instead.
          </p>
          {fxRates?.asOf ? (
            <p className="mt-3 text-sm font-medium text-white">
              Last updated:{" "}
              {(() => {
                const asOfDate = new Date(fxRates.asOf);
                const today = new Date();
                // Never show a future date (e.g. bad data or API glitch)
                const displayDate = asOfDate > today ? today : asOfDate;
                return displayDate.toLocaleDateString(undefined, { dateStyle: "long" });
              })()}
            </p>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              Live rates could not be loaded. Your administrator can refresh backup rates in Admin → Settings.
            </p>
          )}
          <a
            href={FRANKFURTER_LATEST}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-soft"
          >
            View today’s AUD rates (Frankfurter)
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {fxRates?.rates && Object.keys(fxRates.rates).length > 0 ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
              <p className="border-b border-white/10 bg-black/30 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-500">
                Daily reference (1 AUD →)
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                    <th className="px-3 py-2 font-medium">Currency</th>
                    <th className="px-3 py-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(["USD", "EUR", "GBP", "CAD"] as const).map((code) => {
                    const rate = fxRates.rates[code];
                    if (rate == null || Number.isNaN(rate)) return null;
                    return (
                      <tr key={code} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2.5 font-medium text-white">{code}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-neutral-200">
                          {rate.toFixed(5)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-white/10 bg-black/20 px-3 py-2 text-[11px] text-neutral-500">
                Same rates used when displaying prices in USD, EUR, GBP, or CAD.
              </p>
            </div>
          ) : null}
        </div>

        {message && (
          <p
            className={`text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}
            role="alert"
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-8 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save all settings"}
        </button>
      </form>
    </main>
  );
}
