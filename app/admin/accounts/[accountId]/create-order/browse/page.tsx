"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchDealerGuitars, type DealerGuitar } from "@/lib/dealer-guitars";
import { AccountDoc } from "@/lib/types";
import { FilterBar, type GuitarFilters } from "@/components/guitars/FilterBar";
import { GuitarCardSkeleton } from "@/components/LoadingSkeleton";
import { AvailabilityBadge } from "@/components/guitars/AvailabilityBadge";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function AdminCreateOrderBrowsePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(
    null,
  );
  const [guitars, setGuitars] = useState<DealerGuitar[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GuitarFilters>({
    search: "",
    series: "",
  });
  const [sortBy, setSortBy] = useState<"name" | "price-low" | "price-high">(
    "name",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "accounts", accountId));
        if (!cancelled && snap.exists()) {
          setAccount({ id: snap.id, ...(snap.data() as AccountDoc) });
        }
      } catch {
        if (!cancelled) setAccount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      setError(null);
      try {
        const data = await fetchDealerGuitars({ accountId });
        if (!cancelled) setGuitars(data);
      } catch {
        if (!cancelled) setError("Unable to load guitars.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const filtered = guitars
    .filter((g) => {
      if (filters.series && g.series !== filters.series) return false;
      if (!filters.search.trim()) return true;
      const term = filters.search.toLowerCase();
      return (
        g.name.toLowerCase().includes(term) ||
        g.sku.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price-low") {
        const pa = a.price.value ?? Infinity;
        const pb = b.price.value ?? Infinity;
        return pa - pb;
      }
      if (sortBy === "price-high") {
        const pa = a.price.value ?? -Infinity;
        const pb = b.price.value ?? -Infinity;
        return pb - pa;
      }
      return 0;
    });

  const moneyAud = (n: number | null) =>
    n == null
      ? "—"
      : new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: "AUD",
        }).format(n);

  return (
    <AdminGuard>
      <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/admin/accounts/${accountId}/create-order`}
              className="mb-3 inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to order draft
            </Link>
            <h1 className="text-2xl font-semibold text-white">
              Add guitars — {account?.name ?? accountId}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Open a product to choose options, then add to this account&apos;s
              draft order.
            </p>
          </div>
        </div>

        <FilterBar value={filters} onChange={setFilters} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-neutral-500">
            {fetching
              ? "Loading…"
              : `${filtered.length} product${filtered.length !== 1 ? "s" : ""}`}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-500">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "name" | "price-low" | "price-high",
                )
              }
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white"
            >
              <option value="name">Name A-Z</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {fetching ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <GuitarCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-neutral-500">No guitars match filters.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((g) => (
              <Link
                key={g.id}
                href={`/admin/accounts/${accountId}/create-order/guitars/${g.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-accent/40 hover:bg-white/[0.07]"
              >
                <div className="relative aspect-[4/6] w-full overflow-hidden bg-neutral-900">
                  {g.heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.heroImage}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-600">
                      No image
                    </div>
                  )}
                  <div className="absolute right-2 top-2">
                    <AvailabilityBadge
                      state={g.availability.state}
                      etaDate={g.availability.etaDate}
                      batchName={g.availability.batchName}
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-xs uppercase tracking-wide text-accent-soft">
                    {g.series}
                  </p>
                  <h2 className="font-semibold text-white">{g.name}</h2>
                  <p className="font-mono text-xs text-neutral-500">{g.sku}</p>
                  <p className="mt-auto text-lg font-bold text-accent">
                    {moneyAud(g.price.value)}
                    {g.discountPercent && g.discountPercent > 0 ? (
                      <span className="ml-2 text-xs font-normal text-neutral-500">
                        ({g.discountPercent}% off RRP)
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
