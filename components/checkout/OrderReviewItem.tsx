"use client";

import { CartItem } from "@/lib/cart-context";
import { GuitarDoc, GuitarOption } from "@/lib/types";
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

  // Get option labels for selected values
  const getOptionLabel = (optionId: string, valueId: string): string => {
    if (!guitar?.options) return valueId;
    const option = guitar.options.find((opt) => opt.optionId === optionId);
    if (!option) return valueId;
    const value = option.values.find((val) => val.valueId === valueId);
    return value?.label || valueId;
  };

  const getOptionName = (optionId: string): string => {
    if (!guitar?.options) return optionId;
    const option = guitar.options.find((opt) => opt.optionId === optionId);
    return option?.label || optionId;
  };

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
              <div className="space-y-1.5 rounded-lg border border-white/5 bg-black/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Configuration
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(item.selectedOptions)
                    .sort(([optionIdA], [optionIdB]) => {
                      // Prioritize Colour/Color first
                      const isColorA = optionIdA.toLowerCase().includes("color") || optionIdA.toLowerCase().includes("colour");
                      const isColorB = optionIdB.toLowerCase().includes("color") || optionIdB.toLowerCase().includes("colour");
                      if (isColorA && !isColorB) return -1;
                      if (!isColorA && isColorB) return 1;
                      // Then sort alphabetically by option name
                      const nameA = getOptionName(optionIdA).toLowerCase();
                      const nameB = getOptionName(optionIdB).toLowerCase();
                      return nameA.localeCompare(nameB);
                    })
                    .map(([optionId, valueId]) => (
                      <div
                        key={optionId}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="text-neutral-400">
                          {getOptionName(optionId)}:
                        </span>
                        <span className="font-medium text-white">
                          {getOptionLabel(optionId, valueId)}
                        </span>
                      </div>
                    ))}
                </div>
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

