import { Timestamp } from "firebase/firestore";
import type { OrderDoc } from "@/lib/types";

export const ADMIN_ORDERS_LAST_SEEN_KEY = "ormsby_admin_orders_last_seen_ms";

/** In-tab fallback when localStorage/sessionStorage throw (private mode, strict ITP). */
let memoryLastSeenMs = 0;

/** Parse Firestore Timestamp, ISO string, or legacy { seconds } to epoch ms. */
export function firestoreDateToMs(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const v = value as { toDate: () => Date };
    if (typeof v.toDate === "function") {
      return v.toDate().getTime();
    }
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const s = (value as { seconds: number }).seconds;
    if (typeof s === "number") return s * 1000;
  }
  return 0;
}

export type OrderActivityKind = "new" | "updated";

export interface OrderActivityItem {
  id: string;
  accountId: string;
  accountName: string | undefined;
  status: OrderDoc["status"];
  updatedAtMs: number;
  createdAtMs: number;
  isUnread: boolean;
  kind: OrderActivityKind;
  highlights: string[];
}

function parseStoredMs(raw: string | null): number {
  if (raw == null || raw === "") return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function readAdminOrdersLastSeenMs(): number {
  if (typeof window === "undefined") return memoryLastSeenMs;
  let fromLocal = 0;
  let fromSession = 0;
  try {
    fromLocal = parseStoredMs(window.localStorage.getItem(ADMIN_ORDERS_LAST_SEEN_KEY));
  } catch {
    /* private mode / blocked storage */
  }
  try {
    fromSession = parseStoredMs(window.sessionStorage.getItem(ADMIN_ORDERS_LAST_SEEN_KEY));
  } catch {
    /* ignore */
  }
  return Math.max(memoryLastSeenMs, fromLocal, fromSession);
}

export function writeAdminOrdersLastSeenMs(ms: number): void {
  memoryLastSeenMs = ms;
  if (typeof window === "undefined") return;
  const s = String(ms);
  try {
    window.localStorage.setItem(ADMIN_ORDERS_LAST_SEEN_KEY, s);
  } catch {
    /* continue — session + memory still help */
  }
  try {
    window.sessionStorage.setItem(ADMIN_ORDERS_LAST_SEEN_KEY, s);
  } catch {
    /* memoryLastSeenMs still applies this session */
  }
}

/**
 * Buffer when marking all read so Firestore `updatedAt` (server time) is not still
 * slightly ahead of the client clock on the next poll — otherwise rows stay “unread”.
 */
export const ADMIN_ORDER_NOTIFS_READ_BUFFER_MS = 120_000;

/** Call from “Mark all as read” on the admin dashboard. */
export function writeAdminOrdersLastSeenAsAllReadNow(): void {
  writeAdminOrdersLastSeenMs(Date.now() + ADMIN_ORDER_NOTIFS_READ_BUFFER_MS);
}

/**
 * Dashboard “Order notifications” is an action feed: hide orders that are already
 * approved / in the production pipeline unless something still needs staff attention.
 */
const HIDDEN_FROM_ADMIN_FEED_UNLESS_ATTENTION: OrderDoc["status"][] = [
  "APPROVED",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
];

export function shouldShowOrderInAdminNotificationFeed(o: OrderDoc): boolean {
  if (o.pendingOrmsbyRevisionReview === true) return true;
  if (o.dealerPendingAdminProposedChanges === true) return true;
  if (!HIDDEN_FROM_ADMIN_FEED_UNLESS_ATTENTION.includes(o.status)) return true;
  return false;
}

export function buildOrderActivity(
  orders: Array<OrderDoc & { id: string }>,
  accountNames: Map<string, string>,
  lastSeenMs: number,
  maxItems = 15,
): { items: OrderActivityItem[]; unreadCount: number } {
  const feedOrders = orders.filter(shouldShowOrderInAdminNotificationFeed);

  const unreadCount = feedOrders.filter(
    (o) => firestoreDateToMs(o.updatedAt) > lastSeenMs,
  ).length;

  const items: OrderActivityItem[] = feedOrders
    .map((o) => {
      const updatedAtMs = firestoreDateToMs(o.updatedAt);
      const createdAtMs = firestoreDateToMs(o.createdAt);
      const highlights: string[] = [];
      if (o.pendingOrmsbyRevisionReview) {
        highlights.push("Dealer revision pending");
      }
      if (o.dealerPendingAdminProposedChanges) {
        highlights.push("Awaiting dealer confirmation");
      }
      if (o.dealerNotifiedOrmsbyOfUpdatesAt && !o.pendingOrmsbyRevisionReview) {
        highlights.push("Update notified");
      }
      const ageMs = Date.now() - createdAtMs;
      const isLikelyNew =
        createdAtMs > 0 &&
        Math.abs(updatedAtMs - createdAtMs) < 120_000 &&
        ageMs < 7 * 24 * 60 * 60 * 1000;

      return {
        id: o.id,
        accountId: o.accountId,
        accountName: accountNames.get(o.accountId),
        status: o.status,
        updatedAtMs,
        createdAtMs,
        isUnread: updatedAtMs > lastSeenMs,
        kind: isLikelyNew ? ("new" as const) : ("updated" as const),
        highlights,
      };
    })
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, maxItems);

  return { items, unreadCount };
}

export function formatRelativeTime(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
