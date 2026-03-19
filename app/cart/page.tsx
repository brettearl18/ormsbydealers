"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart, CartItem } from "@/lib/cart-context";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { CartItemSkeleton } from "@/components/LoadingSkeleton";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PricesDoc, TierDoc, GuitarDoc, AccountDoc } from "@/lib/types";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, updateQty, removeItem, subtotal } = useCart();
  const [account, setAccount] = useState<(AccountDoc & { id: string }) | null>(null);
  const [pricesMap, setPricesMap] = useState<Map<string, PricesDoc>>(new Map());
  const [guitarsMap, setGuitarsMap] = useState<Map<string, GuitarDoc>>(new Map());
  const [loadingPrices, setLoadingPrices] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch account (for discount %), prices, and guitars for all cart items
  useEffect(() => {
    if (!user?.accountId || items.length === 0) {
      setLoadingPrices(false);
      return;
    }

    async function fetchPricingData() {
      setLoadingPrices(true);
      try {
        const uniqueGuitarIds = Array.from(new Set(items.map((item) => item.guitarId)));
        const accountSnap = await getDoc(doc(db, "accounts", user.accountId!));
        if (accountSnap.exists()) {
          setAccount({ id: accountSnap.id, ...accountSnap.data() } as AccountDoc & { id: string });
        } else {
          setAccount(null);
        }

        const prices = new Map<string, PricesDoc>();
        const guitars = new Map<string, GuitarDoc>();
        for (const guitarId of uniqueGuitarIds) {
          const [priceSnap, guitarSnap] = await Promise.all([
            getDoc(doc(db, "prices", guitarId)),
            getDoc(doc(db, "guitars", guitarId)),
          ]);
          if (priceSnap.exists()) prices.set(guitarId, priceSnap.data() as PricesDoc);
          if (guitarSnap.exists()) guitars.set(guitarId, guitarSnap.data() as GuitarDoc);
        }
        setPricesMap(prices);
        setGuitarsMap(guitars);
      } catch (err) {
        console.error("Error fetching pricing data:", err);
      } finally {
        setLoadingPrices(false);
      }
    }

    fetchPricingData();
  }, [items, user?.accountId]);

  // Dealer price = RRP × (1 - account.discountPercent/100)
  const itemsWithCurrentPrices = useMemo(() => {
    if (!user?.accountId || loadingPrices) {
      return items;
    }

    const discountPercent = account?.discountPercent ?? 0;

    return items.map((item) => {
      const prices = pricesMap.get(item.guitarId);
      const guitar = guitarsMap.get(item.guitarId);
      const rrp = getRRPForVariant(prices, guitar?.options ?? null, item.selectedOptions ?? null);
      if (rrp == null) return item;
      const unitPrice = getDealerPriceFromRRP(rrp, discountPercent);
      return { ...item, unitPrice };
    });
  }, [items, pricesMap, guitarsMap, account?.discountPercent, user?.accountId, loadingPrices]);

  // Recalculate subtotal with current prices
  const currentSubtotal = useMemo(() => {
    return itemsWithCurrentPrices.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0,
    );
  }, [itemsWithCurrentPrices]);

  if (authLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Loading cart…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (items.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-semibold">Your cart is empty</h1>
          <p className="text-sm text-neutral-400">
            Add guitars from the dealer dashboard to get started.
          </p>
        </div>
        <Link
          href="/dealer"
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-black shadow-soft transition hover:bg-accent-soft"
        >
          Browse guitars
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shopping cart</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <Link
          href="/dealer"
          className="text-xs text-neutral-400 hover:text-accent-soft"
        >
          Continue shopping →
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.length === 0 ? (
            <CartItemSkeleton />
          ) : loadingPrices ? (
            <div className="text-center py-8">
              <p className="text-sm text-neutral-400">Loading pricing...</p>
            </div>
          ) : (
            itemsWithCurrentPrices.map((item, index) => (
            <div
              key={`${item.guitarId}-${JSON.stringify(item.selectedOptions || {})}-${index}`}
              className="flex gap-4 rounded-2xl bg-surface/80 p-4 shadow-soft"
            >
              {item.imageUrl && (
                <Link
                  href={`/dealer/guitars/${item.guitarId}`}
                  className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </Link>
              )}

              <div className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Link
                      href={`/dealer/guitars/${item.guitarId}`}
                      className="text-sm font-medium text-white hover:text-accent-soft"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-xs text-neutral-500">{item.sku}</p>
                    {item.selectedOptions &&
                      Object.keys(item.selectedOptions).length > 0 && (
                        <p className="mt-1 text-xs text-accent">
                          Options configured
                        </p>
                      )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.guitarId, item.selectedOptions)}
                    className="flex-shrink-0 text-neutral-500 hover:text-red-400"
                    aria-label="Remove item"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor={`qty-${item.guitarId}`}
                      className="text-xs text-neutral-500"
                    >
                      Qty:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(item.guitarId, item.qty - 1, item.selectedOptions)}
                        disabled={item.qty <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded border border-neutral-800 text-neutral-400 transition hover:border-accent hover:text-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Decrease quantity"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 12H4"
                          />
                        </svg>
                      </button>
                      <input
                        id={`qty-${item.guitarId}`}
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) {
                            updateQty(item.guitarId, val, item.selectedOptions);
                          }
                        }}
                        className="w-16 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-center text-sm text-white transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(item.guitarId, item.qty + 1, item.selectedOptions)}
                        className="flex h-8 w-8 items-center justify-center rounded border border-neutral-800 text-neutral-400 transition hover:border-accent hover:text-accent-soft"
                        aria-label="Increase quantity"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {user.currency === "USD" ? "$" : user.currency}{" "}
                      {(item.unitPrice * item.qty).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {user.currency === "USD" ? "$" : ""}
                      {item.unitPrice.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      each
                    </p>
                  </div>
                </div>
              </div>
            </div>
            ))
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl bg-surface/80 p-6 shadow-soft">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Order summary
            </h2>

            <div className="space-y-3 border-b border-neutral-800 pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="font-medium text-white">
                  {user.currency === "USD" ? "$" : user.currency}{" "}
                  {currentSubtotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-base font-semibold">
                <span className="text-white">Total</span>
                <span className="text-white">
                  {user.currency === "USD" ? "$" : user.currency}{" "}
                  {currentSubtotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <Link
                href="/checkout"
                className="block w-full rounded-full bg-accent px-6 py-3 text-center text-sm font-semibold text-black shadow-soft transition-all hover:scale-[1.02] hover:bg-accent-soft hover:shadow-soft hover:shadow-accent/30"
              >
                Proceed to checkout
              </Link>

              <p className="text-xs text-neutral-500">
                Shipping and taxes calculated at checkout
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

