"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OrderDoc, GuitarDoc } from "@/lib/types";
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
  });
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
        const guitars = guitarsSnap.docs.map((doc) => doc.data() as GuitarDoc);
        const activeGuitars = guitars.filter((g) => g.status === "ACTIVE").length;

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

        setStats({
          totalGuitars: guitars.length,
          activeGuitars,
          totalOrders: orders.length,
          pendingOrders,
          totalAccounts: accountsSnap.size,
        });
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              Pending
            </p>
            <ClockIcon className="h-5 w-5 text-accent" />
          </div>
          <p className="text-3xl font-bold text-accent">{stats.pendingOrders}</p>
        </div>

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
    </main>
  );
}

