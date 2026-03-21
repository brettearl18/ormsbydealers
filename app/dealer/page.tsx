"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveAccountId, useDealerView } from "@/lib/dealer-view-context";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchDealerGuitars, type DealerGuitar } from "@/lib/dealer-guitars";
import { FilterBar, type GuitarFilters } from "@/components/guitars/FilterBar";
import { GuitarCard } from "@/components/guitars/GuitarCard";
import { GuitarCardSkeleton } from "@/components/LoadingSkeleton";
import { QuickViewModal } from "@/components/guitars/QuickViewModal";
import type { FxRatesDoc } from "@/lib/types";
import { fetchDealerFxRates } from "@/lib/fx-client";
import { resolveDisplayCurrency } from "@/lib/display-currency";

export default function DealerDashboard() {
  const { user, loading } = useAuth();
  const effectiveAccountId = useEffectiveAccountId();
  const { isAdminDealerPreview } = useDealerView();
  const router = useRouter();
  const [guitars, setGuitars] = useState<DealerGuitar[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountResolved, setAccountResolved] = useState<{
    tierId: string;
    currency: string;
  } | null>(null);
  const [filters, setFilters] = useState<GuitarFilters>({
    search: "",
    series: "",
  });
  const [sortBy, setSortBy] = useState<"name" | "price-low" | "price-high">(
    "name",
  );
  const [quickViewGuitar, setQuickViewGuitar] =
    useState<DealerGuitar | null>(null);
  const [fxRates, setFxRates] = useState<FxRatesDoc | null>(null);
  /** Currency chosen by dealer for display (defaults to account currency) */
  const [displayCurrency, setDisplayCurrency] = useState<string>("AUD");

  // Load account doc so we have saved currency (and tier when claims missing)
  useEffect(() => {
    if (!effectiveAccountId) {
      setAccountResolved(null);
      return;
    }
    const accountId = effectiveAccountId;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "accounts", accountId));
        if (!cancelled && snap.exists()) {
          const d = snap.data() as { tierId?: string; currency?: string };
          setAccountResolved({
            tierId: d.tierId || user?.tierId || "TIER_A",
            currency: d.currency || "AUD",
          });
        } else if (!cancelled) {
          setAccountResolved({
            tierId: user?.tierId || "TIER_A",
            currency: user?.currency || "AUD",
          });
        }
      } catch {
        if (!cancelled)
          setAccountResolved({
            tierId: user?.tierId || "TIER_A",
            currency: user?.currency || "AUD",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveAccountId, user?.tierId, user?.currency]);

  // Live FX (Frankfurter via /api/fx/latest), Firestore fallback
  useEffect(() => {
    let cancelled = false;
    fetchDealerFxRates(db).then((data) => {
      if (!cancelled && data) setFxRates(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Use defaults when pricing not set so dealers can access without tier/currency configured
  const effectiveTierId = user?.tierId ?? accountResolved?.tierId ?? "TIER_A";
  /** Account doc (Settings) overrides JWT claims for currency */
  const effectiveCurrency = resolveDisplayCurrency(
    accountResolved ? { currency: accountResolved.currency } : null,
    user,
  );

  // Default display currency to saved account preference whenever it loads/updates
  useEffect(() => {
    setDisplayCurrency(effectiveCurrency);
  }, [effectiveCurrency]);

  useEffect(() => {
    const accountId = effectiveAccountId;
    if (!accountId) return;
    let cancelled = false;
    async function run() {
      setFetching(true);
      setError(null);
      try {
        const data = await fetchDealerGuitars({
          accountId: accountId as string,
          tierId: effectiveTierId,
          currency: effectiveCurrency,
        });
        if (!cancelled) setGuitars(data);
      } catch (err) {
        if (!cancelled) setError("Unable to load guitars right now.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [effectiveAccountId, effectiveTierId, effectiveCurrency]);

  useEffect(() => {
    if (loading || user) return;
    const t = setTimeout(() => {
      router.push("/login");
    }, 200);
    return () => clearTimeout(t);
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading your account…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (user.role === "ADMIN" && !isAdminDealerPreview) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="max-w-md text-center text-sm text-neutral-400">
          Use <strong className="text-neutral-300">View as dealer</strong> on an account in Admin → Accounts to preview the catalog as that dealer.
        </p>
      </main>
    );
  }

  if (!effectiveAccountId) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="max-w-sm text-center text-sm text-neutral-400">
          Your account isn’t fully set up yet. Please contact Ormsby to complete
          your dealer setup.
        </p>
      </main>
    );
  }

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
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "price-low") {
        const priceA = a.price.value ?? Infinity;
        const priceB = b.price.value ?? Infinity;
        return priceA - priceB;
      }
      if (sortBy === "price-high") {
        const priceA = a.price.value ?? -Infinity;
        const priceB = b.price.value ?? -Infinity;
        return priceB - priceA;
      }
      return 0;
    });

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">
              Product Catalog
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Available to order
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Browse our current inventory and submit purchase orders
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-neutral-800 bg-surface/80 px-4 py-2 text-xs font-medium uppercase tracking-wide transition hover:border-accent hover:text-accent-soft"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <FilterBar value={filters} onChange={setFilters} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-500">
              {fetching
                ? "Loading guitars…"
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
                className="rounded-lg border border-neutral-800 bg-black/40 px-3 py-1.5 text-xs text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="name">Name A-Z</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">Currency:</label>
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="rounded-lg border border-neutral-800 bg-black/40 px-3 py-1.5 text-xs text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="AUD">AUD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>
          {!isAdminDealerPreview && (
            <Link
              href="/cart"
              className="rounded-full border border-neutral-800 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide transition hover:border-accent hover:text-accent-soft"
            >
              View cart
            </Link>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          </div>
        )}

        {fetching ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <GuitarCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-surface/80 p-12 text-center">
            <p className="text-sm text-neutral-400">
              {guitars.length === 0
                ? "No guitars available at this time."
                : "No guitars match your filters."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((g) => {
              const rate =
                displayCurrency !== "AUD" && fxRates?.rates[displayCurrency];
              const displayValue =
                g.price.value != null && rate
                  ? g.price.value * rate
                  : g.price.value;
              const displayRrp =
                g.rrp != null && rate ? g.rrp * rate : g.rrp ?? null;
              return (
                <GuitarCard
                  key={g.id}
                  id={g.id}
                  sku={g.sku}
                  name={g.name}
                  series={g.series}
                  heroImage={g.heroImage}
                  availability={g.availability}
                  price={{
                    value: displayValue,
                    currency: displayCurrency,
                    note:
                      g.price.source === "PROMO"
                        ? "Promo price"
                        : g.price.source === "ACCOUNT_OVERRIDE"
                        ? "Account-specific price"
                        : g.price.source === "TIER"
                        ? `Tier ${effectiveTierId} price`
                        : null,
                  }}
                  rrp={displayRrp}
                  discountPercent={g.discountPercent}
                  unitPriceAud={g.price.value}
                  onQuickView={() => setQuickViewGuitar(g)}
                />
              );
            })}
          </div>
        )}
      </section>

      <QuickViewModal
        guitar={quickViewGuitar}
        currency={displayCurrency}
        tierId={effectiveTierId}
        fxRates={fxRates}
        priceNote={
          quickViewGuitar
            ? quickViewGuitar.price.source === "PROMO"
              ? "Promo price"
              : quickViewGuitar.price.source === "ACCOUNT_OVERRIDE"
              ? "Account-specific price"
              : quickViewGuitar.price.source === "TIER"
              ? `Tier ${effectiveTierId} price`
              : null
            : null
        }
        isOpen={quickViewGuitar !== null}
        onClose={() => setQuickViewGuitar(null)}
      />
    </main>
  );
}


