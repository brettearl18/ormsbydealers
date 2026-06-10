"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import {
  type PublicCatalogueCartItem,
  cartItemKey,
} from "@/lib/public-catalogue";

interface Props {
  items: PublicCatalogueCartItem[];
  onRemove?: (key: string) => void;
  onUpdateQty?: (key: string, qty: number) => void;
  readOnly?: boolean;
}

export function PublicCatalogueOrderList({
  items,
  onRemove,
  onUpdateQty,
  readOnly = false,
}: Props) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-neutral-500">
        No guitars in your order yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const key = cartItemKey(item);
        return (
          <li
            key={key}
            className="rounded-xl border border-white/10 bg-black/30 p-4"
          >
            <div className="flex items-start gap-3">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-16 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-[10px] text-neutral-600">
                  —
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="font-mono text-[11px] text-neutral-500">{item.sku}</p>
                    {item.optionSummary && (
                      <p className="mt-1 text-xs text-neutral-400">{item.optionSummary}</p>
                    )}
                  </div>
                  {!readOnly && onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(key)}
                      className="shrink-0 text-neutral-500 transition hover:text-red-400"
                      aria-label="Remove"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {readOnly || !onUpdateQty ? (
                    <span className="text-sm text-neutral-400">Qty {item.qty}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(key, item.qty - 1)}
                        className="h-8 w-8 rounded-lg border border-white/10 text-sm text-white"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-white">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(key, item.qty + 1)}
                        className="h-8 w-8 rounded-lg border border-white/10 text-sm text-white"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <p className="text-sm font-semibold text-accent">
                    {new Intl.NumberFormat("en-AU", {
                      style: "currency",
                      currency: "AUD",
                    }).format(item.unitPrice * item.qty)}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
