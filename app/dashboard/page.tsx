"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, AccountDoc } from "@/lib/types";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentOrdersList } from "@/components/dashboard/RecentOrdersList";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { AccountInfoCard } from "@/components/dashboard/AccountInfoCard";
import { GuitarCard } from "@/components/guitars/GuitarCard";
import { fetchDealerGuitars, type DealerGuitar } from "@/lib/dealer-guitars";
import Link from "next/link";
import {
  ShoppingBagIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [guitars, setGuitars] = useState<DealerGuitar[]>([]);
  const [account, setAccount] = useState<AccountDoc | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!user.accountId || !user.tierId || !user.currency) {
      router.push("/dealer");
      return;
    }

    async function fetchDashboardData() {
      if (!user?.accountId) return;
      
      setFetching(true);
      setError(null);
      try {
        // Fetch recent orders
        const ordersRef = collection(db, "orders");
        const ordersQuery = query(
          ordersRef,
          where("accountId", "==", user.accountId),
          orderBy("createdAt", "desc"),
          limit(10),
        );
        const ordersSnap = await getDocs(ordersQuery);
        const ordersData = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<OrderDoc & { id: string }>;
        setOrders(ordersData);

        // Fetch account info
        const accountSnap = await getDoc(
          doc(db, "accounts", user.accountId),
        );
        if (accountSnap.exists()) {
          setAccount(accountSnap.data() as AccountDoc);
        }

        // Fetch featured guitars (first 6)
        const guitarsData = await fetchDealerGuitars({
          accountId: user.accountId!,
          tierId: user.tierId!,
          currency: user.currency!,
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
  }, [user, authLoading, router]);

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

  // Calculate stats
  const totalOrders = orders.length;
  const submittedOrders = orders.filter((o) => o.status === "SUBMITTED").length;
  const approvedOrders = orders.filter((o) => o.status === "APPROVED").length;
  const inProductionOrders = orders.filter((o) => o.status === "IN_PRODUCTION").length;
  const shippedOrders = orders.filter((o) => o.status === "SHIPPED").length;

  return (
    <main className="flex flex-1 flex-col gap-8">
      {/* Welcome Header - Modern 2025 */}
      <header className="animate-fade-in">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
            Welcome back
          </span>
          {account?.name && (
            <span className="text-accent">, {account.name.split(" ")[0]}</span>
          )}
        </h1>
        <p className="mt-3 text-base text-neutral-400 sm:text-lg">
          Here's what's happening with your account
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Quick Actions & Account Info */}
        <div className="space-y-6 lg:col-span-1">
          <QuickActionsCard />
          <AccountInfoCard
            user={user}
            accountName={account?.name}
            territory={account?.territory}
          />
        </div>

        {/* Center: Recent Orders */}
        <div className="lg:col-span-1">
          <div className="glass-strong rounded-3xl p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
                Recent Orders
              </h3>
              <Link
                href="/orders"
                className="text-xs font-semibold text-accent-soft transition hover:text-accent hover:underline"
              >
                View all →
              </Link>
            </div>
            <RecentOrdersList
              orders={orders}
              currency={user.currency!}
              isLoading={fetching}
            />
          </div>
        </div>

        {/* Right: Featured Products */}
        <div className="lg:col-span-1">
          <div className="glass-strong rounded-3xl p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
                Available to Order
              </h3>
              <Link
                href="/dealer"
                className="text-xs font-semibold text-accent-soft transition hover:text-accent hover:underline"
              >
                View all →
              </Link>
            </div>
            {guitars.length > 0 ? (
              <div className="space-y-3">
                {guitars.slice(0, 3).map((g) => (
                  <Link
                    key={g.id}
                    href={`/dealer/guitars/${g.id}`}
                    className="group block overflow-hidden rounded-2xl border border-white/10 glass p-4 transition-all duration-300 hover:border-accent/30 hover:scale-[1.02] hover:shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      {g.heroImage && (
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-900 ring-2 ring-white/5 transition-all duration-300 group-hover:ring-accent/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={g.heroImage}
                            alt={g.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {g.name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {g.sku}
                        </p>
                        {g.price.value && (
                          <p className="mt-1 text-xs font-semibold text-accent">
                            {user.currency === "USD" ? "$" : user.currency}{" "}
                            {g.price.value.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                No guitars available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Featured Products Grid */}
      {guitars.length > 0 && (
        <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                Featured Guitars
              </span>
            </h2>
            <Link
              href="/dealer"
              className="text-sm font-semibold text-accent-soft transition hover:text-accent hover:underline"
            >
              Browse all guitars →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guitars.slice(0, 6).map((g) => (
              <GuitarCard
                key={g.id}
                id={g.id}
                sku={g.sku}
                name={g.name}
                series={g.series}
                heroImage={g.heroImage}
                availability={g.availability}
                price={{
                  value: g.price.value,
                  currency: user.currency!,
                  note:
                    g.price.source === "PROMO"
                      ? "Promo price"
                      : g.price.source === "ACCOUNT_OVERRIDE"
                      ? "Account-specific price"
                      : g.price.source === "TIER"
                      ? `Tier ${user.tierId} price`
                      : null,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

