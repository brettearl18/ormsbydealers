import Link from "next/link";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { PriceTag } from "./PriceTag";
import { AvailabilityState } from "@/lib/types";
import { useCart } from "@/lib/cart-context";
import { EyeIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";

interface Props {
  id: string;
  sku: string;
  name: string;
  series: string;
  heroImage?: string | null;
  availability: {
    state: AvailabilityState;
    etaDate?: string | null;
    batchName?: string | null;
  };
  price: {
    value: number | null;
    currency: string;
    note?: string | null;
  };
  onQuickView?: () => void;
}

export function GuitarCard({
  id,
  sku,
  name,
  series,
  heroImage,
  availability,
  price,
  onQuickView,
}: Props) {
  const { addItem } = useCart();

  const onAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (price.value == null) return;
    addItem(
      {
        guitarId: id,
        sku,
        name,
        imageUrl: heroImage ?? null,
        unitPrice: price.value,
        priceSource: null,
      },
      1,
    );
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.();
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl glass-strong shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-accent/20">
      <Link href={`/dealer/guitars/${id}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-900">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={name}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">
              Guitar image
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          
          {/* Quick Actions Overlay - Modern glassmorphism */}
          <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 backdrop-blur-md transition-opacity duration-500 group-hover:opacity-100">
            <div className="glass-strong rounded-2xl p-2 shadow-2xl">
              {onQuickView && (
                <button
                  onClick={handleQuickView}
                  className="rounded-xl bg-white/95 p-3.5 text-black shadow-lg transition-all duration-300 hover:scale-110 hover:bg-white hover:shadow-xl"
                  aria-label="Quick view"
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={onAddToCart}
                disabled={price.value == null}
                className="ml-2 rounded-xl bg-gradient-to-r from-accent to-accent-soft p-3.5 text-black shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Add to cart"
              >
                <ShoppingCartIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
            {series}
          </p>
          <Link href={`/dealer/guitars/${id}`}>
            <h3 className="text-base font-semibold text-white transition hover:text-accent-soft">
              {name}
            </h3>
          </Link>
          <p className="text-xs text-neutral-500">SKU: {sku}</p>
        </div>

        <AvailabilityBadge
          state={availability.state}
          etaDate={availability.etaDate}
          batchName={availability.batchName}
        />

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <PriceTag
            price={price.value}
            currency={price.currency}
            note={price.note}
          />
          <Link
            href={`/dealer/guitars/${id}`}
            className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-xs font-bold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-accent/30"
            style={{ backgroundColor: '#F97316', color: '#000000' }}
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}


