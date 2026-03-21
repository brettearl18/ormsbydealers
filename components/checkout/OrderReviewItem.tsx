"use client";

import { CartItem } from "@/lib/cart-context";
import { resolveLineOptionLabels } from "@/lib/order-line-options";
import { GuitarDoc } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

interface Props {
  item: CartItem;
  index: number;
}

export function OrderReviewItem({ item, index }: Props) {
  const [guitar, setGuitar] = useState<GuitarDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGuitar() {
      try {
        const guitarDoc = await getDoc(doc(db, "guitars", item.guitarId));
        if (guitarDoc.exists()) {
          setGuitar(guitarDoc.data() as GuitarDoc);
        }
      } catch (err) {
        console.error("Error fetching guitar:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGuitar();
  }, [item.guitarId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex gap-4">
        {/* Image */}
        {item.imageUrl && (
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Details */}
        <div className="flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-white">{item.name}</h3>
            <p className="text-xs text-neutral-400">SKU: {item.sku}</p>
          </div>

          {/* Selected Options */}
          {item.selectedOptions &&
            Object.keys(item.selectedOptions).length > 0 && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Configuration
                </p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3">
                  {Object.entries(item.selectedOptions)
                    .sort(([optionIdA], [optionIdB]) => {
                      const isColorA =
                        optionIdA.toLowerCase().includes("color") ||
                        optionIdA.toLowerCase().includes("colour");
                      const isColorB =
                        optionIdB.toLowerCase().includes("color") ||
                        optionIdB.toLowerCase().includes("colour");
                      if (isColorA && !isColorB) return -1;
                      if (!isColorA && isColorB) return 1;
                      const { optionLabel: nameA } = resolveLineOptionLabels(
                        guitar ?? undefined,
                        optionIdA,
                        item.selectedOptions![optionIdA],
                      );
                      const { optionLabel: nameB } = resolveLineOptionLabels(
                        guitar ?? undefined,
                        optionIdB,
                        item.selectedOptions![optionIdB],
                      );
                      return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
                    })
                    .map(([optionId, valueId]) => {
                      const { optionLabel, valueLabel } = resolveLineOptionLabels(
                        guitar ?? undefined,
                        optionId,
                        valueId,
                      );
                      return (
                        <div key={optionId} className="min-w-0">
                          <dt className="text-sm font-medium text-neutral-300">
                            {optionLabel}
                          </dt>
                          <dd className="mt-1 text-base font-semibold leading-snug text-white">
                            {valueLabel}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
              </div>
            )}

          {/* Quantity and Price */}
          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <span className="text-sm text-neutral-400">
              Quantity: <span className="font-semibold text-white">{item.qty}</span>
            </span>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">
                ${(item.unitPrice * item.qty).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-neutral-500">
                ${item.unitPrice.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                each
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

