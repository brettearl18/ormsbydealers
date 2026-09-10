"use client";

import { useMemo, useState } from "react";
import {
  PublicCatalogueSpecsModal,
  hasCatalogueSpecs,
} from "@/components/catalogue/PublicCatalogueSpecsModal";
import { AvailabilityBadge } from "@/components/guitars/AvailabilityBadge";
import { getDealerPriceFromRRP, getRRPForVariant } from "@/lib/pricing";
import { useCatalogueAudience } from "@/lib/public-catalogue-context";
import {
  type PublicCatalogueColourVariant,
  addToPublicCatalogueCart,
  buildOptionSummary,
  buildVariantSku,
  findCatalogueOption,
} from "@/lib/public-catalogue";
import { isAvailabilityOrderable } from "@/lib/availability";
import type { PricesDoc } from "@/lib/types";

interface Props {
  variant: PublicCatalogueColourVariant;
}

function formatAud(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function stringPriceHint(
  val: { rrpAdjustment?: number; priceAdjustment?: number },
  discountPercent: number,
): string | null {
  const rrp = val.rrpAdjustment;
  if (rrp != null && rrp !== 0) {
    const dealer = getDealerPriceFromRRP(rrp, discountPercent);
    return `+${formatAud(dealer)}`;
  }
  const legacy = val.priceAdjustment;
  if (legacy != null && legacy !== 0) {
    return `+${formatAud(legacy)}`;
  }
  return null;
}

export function PublicCatalogueQuickOrderCard({ variant }: Props) {
  const { audience, discountPercent } = useCatalogueAudience();
  const stringsOption = findCatalogueOption(variant.options, "strings");
  const [stringsValueId, setStringsValueId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);

  const selectedOptions = useMemo(() => {
    const opts: Record<string, string> = {};
    if (variant.colourOptionId && variant.colourValueId) {
      opts[variant.colourOptionId] = variant.colourValueId;
    }
    if (stringsOption && stringsValueId) {
      opts[stringsOption.optionId] = stringsValueId;
    }
    return opts;
  }, [variant, stringsOption, stringsValueId]);

  const pricesDoc = useMemo((): PricesDoc | null => {
    if (variant.rrp == null) return null;
    return {
      guitarId: variant.guitarId,
      currency: variant.currency,
      basePrice: variant.dealerPrice ?? 0,
      rrp: variant.rrp,
    };
  }, [variant]);

  const { rrp, dealerPrice } = useMemo(() => {
    if (!pricesDoc) return { rrp: variant.rrp, dealerPrice: variant.dealerPrice };
    const rrpVal = getRRPForVariant(
      pricesDoc,
      variant.options,
      selectedOptions,
      discountPercent,
    );
    if (rrpVal == null) return { rrp: null, dealerPrice: null };
    return {
      rrp: rrpVal,
      dealerPrice: getDealerPriceFromRRP(rrpVal, discountPercent),
    };
  }, [pricesDoc, variant, selectedOptions, discountPercent]);

  const showSpecs = hasCatalogueSpecs(variant.specs);

  const canAdd =
    dealerPrice != null &&
    isAvailabilityOrderable(variant.availability.state) &&
    (!stringsOption || Boolean(stringsValueId));

  function handleAdd() {
    if (!canAdd || dealerPrice == null) return;
    if (!isAvailabilityOrderable(variant.availability.state)) return;

    addToPublicCatalogueCart(audience, {
      guitarId: variant.guitarId,
      sku: buildVariantSku(variant.baseSku, variant.options, selectedOptions),
      name: variant.guitarName,
      imageUrl: variant.heroImage,
      qty,
      unitPrice: dealerPrice,
      selectedOptions,
      optionSummary: buildOptionSummary(variant.options, selectedOptions),
    });

    setAdded(true);
    setStringsValueId(null);
    setQty(1);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-xl">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-900">
        {variant.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variant.heroImage}
            alt={variant.displayName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-600">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            {variant.series}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug text-white">
            {variant.displayName}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
            {buildVariantSku(variant.baseSku, variant.options, selectedOptions)}
          </p>
        </div>

        <AvailabilityBadge
          state={variant.availability.state}
          etaDate={variant.availability.etaDate}
          batchName={variant.availability.batchName}
        />

        {showSpecs && (
          <button
            type="button"
            onClick={() => setSpecsOpen(true)}
            className="text-left text-xs font-medium text-accent transition hover:underline"
          >
            View specs
          </button>
        )}

        <div>
          {rrp != null && rrp > 0 && variant.discountPercent > 0 && (
            <p className="text-xs text-neutral-500 line-through">
              {formatAud(rrp)} RRP
            </p>
          )}
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-white">
              {dealerPrice != null ? formatAud(dealerPrice) : "—"}
            </p>
            <span className="text-xs font-medium text-accent">
              {variant.discountPercent}% off
            </span>
          </div>
        </div>

        {stringsOption && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Strings
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stringsOption.values.map((val) => {
                const hint = stringPriceHint(val, discountPercent);
                const selected = stringsValueId === val.valueId;
                return (
                  <button
                    key={val.valueId}
                    type="button"
                    onClick={() => setStringsValueId(val.valueId)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-accent bg-accent/20 text-white"
                        : "border-white/10 bg-black/20 text-neutral-300 hover:border-white/20"
                    }`}
                  >
                    {val.label}
                    {hint && (
                      <span className="ml-1 text-[10px] text-neutral-400">{hint}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Qty
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-8 w-8 rounded-lg border border-white/10 text-sm text-white"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-semibold text-white">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="h-8 w-8 rounded-lg border border-white/10 text-sm text-white"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {added
              ? "Added ✓"
              : !isAvailabilityOrderable(variant.availability.state)
                ? "Closed"
                : "Quick order"}
          </button>
        </div>
      </div>

      {showSpecs && (
        <PublicCatalogueSpecsModal
          open={specsOpen}
          onClose={() => setSpecsOpen(false)}
          title={variant.guitarName}
          specs={variant.specs}
        />
      )}
    </div>
  );
}
