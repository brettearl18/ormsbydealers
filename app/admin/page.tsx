"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, GuitarDoc, AccountRequestDoc, AvailabilityDoc } from "@/lib/types";
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
      available: number;
      allocated: number;
      state: string;
      etaDate?: string | null;
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

        // Fetch availability for inventory counts
        const availabilityRef = collection(db, "availability");
        const availabilitySnap = await getDocs(availabilityRef);
        const availabilityMap = new Map<string, AvailabilityDoc>();
        availabilitySnap.docs.forEach((doc) => {
          availabilityMap.set(doc.id, doc.data() as AvailabilityDoc);
        });

        const inventoryRows = guitars.map((g) => {
          const availability = availabilityMap.get(g.id);
          return {
            id: g.id,
            sku: g.sku,
            name: g.name,
            series: g.series,
            available: availability?.qtyAvailable ?? 0,
            allocated: availability?.qtyAllocated ?? 0,
            state: availability?.state ?? "UNKNOWN",
            etaDate: availability?.etaDate ?? null,
          };
        });

        // Fetch orders
        const ordersRef = collection(db, "orders");
        const ordersSnap = await getDocs(ordersRef);
        const orders = ordersSnap.docs.map((doc) => doc.data() as OrderDoc);
        const pendingOrders = orders.filter(
          (o) => o.status === "SUBMITTED" || o.status === "APPROVED"
        ).length;

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
            const totalA = a.available + a.allocated;
            const totalB = b.available + b.allocated;
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
      <header>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
            Admin Dashboard
          </span>
        </h1>
        <p className="mt-3 text-base text-neutral-400 sm:text-lg">
          Manage guitars, orders, pricing, and accounts
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="glass-strong rounded-3xl p-6 shadow-xl">
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

        <div className="glass-strong rounded-3xl p-6 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Total Orders
            </p>
            <DocumentTextIcon className="h-5 w-5 text-neutral-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalOrders}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {stats.pendingOrders} pending
          </p>
        </div>

        <div className="glass-strong rounded-3xl p-6 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Accounts
            </p>
            <UserGroupIcon className="h-5 w-5 text-neutral-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalAccounts}</p>
        </div>

        <div className="glass-strong rounded-3xl p-6 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Pending Orders
            </p>
            <ClockIcon className="h-5 w-5 text-accent" />
          </div>
          <p className="text-3xl font-bold text-accent">{stats.pendingOrders}</p>
        </div>
        
        <Link
          href="/admin/accounts?tab=requests"
          className="glass-strong rounded-3xl p-6 shadow-xl transition-all hover:scale-105"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Account Requests
            </p>
            <UserGroupIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-400">{stats.pendingRequests}</p>
          {stats.pendingRequests > 0 && (
            <p className="mt-1 text-xs text-yellow-400">Needs approval</p>
          )}
        </Link>

        <div className="glass-strong rounded-3xl p-6 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Active
            </p>
            <CheckCircleIcon className="h-5 w-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">{stats.activeGuitars}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">
          Quick Actions
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group glass-strong rounded-3xl p-6 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <div className="mb-4 inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {action.title}
                </h3>
                <p className="text-sm text-neutral-400">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Inventory Overview */}
      <div>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">
          Inventory Overview
        </h2>
        <p className="mb-4 text-sm text-neutral-400">
          Live snapshot of available and allocated stock by model.
        </p>
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Allocated</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">ETA</th>
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
                      {item.available}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-neutral-300">
                      {item.allocated}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.state === "IN_STOCK"
                            ? "bg-green-500/15 text-green-400"
                            : item.state === "ALLOCATED"
                            ? "bg-yellow-500/15 text-yellow-400"
                            : item.state === "PREORDER"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-neutral-500/15 text-neutral-400"
                        }`}
                      >
                        {item.state.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-neutral-400">
                      {item.etaDate
                        ? new Date(item.etaDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

