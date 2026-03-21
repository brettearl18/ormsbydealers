"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveAccountId, useDealerView } from "@/lib/dealer-view-context";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, AccountDoc } from "@/lib/types";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentOrdersList } from "@/components/dashboard/RecentOrdersList";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { AccountInfoCard } from "@/components/dashboard/AccountInfoCard";
import { GuitarCard } from "@/components/guitars/GuitarCard";
import { fetchDealerGuitars, type DealerGuitar } from "@/lib/dealer-guitars";
import Link from "next/link";
import type { FxRatesDoc } from "@/lib/types";
import { fetchDealerFxRates } from "@/lib/fx-client";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import {
  ShoppingBagIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const effectiveAccountId = useEffectiveAccountId();
  const { isAdminDealerPreview } = useDealerView();
  const router = useRouter();
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [guitars, setGuitars] = useState<DealerGuitar[]>([]);
  const [account, setAccount] = useState<AccountDoc | null>(null);
  const [fxRates, setFxRates] = useState<FxRatesDoc | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDealerFxRates(db).then((data) => {
      if (!cancelled && data) setFxRates(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const t = setTimeout(() => router.push("/login"), 200);
      return () => clearTimeout(t);
    }
    if (user.role === "ADMIN" && !isAdminDealerPreview) {
      const t = setTimeout(() => router.push("/admin/accounts"), 200);
      return () => clearTimeout(t);
    }
    if (user.role !== "ADMIN" && (!user.accountId || !user.tierId)) {
      router.push("/dealer");
      return;
    }
    if (!effectiveAccountId) {
      setFetching(false);
      return;
    }

    async function fetchDashboardData() {
      if (!effectiveAccountId) return;

      setFetching(true);
      setError(null);
      try {
        // Fetch recent orders
        const ordersRef = collection(db, "orders");
        const ordersQuery = query(
          ordersRef,
          where("accountId", "==", effectiveAccountId),
          orderBy("createdAt", "desc"),
          limit(10),
        );
        const ordersSnap = await getDocs(ordersQuery);
        const ordersData = ordersSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamps to ISO strings
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
          };
        }) as Array<OrderDoc & { id: string }>;
        setOrders(ordersData);

        // Fetch account info
        const accountSnap = await getDoc(
          doc(db, "accounts", effectiveAccountId),
        );
        if (accountSnap.exists()) {
          setAccount(accountSnap.data() as AccountDoc);
        }

        // Fetch featured guitars (first 6)
        const acc = accountSnap.exists()
          ? (accountSnap.data() as AccountDoc)
          : null;
        const tierForCatalog = acc?.tierId ?? user?.tierId ?? "TIER_A";
        const guitarsData = await fetchDealerGuitars({
          accountId: effectiveAccountId,
          tierId: tierForCatalog,
          currency: resolveDisplayCurrency(acc, user),
        });
        setGuitars(guitarsData.slice(0, 6));
      } catch (err) {
        console.error(err);
        setError("Unable to load dashboard data");
      } finally {
        setFetching(false);
      }
    }

    fetchDashboardData();
  }, [user, authLoading, router, effectiveAccountId, isAdminDealerPreview]);

  if (authLoading || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading dashboard…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const displayCurrency = resolveDisplayCurrency(account, user);

  // Calculate stats
  const totalOrders = orders.length;
  const submittedOrders = orders.filter((o) => o.status === "SUBMITTED").length;
  const approvedOrders = orders.filter((o) => o.status === "APPROVED").length;
  const inProductionOrders = orders.filter((o) => o.status === "IN_PRODUCTION").length;
  const shippedOrders = orders.filter((o) => o.status === "SHIPPED").length;

  function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return (
    <main className="flex flex-1 flex-col gap-5 sm:gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
            Welcome back
          </span>
          {account?.name && (
            <span className="text-accent">, {account.name.split(" ")[0]}</span>
          )}
        </h1>
        <p className="mt-1.5 text-sm text-neutral-400">
          Here&apos;s what&apos;s happening with your account
        </p>
      </header>

      <AccountInfoCard
        user={user}
        currency={account?.currency}
        accountName={account?.name}
        territory={account?.territory}
        discountPercent={account?.discountPercent ?? null}
      />

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard
          label="Total Orders"
          value={totalOrders}
          icon={<DocumentTextIcon className="h-5 w-5" />}
        />
        <StatsCard
          label="Submitted"
          value={submittedOrders}
          icon={<CheckCircleIcon className="h-5 w-5" />}
        />
        <StatsCard
          label="In Production"
          value={inProductionOrders}
          icon={<ShoppingBagIcon className="h-5 w-5" />}
        />
        <StatsCard
          label="Shipped"
          value={shippedOrders}
          icon={<TruckIcon className="h-5 w-5" />}
        />
      </div>

      {/* Quick actions + orders + preview — equal visual weight, aligned to top */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-3">
          <QuickActionsCard hideCartAndCheckout={isAdminDealerPreview} />
        </div>

        <div className="lg:col-span-5">
          <div className="glass-strong h-full min-h-[200px] rounded-2xl p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                Recent orders
              </h3>
              <Link
                href="/orders"
                className="shrink-0 text-xs font-semibold text-accent-soft hover:text-accent hover:underline"
              >
                View all →
              </Link>
            </div>
            <RecentOrdersList
              orders={orders}
              currency={displayCurrency}
              isLoading={fetching}
              accountName={account?.name}
            />
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="glass-strong h-full min-h-[200px] rounded-2xl p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                Available to order
              </h3>
              <Link
                href="/dealer"
                className="shrink-0 text-xs font-semibold text-accent-soft hover:text-accent hover:underline"
              >
                View all →
              </Link>
            </div>
            {guitars.length > 0 ? (
              <div className="flex flex-col gap-2">
                {guitars.slice(0, 3).map((g) => {
                  const rate =
                    displayCurrency !== "AUD" && fxRates?.rates[displayCurrency];
                  const displayValue =
                    g.price.value != null && rate
                      ? g.price.value * rate
                      : g.price.value;
                  return (
                    <Link
                      key={g.id}
                      href={`/dealer/guitars/${g.id}`}
                      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5 transition hover:border-accent/30 hover:bg-white/[0.04]"
                    >
                      {g.heroImage && (
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={g.heroImage}
                            alt={g.name}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{g.name}</p>
                        <p className="truncate text-[11px] text-neutral-500">{g.sku}</p>
                        {displayValue != null && (
                          <p className="mt-0.5 text-xs font-semibold text-accent">
                            {formatMoney(displayValue, displayCurrency)}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No guitars available</p>
            )}
          </div>
        </div>
      </div>

      {guitars.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                Featured guitars
              </span>
            </h2>
            <Link
              href="/dealer"
              className="text-sm font-semibold text-accent-soft hover:text-accent hover:underline"
            >
              Browse all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {guitars.slice(0, 6).map((g) => {
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
                        ? `Tier ${account?.tierId ?? user.tierId ?? "—"} price`
                        : null,
                  }}
                  rrp={displayRrp}
                  discountPercent={g.discountPercent}
                  unitPriceAud={g.price.value}
                />
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

