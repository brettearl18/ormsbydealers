import type { OrderStatus } from "@/lib/types";

/** Statuses dealers should not see in default lists (still exist for admin / archive). */
export const DEALER_HIDDEN_ORDER_STATUSES: OrderStatus[] = ["DRAFT", "CANCELLED"];

export function isDealerVisibleOrderStatus(status: OrderStatus): boolean {
  return !DEALER_HIDDEN_ORDER_STATUSES.includes(status);
}

export function filterDealerVisibleOrders<T extends { status: OrderStatus }>(
  orders: T[],
): T[] {
  return orders.filter((o) => isDealerVisibleOrderStatus(o.status));
}
