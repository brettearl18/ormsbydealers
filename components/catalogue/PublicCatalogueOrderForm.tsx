"use client";

import { useState } from "react";
import { useCatalogueAudience } from "@/lib/public-catalogue-context";
import type { PublicCatalogueCartItem, PublicCatalogueContact } from "@/lib/public-catalogue";

interface Props {
  items: PublicCatalogueCartItem[];
  subtotal: number;
  contact: PublicCatalogueContact;
  onContactChange: (next: PublicCatalogueContact) => void;
  onSuccess: () => void;
}

export function PublicCatalogueOrderForm({
  items,
  subtotal,
  contact,
  onContactChange,
  onSuccess,
}: Props) {
  const { audience, discountPercent } = useCatalogueAudience();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateField<K extends keyof PublicCatalogueContact>(
    key: K,
    value: PublicCatalogueContact[K],
  ) {
    onContactChange({ ...contact, [key]: value });
  }

  function updateShip<K extends keyof PublicCatalogueContact["shippingAddress"]>(
    key: K,
    value: string,
  ) {
    onContactChange({
      ...contact,
      shippingAddress: { ...contact.shippingAddress, [key]: value },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) {
      setError("Add at least one guitar before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/catalogue/run-19/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogueAudience: audience,
          company: contact.company.trim(),
          contactName: contact.contactName.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim() || undefined,
          territory: contact.territory.trim() || undefined,
          poNumber: contact.poNumber.trim() || undefined,
          notes: contact.notes.trim() || undefined,
          shippingAddress: contact.shippingAddress,
          lines: items.map((item) => ({
            guitarId: item.guitarId,
            qty: item.qty,
            selectedOptions: item.selectedOptions,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Submit failed");
      }
      setSuccess(true);
      onSuccess();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Unable to submit order. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <h3 className="text-lg font-semibold text-white">Order submitted</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Thanks — we&apos;ve emailed your request to Ormsby and sent you a confirmation copy.
          Our team will follow up shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Company *
          </span>
          <input
            required
            value={contact.company}
            onChange={(e) => updateField("company", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Contact name *
          </span>
          <input
            required
            value={contact.contactName}
            onChange={(e) => updateField("contactName", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Email *
          </span>
          <input
            required
            type="email"
            value={contact.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Phone
          </span>
          <input
            value={contact.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Territory
          </span>
          <input
            value={contact.territory}
            onChange={(e) => updateField("territory", e.target.value)}
            placeholder="e.g. EU, USA, AU"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            PO number
          </span>
          <input
            value={contact.poNumber}
            onChange={(e) => updateField("poNumber", e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Ship to (optional)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={contact.shippingAddress.company}
            onChange={(e) => updateShip("company", e.target.value)}
            placeholder="Company"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent sm:col-span-2"
          />
          <input
            value={contact.shippingAddress.line1}
            onChange={(e) => updateShip("line1", e.target.value)}
            placeholder="Address line 1"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent sm:col-span-2"
          />
          <input
            value={contact.shippingAddress.line2}
            onChange={(e) => updateShip("line2", e.target.value)}
            placeholder="Address line 2"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent sm:col-span-2"
          />
          <input
            value={contact.shippingAddress.city}
            onChange={(e) => updateShip("city", e.target.value)}
            placeholder="City"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
          <input
            value={contact.shippingAddress.region}
            onChange={(e) => updateShip("region", e.target.value)}
            placeholder="State / region"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
          <input
            value={contact.shippingAddress.postalCode}
            onChange={(e) => updateShip("postalCode", e.target.value)}
            placeholder="Postal code"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
          <input
            value={contact.shippingAddress.country}
            onChange={(e) => updateShip("country", e.target.value)}
            placeholder="Country"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Notes
        </span>
        <textarea
          rows={3}
          value={contact.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent"
          placeholder="Delivery preferences, questions, etc."
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || items.length === 0}
        className="w-full rounded-xl bg-accent px-6 py-4 text-sm font-bold text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Submitting…"
          : `Submit order by email — ${new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
            }).format(subtotal)}`}
      </button>
      <p className="text-center text-[11px] text-neutral-500">
        Your request is emailed to Ormsby. No portal login required. Prices shown are{" "}
        {discountPercent}% off RRP (AUD).
      </p>
    </form>
  );
}
