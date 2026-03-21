"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  OrderDoc,
  GuitarDoc,
  AccountRequestDoc,
  OrderLineDoc,
  AccountDoc,
} from "@/lib/types";
import {
  ShoppingBagIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import {
  buildOrderActivity,
  formatRelativeTime,
  readAdminOrdersLastSeenMs,
  writeAdminOrdersLastSeenAsAllReadNow,
  type OrderActivityItem,
} from "@/lib/admin-order-notifications";

const ORDER_STATUS_SHORT: Record<OrderDoc["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

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
  const [orderNotifications, setOrderNotifications] = useState<OrderActivityItem[]>([]);
  const [unreadOrderCount, setUnreadOrderCount] = useState(0);
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

    async function loadDashboard(background: boolean) {
      if (!background) {
        setLoading(true);
      }
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
        const accountNames = new Map<string, string>();
        accountsSnap.forEach((docSnap) => {
          const d = docSnap.data() as AccountDoc;
          accountNames.set(docSnap.id, d.name?.trim() || `Account ${docSnap.id.slice(0, 6)}`);
        });

        const lastSeen = readAdminOrdersLastSeenMs();
        const { items: activityItems, unreadCount } = buildOrderActivity(
          orders,
          accountNames,
          lastSeen,
          15,
        );
        setOrderNotifications(activityItems);
        setUnreadOrderCount(unreadCount);

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
        if (!background) {
          setLoading(false);
        }
      }
    }

    void loadDashboard(false);
    const interval = setInterval(() => void loadDashboard(true), 45_000);
    return () => clearInterval(interval);
  }, [user, authLoading, router]);

  function markAllOrderNotificationsRead() {
    writeAdminOrdersLastSeenAsAllReadNow();
    setOrderNotifications((prev) => prev.map((row) => ({ ...row, isUnread: false })));
    setUnreadOrderCount(0);
  }

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

      {/* Order notifications */}
      <section className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.09] to-black/20 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 ring-1 ring-amber-500/30">
              <BellAlertIcon className="h-6 w-6 text-amber-300" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Order notifications
              </h2>
              <p className="mt-1 max-w-xl text-sm text-neutral-400">
                Submitted and draft orders (plus any that need revision review). Approved and
                in‑pipeline orders are hidden here unless a dealer revision or confirmation is still
                open. Unread = updated since you last marked read. Refreshes every 45 seconds.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {unreadOrderCount > 0 ? (
              <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-black">
                {unreadOrderCount} unread
              </span>
            ) : (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-500">
                All caught up
              </span>
            )}
            <button
              type="button"
              onClick={markAllOrderNotificationsRead}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-200 transition hover:border-white/25 hover:bg-white/10"
            >
              Mark all as read
            </button>
            <Link
              href="/admin/orders"
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-black transition hover:bg-accent-soft"
            >
              View all orders
            </Link>
          </div>
        </div>

        <ul className="mt-5 space-y-2" aria-label="Recent order activity">
          {orderNotifications.length === 0 ? (
            <li className="rounded-2xl border border-white/5 bg-black/20 px-4 py-6 text-center text-sm text-neutral-500">
              {stats.totalOrders > 0 ? (
                <>
                  Nothing in this feed right now — approved / in‑production / shipped / completed
                  orders stay in{" "}
                  <Link href="/admin/orders" className="text-accent-soft underline hover:text-accent">
                    View all orders
                  </Link>
                  . They reappear here if a dealer revision or confirmation is pending.
                </>
              ) : (
                "No orders in the system yet."
              )}
            </li>
          ) : (
            orderNotifications.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/orders/${row.id}`}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:border-amber-500/35 hover:bg-white/[0.04] ${
                    row.isUnread
                      ? "border-amber-500/40 bg-amber-500/[0.07]"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      row.isUnread ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "bg-neutral-600"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-white">
                        #{row.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          row.kind === "new"
                            ? "bg-emerald-500/25 text-emerald-200"
                            : "bg-blue-500/20 text-blue-200"
                        }`}
                      >
                        {row.kind === "new" ? "New order" : "Updated"}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-neutral-400">
                        {ORDER_STATUS_SHORT[row.status]}
                      </span>
                      {row.highlights.map((h) => (
                        <span
                          key={h}
                          className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-100/90"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {row.accountName ?? "Account"}{" "}
                      <span className="text-neutral-600">·</span>{" "}
                      <span className="font-mono text-[11px]">{row.accountId.slice(0, 8)}…</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {formatRelativeTime(row.updatedAtMs)}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

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
              const orderBadge =
                action.href === "/admin/orders" && unreadOrderCount > 0
                  ? unreadOrderCount
                  : null;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between rounded-2xl px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 text-accent">
                      <Icon className="h-4 w-4" />
                      {orderBadge != null && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-black">
                          {orderBadge > 99 ? "99+" : orderBadge}
                        </span>
                      )}
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

