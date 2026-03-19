"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GuitarDoc, PricesDoc } from "@/lib/types";
import Link from "next/link";

interface GuitarWithPricing extends GuitarDoc {
  id: string;
  prices: PricesDoc | null;
  /** Base RRP for list display; variant RRP may differ by options */
  baseRrp: number | null;
}

export default function AdminPricingPage() {
  const [guitars, setGuitars] = useState<GuitarWithPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [guitarsSnap, pricesSnap] = await Promise.all([
        getDocs(collection(db, "guitars")),
        getDocs(collection(db, "prices")),
      ]);

      const guitarsData = guitarsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<GuitarDoc & { id: string }>;

      const pricesMap = new Map<string, PricesDoc>();
      pricesSnap.docs.forEach((doc) => {
        const priceData = doc.data() as PricesDoc;
        pricesMap.set(doc.id, priceData);
      });

      const guitarsWithPricing: GuitarWithPricing[] = guitarsData.map(
        (guitar) => {
          const prices = pricesMap.get(guitar.id) || null;
          const baseRrp = prices?.rrp ?? null;

          return {
            ...guitar,
            prices,
            baseRrp,
          };
        },
      );

      setGuitars(guitarsWithPricing);
    } catch (err) {
      console.error("Error fetching pricing data:", err);
    } finally {
      setLoading(false);
    }
  }

  const currencies = Array.from(
    new Set(guitars.map((g) => g.prices?.currency).filter(Boolean) as string[]),
  );

  const filteredGuitars =
    currencyFilter === "all"
      ? guitars
      : guitars.filter((g) => g.prices?.currency === currencyFilter);

  const formatPrice = (price: number | null, currency: string = "AUD") => {
    if (price == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(price);
  };

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Manage Pricing
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Set RRP (AUD) per guitar; dealer price = RRP × (1 − account discount %)
            </p>
          </div>
        </div>

        {/* Currency Filter */}
        {currencies.length > 0 && (
          <div className="glass-strong rounded-2xl p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Filter by Currency:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCurrencyFilter("all")}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  currencyFilter === "all"
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-white/10 bg-white/5 text-neutral-400 hover:border-white/20 hover:text-white"
                }`}
              >
                All
              </button>
              {currencies.map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrencyFilter(curr)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    currencyFilter === curr
                      ? "border-accent bg-accent/20 text-accent"
                      : "border-white/10 bg-white/5 text-neutral-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pricing Cards Grid */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-neutral-400">Loading pricing data...</p>
          </div>
        ) : guitars.length === 0 ? (
          <div className="glass-strong rounded-3xl p-12 text-center">
            <p className="text-neutral-400">No guitars found</p>
            <Link
              href="/admin/guitars/new"
              className="mt-4 inline-block text-accent hover:text-accent-soft"
            >
              Add your first guitar →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGuitars.map((guitar) => (
              <div
                key={guitar.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl glass-strong shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-accent/20"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-900">
                  {guitar.images && guitar.images.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={guitar.images[0]}
                      alt={guitar.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">
                      No image
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  
                  {/* Status Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {guitar.prices?.promo && (
                      <span className="inline-flex rounded-full bg-purple-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        🔥 Promo
                      </span>
                    )}
                    {!guitar.prices && (
                      <span className="inline-flex rounded-full bg-red-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        No Price
                      </span>
                    )}
                  </div>

                  </div>

                {/* Content */}
                <div className="relative z-10 flex flex-1 flex-col gap-3 p-5">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                      {guitar.series}
                    </p>
                    <h3 className="text-base font-semibold text-white">
                      {guitar.name}
                    </h3>
                    <p className="text-xs text-neutral-500">SKU: {guitar.sku}</p>
                  </div>

                  {/* Pricing Info — RRP only; dealer price = RRP × (1 − account discount %) */}
                  <div className="space-y-2 rounded-xl bg-white/5 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-neutral-400">RRP (AUD)</span>
                      <span className="text-lg font-bold text-accent">
                        {formatPrice(
                          guitar.baseRrp ?? guitar.prices?.rrp ?? null,
                          guitar.prices?.currency,
                        )}
                      </span>
                    </div>
                    {/* Variant RRP (string count) */}
                    {guitar.options &&
                      guitar.prices?.rrp != null &&
                      (() => {
                        const stringsOption = guitar.options.find(
                          (o) =>
                            o.optionId === "strings" ||
                            o.label.toLowerCase().includes("string"),
                        );
                        if (!stringsOption || stringsOption.values.length === 0)
                          return null;
                        return (
                          <div className="mt-2 border-t border-white/10 pt-2">
                            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                              RRP by variant
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                              {stringsOption.values.map((v) => {
                                const rrpAdj = v.rrpAdjustment ?? 0;
                                const variantRrp = guitar.prices!.rrp! + rrpAdj;
                                return (
                                  <span
                                    key={v.valueId}
                                    className="text-neutral-300"
                                  >
                                    {v.label}:{" "}
                                    <span className="font-medium text-white">
                                      {formatPrice(
                                        variantRrp,
                                        guitar.prices?.currency,
                                      )}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    {guitar.prices?.currency && (
                      <p className="text-[10px] text-neutral-500">
                        Currency: {guitar.prices.currency}
                      </p>
                    )}
                  </div>

                  {/* Edit Button */}
                  <Link
                    href={`/admin/pricing/${guitar.id}`}
                    className="relative z-10 mt-auto rounded-2xl bg-accent px-6 py-3 text-center text-sm font-bold text-black shadow-lg transition-all duration-300 hover:scale-105 hover:bg-accent-soft hover:shadow-xl hover:shadow-accent/30"
                    style={{ backgroundColor: '#F97316', color: '#000000' }}
                  >
                    Edit Pricing
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AdminGuard>
  );
}

