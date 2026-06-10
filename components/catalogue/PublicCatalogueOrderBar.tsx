"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ShoppingBagIcon, XMarkIcon } from "@heroicons/react/24/outline";
import {
  readPublicCatalogueCart,
  writePublicCatalogueCart,
  PUBLIC_CATALOGUE_CART_KEY,
  PUBLIC_CATALOGUE_DISCOUNT,
  type PublicCatalogueCartItem,
  cartItemKey,
} from "@/lib/public-catalogue";
import { PublicCatalogueOrderList } from "@/components/catalogue/PublicCatalogueOrderList";

export const PUBLIC_CATALOGUE_CART_EVENT = "public-catalogue-cart-updated";

export function notifyPublicCatalogueCartUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PUBLIC_CATALOGUE_CART_EVENT));
}

/** Call after writing cart so other tabs/components refresh. */
export function writePublicCatalogueCartAndNotify(
  items: PublicCatalogueCartItem[],
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PUBLIC_CATALOGUE_CART_KEY, JSON.stringify(items));
  notifyPublicCatalogueCartUpdated();
}

export function PublicCatalogueOrderBar() {
  const pathname = usePathname();
  const [items, setItems] = useState<PublicCatalogueCartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function refresh() {
    setItems(readPublicCatalogueCart());
  }

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener(PUBLIC_CATALOGUE_CART_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(PUBLIC_CATALOGUE_CART_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname]);

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);

  function persist(next: PublicCatalogueCartItem[]) {
    writePublicCatalogueCartAndNotify(next);
    setItems(next);
  }

  function removeItem(key: string) {
    persist(items.filter((item) => cartItemKey(item) !== key));
  }

  function updateQty(key: string, qty: number) {
    if (qty < 1) {
      removeItem(key);
      return;
    }
    persist(
      items.map((item) =>
        cartItemKey(item) === key ? { ...item, qty: Math.min(99, qty) } : item,
      ),
    );
  }

  function clearCart() {
    persist([]);
    setDrawerOpen(false);
  }

  if (itemCount === 0) return null;

  const formatAud = (n: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20">
              <ShoppingBagIcon className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {itemCount} {itemCount === 1 ? "item" : "items"} in your order
              </p>
              <p className="text-xs text-neutral-400">
                {formatAud(subtotal)} subtotal · tap to view
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-black transition hover:bg-accent-soft"
          >
            View order
          </button>
        </div>
      </div>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
        <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
          <DialogPanel className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-neutral-900 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <DialogTitle className="text-lg font-semibold text-white">
                Your order
              </DialogTitle>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1 text-neutral-400 transition hover:text-white"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <PublicCatalogueOrderList
                items={items}
                onRemove={removeItem}
                onUpdateQty={updateQty}
              />
            </div>

            <div className="border-t border-white/10 bg-neutral-950/80 px-5 py-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-neutral-400">Subtotal (AUD)</span>
                <span className="text-lg font-bold text-white">{formatAud(subtotal)}</span>
              </div>
              <p className="mb-4 text-center text-[11px] text-neutral-500">
                {PUBLIC_CATALOGUE_DISCOUNT}% dealer discount on RRP
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white transition hover:border-white/20"
                >
                  Add more guitars
                </button>
                <Link
                  href="/catalogue/run-19#submit-order"
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 rounded-xl bg-accent py-3 text-center text-sm font-bold text-black transition hover:bg-accent-soft"
                >
                  Submit by email
                </Link>
              </div>
              <button
                type="button"
                onClick={clearCart}
                className="mt-3 w-full text-center text-xs text-neutral-500 transition hover:text-red-400"
              >
                Clear order
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
