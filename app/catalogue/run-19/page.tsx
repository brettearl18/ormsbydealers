"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GuitarCard } from "@/components/guitars/GuitarCard";
import { GuitarCardSkeleton } from "@/components/LoadingSkeleton";
import { PublicCatalogueOrderForm } from "@/components/catalogue/PublicCatalogueOrderForm";
import {
  PUBLIC_CATALOGUE_DISCOUNT,
  PUBLIC_CATALOGUE_RUN,
  type PublicCatalogueCartItem,
  type PublicCatalogueContact,
  type PublicCatalogueGuitar,
  cartItemKey,
  emptyPublicCatalogueContact,
  readPublicCatalogueCart,
} from "@/lib/public-catalogue";
import {
  notifyPublicCatalogueCartUpdated,
  PUBLIC_CATALOGUE_CART_EVENT,
  writePublicCatalogueCartAndNotify,
} from "@/components/catalogue/PublicCatalogueOrderBar";
import { PublicCatalogueOrderList } from "@/components/catalogue/PublicCatalogueOrderList";

export default function PublicRun19CataloguePage() {
  const [guitars, setGuitars] = useState<PublicCatalogueGuitar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<PublicCatalogueCartItem[]>([]);
  const [contact, setContact] = useState<PublicCatalogueContact>(
    emptyPublicCatalogueContact(),
  );

  useEffect(() => {
    const sync = () => setCart(readPublicCatalogueCart());
    sync();
    window.addEventListener(PUBLIC_CATALOGUE_CART_EVENT, sync);
    return () => window.removeEventListener(PUBLIC_CATALOGUE_CART_EVENT, sync);
  }, []);

  useEffect(() => {
    if (cart.length > 0 || readPublicCatalogueCart().length > 0) {
      writePublicCatalogueCartAndNotify(cart);
    }
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/catalogue/run-19", { cache: "no-store" });
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
  }, []);

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
    notifyPublicCatalogueCartUpdated();
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Public dealer catalogue
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {PUBLIC_CATALOGUE_RUN} — Dealer order form
          </h1>
          <p className="max-w-2xl text-sm text-neutral-400">
            Browse Run 19 models, configure colour and string count, and submit your
            order by email. Pricing is{" "}
            <span className="font-medium text-white">
              {PUBLIC_CATALOGUE_DISCOUNT}% off RRP
            </span>{" "}
            (AUD). No portal login required — share this link with authorized dealers.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
          <section className="space-y-6">
            {loading && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
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

            {!loading && guitars.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {guitars.map((guitar) => (
                  <GuitarCard
                    key={guitar.id}
                    id={guitar.id}
                    sku={guitar.sku}
                    name={guitar.name}
                    series={guitar.series}
                    heroImage={guitar.images?.[0] ?? null}
                    availability={guitar.availability}
                    price={{
                      value: guitar.pricing.dealerPrice,
                      currency: guitar.pricing.currency,
                      note: "From (base config)",
                    }}
                    rrp={guitar.pricing.rrp}
                    discountPercent={guitar.pricing.discountPercent}
                    detailHref={`/catalogue/run-19/guitars/${guitar.id}`}
                    hideQuickAdd
                    configureLabel="Configure"
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
                  Configure a guitar and add it to your order.
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
                  {PUBLIC_CATALOGUE_DISCOUNT}% dealer discount on RRP
                </p>
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
