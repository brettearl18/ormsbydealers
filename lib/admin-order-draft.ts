/**
 * Session-scoped cart for admin "create order on behalf of account" flow.
 * Isolated from the dealer global cart in localStorage.
 */

export type AdminOrderDraftItem = {
  guitarId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  qty: number;
  /** Dealer unit price (AUD) at time of add — matches dealer checkout / submitOrder lines */
  unitPrice: number;
  selectedOptions?: Record<string, string>;
};

function storageKey(accountId: string) {
  return `ormsby-admin-order-draft-v1-${accountId}`;
}

export function loadAdminOrderDraft(accountId: string): AdminOrderDraftItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminOrderDraftItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAdminOrderDraft(
  accountId: string,
  items: AdminOrderDraftItem[],
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey(accountId), JSON.stringify(items));
}

export function addToAdminOrderDraft(
  accountId: string,
  item: Omit<AdminOrderDraftItem, "qty"> & { qty?: number },
) {
  const items = loadAdminOrderDraft(accountId);
  const qty = item.qty ?? 1;
  const existingIdx = items.findIndex(
    (i) =>
      i.guitarId === item.guitarId &&
      JSON.stringify(i.selectedOptions || {}) ===
        JSON.stringify(item.selectedOptions || {}),
  );
  if (existingIdx >= 0) {
    items[existingIdx] = {
      ...items[existingIdx],
      qty: items[existingIdx].qty + qty,
      unitPrice: item.unitPrice,
      sku: item.sku,
      name: item.name,
      imageUrl: item.imageUrl,
      selectedOptions: item.selectedOptions,
    };
  } else {
    items.push({
      guitarId: item.guitarId,
      sku: item.sku,
      name: item.name,
      imageUrl: item.imageUrl,
      qty,
      unitPrice: item.unitPrice,
      selectedOptions: item.selectedOptions,
    });
  }
  saveAdminOrderDraft(accountId, items);
}

export function clearAdminOrderDraft(accountId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey(accountId));
}
