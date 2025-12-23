"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState, use } from "react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  GuitarDoc,
  AvailabilityDoc,
  PricesDoc,
  AvailabilityState,
  TierDoc,
} from "@/lib/types";
import { computeEffectivePrice } from "@/lib/pricing";
import { AvailabilityBadge } from "@/components/guitars/AvailabilityBadge";
import { PriceTag } from "@/components/guitars/PriceTag";
import { ImageCarousel } from "@/components/guitars/ImageCarousel";
import { SpecTable } from "@/components/guitars/SpecTable";
import Link from "next/link";
import { ArrowLeftIcon, EyeIcon } from "@heroicons/react/24/outline";

export default function AdminPreviewPage({
  params,
}: {
  params: Promise<{ guitarId: string }>;
}) {
  const { guitarId } = use(params);
  const [guitar, setGuitar] = useState<GuitarDoc | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDoc | null>(
    null,
  );
  const [prices, setPrices] = useState<PricesDoc | null>(null);
  const [tiers, setTiers] = useState<Array<TierDoc & { id: string }>>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setFetching(true);
      setError(null);
      try {
        const [guitarSnap, availabilitySnap, pricesSnap, tiersSnap] =
          await Promise.all([
            getDoc(doc(db, "guitars", guitarId)),
            getDoc(doc(db, "availability", guitarId)),
            getDoc(doc(db, "prices", guitarId)),
            getDocs(collection(db, "tiers")),
          ]);

        if (!guitarSnap.exists()) {
          setError("Guitar not found");
          setFetching(false);
          return;
        }

        setGuitar(guitarSnap.data() as GuitarDoc);
        setAvailability(
          availabilitySnap.exists()
            ? (availabilitySnap.data() as AvailabilityDoc)
            : {
                state: "IN_STOCK" as AvailabilityState,
                qtyAvailable: 0,
                qtyAllocated: 0,
              },
        );
        setPrices(
          pricesSnap.exists() ? (pricesSnap.data() as PricesDoc) : null,
        );

        const tiersData = tiersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<TierDoc & { id: string }>;
        setTiers(tiersData);
        if (tiersData.length > 0 && !selectedTierId) {
          setSelectedTierId(tiersData[0].id);
        }
      } catch (err) {
        setError("Unable to load guitar details");
        console.error(err);
      } finally {
        setFetching(false);
      }
    }

    fetchData();
  }, [guitarId, selectedTierId]);

  if (fetching) {
    return (
      <AdminGuard>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading preview…</p>
        </main>
      </AdminGuard>
    );
  }

  if (error || !guitar) {
    return (
      <AdminGuard>
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">{error || "Guitar not found"}</p>
          <Link
            href="/admin/guitars"
            className="rounded-full border border-neutral-800 px-4 py-2 text-xs uppercase tracking-wide hover:border-accent hover:text-accent-soft"
          >
            Back to guitars
          </Link>
        </main>
      </AdminGuard>
    );
  }

  // Compute price for selected tier (using a dummy accountId)
  const effectivePrice = selectedTierId
    ? computeEffectivePrice({
        prices,
        accountId: "preview", // Dummy account for preview
        tierId: selectedTierId,
        now: new Date(),
      })
    : { price: prices?.basePrice ?? null, source: "BASE" as const };

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-6">
        {/* Admin Preview Banner */}
        <div className="glass-strong rounded-2xl border-2 border-accent/30 bg-accent/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                <EyeIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Admin Preview Mode
                </h2>
                <p className="text-xs text-neutral-400">
                  This is how dealers will see this guitar
                </p>
              </div>
            </div>
            <Link
              href="/admin/guitars"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/5"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Admin
            </Link>
          </div>
        </div>

        {/* Tier Selector (if multiple tiers exist) */}
        {tiers.length > 1 && (
          <div className="glass-strong rounded-2xl p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Preview Pricing for Tier:
            </label>
            <div className="flex flex-wrap gap-2">
              {tiers.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    selectedTierId === tier.id
                      ? "border-accent bg-accent/20 text-accent"
                      : "border-white/10 bg-white/5 text-neutral-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {tier.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Guitar Preview (Dealer View) */}
        <div className="flex flex-1 flex-col gap-8">
          <Link
            href="/admin/guitars"
            className="text-xs text-neutral-400 hover:text-accent-soft"
          >
            ← Back to guitars
          </Link>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Image Carousel */}
            <div className="space-y-4">
              <ImageCarousel images={guitar.images} name={guitar.name} />
            </div>

            {/* Details */}
            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  {guitar.series}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {guitar.name}
                </h1>
                <p className="text-sm text-neutral-400">SKU: {guitar.sku}</p>
                {guitar.status === "INACTIVE" && (
                  <p className="text-xs text-yellow-400">
                    ⚠️ Status: INACTIVE (dealers won't see this)
                  </p>
                )}
              </div>

              <AvailabilityBadge
                state={availability!.state}
                etaDate={availability!.etaDate}
                batchName={availability!.batchName}
              />

              <div className="flex items-baseline gap-4">
                <PriceTag
                  price={effectivePrice.price}
                  currency={prices?.currency || "USD"}
                  note={
                    effectivePrice.source === "PROMO"
                      ? "Promo price"
                      : effectivePrice.source === "ACCOUNT_OVERRIDE"
                      ? "Account-specific price"
                      : effectivePrice.source === "TIER"
                      ? `Tier ${selectedTierId} price`
                      : "Base price"
                  }
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-surface/40 p-4">
                <p className="text-xs text-neutral-400">
                  <span className="font-semibold text-white">Note:</span> In
                  preview mode, "Add to cart" is disabled. Dealers will see a
                  functional add to cart button.
                </p>
              </div>

              <button
                type="button"
                disabled
                className="w-full rounded-full bg-neutral-800 px-6 py-3 text-sm font-medium text-neutral-400 shadow-soft transition disabled:cursor-not-allowed"
              >
                Add to cart (Preview)
              </button>

              {guitar.specs && <SpecTable specs={guitar.specs} />}
            </div>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}


