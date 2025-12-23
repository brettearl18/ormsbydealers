"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, GuitarDoc, AccountRequestDoc, OrderLineDoc } from "@/lib/types";
import {
  ShoppingBagIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalGuitars: 0,
    activeGuitars: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalAccounts: 0,
    pendingRequests: 0,
  });
  const [recentRequests, setRecentRequests] = useState<Array<AccountRequestDoc & { id: string }>>([]);
  const [inventory, setInventory] = useState<
    Array<{
      id: string;
      sku: string;
      name: string;
      series: string;
      totalOrdered: number;
      pendingOrdered: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    async function fetchStats() {
      setLoading(true);
      try {
        // Fetch guitars
        const guitarsRef = collection(db, "guitars");
        const guitarsSnap = await getDocs(guitarsRef);
        const guitars = guitarsSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as GuitarDoc),
        })) as Array<GuitarDoc & { id: string }>;
        const activeGuitars = guitars.filter((g) => g.status === "ACTIVE").length;

        // Fetch orders
        const ordersRef = collection(db, "orders");
        const ordersSnap = await getDocs(ordersRef);
        const orders = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as OrderDoc),
        })) as Array<OrderDoc & { id: string }>;
        const pendingOrders = orders.filter(
          (o) => o.status === "SUBMITTED" || o.status === "APPROVED"
        ).length;

        // Build guitar order tallies from order lines
        const totalsByGuitar = new Map<
          string,
          { totalOrdered: number; pendingOrdered: number }
        >();

        const pendingStatuses: OrderDoc["status"][] = [
          "SUBMITTED",
          "APPROVED",
          "IN_PRODUCTION",
        ];

        for (const order of orders) {
          const linesRef = collection(db, "orders", order.id, "lines");
          const linesSnap = await getDocs(linesRef);
          const lines = linesSnap.docs.map((doc) => doc.data() as OrderLineDoc);

          for (const line of lines) {
            const current = totalsByGuitar.get(line.guitarId) ?? {
              totalOrdered: 0,
              pendingOrdered: 0,
            };
            current.totalOrdered += line.qty;
            if (pendingStatuses.includes(order.status)) {
              current.pendingOrdered += line.qty;
            }
            totalsByGuitar.set(line.guitarId, current);
          }
        }

        const inventoryRows = guitars
          .filter((g) => totalsByGuitar.has(g.id))
          .map((g) => {
            const totals = totalsByGuitar.get(g.id)!;
            return {
              id: g.id,
              sku: g.sku,
              name: g.name,
              series: g.series,
              totalOrdered: totals.totalOrdered,
              pendingOrdered: totals.pendingOrdered,
            };
          });

        // Fetch accounts
        const accountsRef = collection(db, "accounts");
        const accountsSnap = await getDocs(accountsRef);

        // Fetch pending account requests
        const requestsRef = collection(db, "accountRequests");
        const requestsQuery = query(requestsRef, where("status", "==", "PENDING"));
        const requestsSnap = await getDocs(requestsQuery);
        const requestsData = requestsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Array<AccountRequestDoc & { id: string }>;
        
        // Sort by requestedAt descending and take first 3
        const sortedRequests = requestsData.sort((a, b) => {
          const dateA = new Date(a.requestedAt || 0).getTime();
          const dateB = new Date(b.requestedAt || 0).getTime();
          return dateB - dateA;
        }).slice(0, 3);

        setStats({
          totalGuitars: guitars.length,
          activeGuitars,
          totalOrders: orders.length,
          pendingOrders,
          totalAccounts: accountsSnap.size,
          pendingRequests: requestsSnap.size,
        });
        setRecentRequests(sortedRequests);
        setInventory(
          inventoryRows.sort((a, b) => {
            const totalA = a.totalOrdered;
            const totalB = b.totalOrdered;
            return totalB - totalA;
          }),
        );
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading admin dashboard…</p>
      </main>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  const quickActions = [
    {
      title: "Manage Guitars",
      description: "Add, edit, or remove guitars",
      href: "/admin/guitars",
      icon: ShoppingBagIcon,
      color: "accent",
    },
    {
      title: "Manage Orders",
      description: "View and update order status",
      href: "/admin/orders",
      icon: DocumentTextIcon,
      color: "blue",
    },
    {
      title: "Manage Pricing",
      description: "Set prices, tiers, and promotions",
      href: "/admin/pricing",
      icon: CurrencyDollarIcon,
      color: "green",
    },
    {
      title: "Manage Accounts",
      description: "View and edit dealer accounts",
      href: "/admin/accounts",
      icon: UserGroupIcon,
      color: "purple",
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-500">
            Overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Admin dashboard
          </h1>
          <p className="mt-2 text-sm text-neutral-400 sm:text-base">
            Quiet, at-a-glance view of guitars, orders, and dealer activity.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="rounded-full border border-white/10 px-3 py-1">
            {stats.totalGuitars} guitars · {stats.totalOrders} orders
          </span>
          <span className="hidden rounded-full border border-white/10 px-3 py-1 md:inline-flex">
            {stats.pendingOrders} pending orders · {stats.pendingRequests} requests
          </span>
        </div>
      </header>

      {/* Stats + Quick actions */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <div className="rounded-3xl border border-white/5 bg-white/5/50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Total Guitars
            </p>
            <ShoppingBagIcon className="h-5 w-5 text-neutral-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalGuitars}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {stats.activeGuitars} active
          </p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/5/50 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total Orders
              </p>
              <DocumentTextIcon className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="text-3xl font-semibold text-white">
              {stats.totalOrders}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {stats.pendingOrders} pending
            </p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/5/50 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Accounts
              </p>
              <UserGroupIcon className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="text-3xl font-semibold text-white">
              {stats.totalAccounts}
            </p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/5/50 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Pending Orders
              </p>
              <ClockIcon className="h-5 w-5 text-accent" />
            </div>
            <p className="text-3xl font-semibold text-accent">
              {stats.pendingOrders}
            </p>
          </div>

          <Link
            href="/admin/accounts?tab=requests"
            className="rounded-3xl border border-white/5 bg-white/5/50 p-5 transition-colors hover:border-yellow-400/60"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Account Requests
              </p>
              <UserGroupIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-semibold text-yellow-400">
              {stats.pendingRequests}
            </p>
            {stats.pendingRequests > 0 && (
              <p className="mt-1 text-xs text-yellow-400">
                Tap to review and approve
              </p>
            )}
          </Link>

          <div className="rounded-3xl border border-white/5 bg-white/5/50 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Active Models
              </p>
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-3xl font-semibold text-green-400">
              {stats.activeGuitars}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <aside className="rounded-3xl border border-white/5 bg-white/5/40 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Quick actions
          </h2>
          <div className="mt-4 space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between rounded-2xl px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 text-accent">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{action.title}</span>
                      <span className="text-[11px] text-neutral-500">
                        {action.description}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-500 group-hover:text-neutral-300">
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </aside>
      </section>

      {/* Inventory Overview */}
      <section className="rounded-3xl border border-white/5 bg-white/5/30 p-5">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">
          Inventory Overview
        </h2>
        <p className="mb-4 text-sm text-neutral-400">
          Tally of guitars ordered across all dealer purchase orders.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/40">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-right">Total Ordered</th>
                <th className="px-4 py-3 text-right">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {inventory.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-xs text-neutral-400"
                  >
                    No inventory data available yet.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr
                    key={item.id}
                    className="transition hover:bg-black/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">
                          {item.name}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {item.series}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-accent">
                      {item.totalOrdered}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-neutral-300">
                      {item.pendingOrdered}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

