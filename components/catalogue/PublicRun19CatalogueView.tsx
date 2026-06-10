"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicCatalogueQuickOrderCard } from "@/components/catalogue/PublicCatalogueQuickOrderCard";
import { GuitarCardSkeleton } from "@/components/LoadingSkeleton";
import { PublicCatalogueFxPanel } from "@/components/catalogue/PublicCatalogueFxPanel";
import { PublicCatalogueOrderForm } from "@/components/catalogue/PublicCatalogueOrderForm";
import { PublicCatalogueOrderList } from "@/components/catalogue/PublicCatalogueOrderList";
import { writePublicCatalogueCartAndNotify } from "@/components/catalogue/PublicCatalogueOrderBar";
import { useCatalogueAudience } from "@/lib/public-catalogue-context";
import {
  PUBLIC_CATALOGUE_RUN,
  PUBLIC_CATALOGUE_CART_EVENT,
  type PublicCatalogueCartItem,
  type PublicCatalogueContact,
  type PublicCatalogueGuitar,
  cartItemKey,
  emptyPublicCatalogueContact,
  expandGuitarsByColour,
  notifyPublicCatalogueCartUpdated,
  readPublicCatalogueCart,
} from "@/lib/public-catalogue";

export function PublicRun19CatalogueView() {
  const { audience, discountPercent, basePath, audienceLabel } = useCatalogueAudience();
  const [guitars, setGuitars] = useState<PublicCatalogueGuitar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<PublicCatalogueCartItem[]>([]);
  const [contact, setContact] = useState<PublicCatalogueContact>(
    emptyPublicCatalogueContact(),
  );

  useEffect(() => {
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<{ audience?: string }>).detail;
      if (detail?.audience && detail.audience !== audience) return;
      setCart(readPublicCatalogueCart(audience));
    };
    setCart(readPublicCatalogueCart(audience));
    window.addEventListener(PUBLIC_CATALOGUE_CART_EVENT, sync);
    return () => window.removeEventListener(PUBLIC_CATALOGUE_CART_EVENT, sync);
  }, [audience]);

  useEffect(() => {
    if (cart.length > 0 || readPublicCatalogueCart(audience).length > 0) {
      writePublicCatalogueCartAndNotify(audience, cart);
    }
  }, [cart, audience]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/catalogue/run-19?audience=${encodeURIComponent(audience)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { guitars: PublicCatalogueGuitar[] };
        if (!cancelled) setGuitars(data.guitars ?? []);
      } catch {
        if (!cancelled) setError("Unable to load the Run 19 catalogue right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const colourVariants = useMemo(
    () => expandGuitarsByColour(guitars, basePath),
    [guitars, basePath],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    [cart],
  );

  function removeCartItem(key: string) {
    setCart((prev) => prev.filter((item) => cartItemKey(item) !== key));
  }

  function updateQty(key: string, qty: number) {
    if (qty < 1) return;
    setCart((prev) =>
      prev.map((item) =>
        cartItemKey(item) === key ? { ...item, qty: Math.min(99, qty) } : item,
      ),
    );
  }

  function clearCart() {
    setCart([]);
    notifyPublicCatalogueCartUpdated(audience);
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Public {audienceLabel.toLowerCase()} catalogue
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {PUBLIC_CATALOGUE_RUN} — {audienceLabel} order form
          </h1>
          <p className="max-w-2xl text-sm text-neutral-400">
            Quick order on each card — pick strings and quantity, then submit your
            order by email. Pricing is{" "}
            <span className="font-medium text-white">{discountPercent}% off RRP</span>{" "}
            (AUD). No portal login required.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
          <section className="space-y-6">
            {loading && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <GuitarCardSkeleton key={i} />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
                {error}
              </div>
            )}

            {!loading && !error && guitars.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-neutral-400">
                No Run 19 guitars are available in the catalogue yet.
              </div>
            )}

            {!loading && colourVariants.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {colourVariants.map((variant) => (
                  <PublicCatalogueQuickOrderCard
                    key={variant.cardKey}
                    variant={variant}
                  />
                ))}
              </div>
            )}
          </section>

          <aside id="your-order" className="scroll-mt-24 space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Your order</h2>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs text-neutral-400 transition hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Quick order a guitar from the grid, or adjust quantities here.
                </p>
              ) : (
                <PublicCatalogueOrderList
                  items={cart}
                  onRemove={removeCartItem}
                  onUpdateQty={updateQty}
                />
              )}

              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Subtotal (AUD)</span>
                  <span className="font-semibold text-white">
                    {new Intl.NumberFormat("en-AU", {
                      style: "currency",
                      currency: "AUD",
                    }).format(subtotal)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {discountPercent}% {audienceLabel.toLowerCase()} discount on RRP
                </p>
                <div className="mt-3">
                  <PublicCatalogueFxPanel amountAud={subtotal} />
                </div>
              </div>
            </div>

            <div
              id="submit-order"
              className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h2 className="mb-4 text-lg font-semibold text-white">
                Submit by email
              </h2>
              <PublicCatalogueOrderForm
                items={cart}
                subtotal={subtotal}
                contact={contact}
                onContactChange={setContact}
                onSuccess={clearCart}
              />
            </div>

            <p className="text-center text-xs text-neutral-500">
              Already have a portal account?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Log in
              </Link>
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
