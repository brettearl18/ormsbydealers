"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";
import { AvailabilityBadge } from "@/components/guitars/AvailabilityBadge";
import { PriceTag } from "@/components/guitars/PriceTag";
import { SpecTable } from "@/components/guitars/SpecTable";
import { ImageCarousel } from "@/components/guitars/ImageCarousel";
import { PublicCatalogueConfigureWizard } from "@/components/catalogue/PublicCatalogueConfigureWizard";
import { useCatalogueAudience } from "@/lib/public-catalogue-context";
import {
  PUBLIC_CATALOGUE_RUN,
  findCatalogueOption,
  type PublicCatalogueGuitar,
} from "@/lib/public-catalogue";
import type { PricesDoc } from "@/lib/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function PublicCatalogueGuitarPage({
  params,
}: {
  params: Promise<{ guitarId: string }>;
}) {
  const { guitarId } = use(params);
  const searchParams = useSearchParams();
  const presetColour = searchParams.get("colour")?.trim() || undefined;
  const { audience, discountPercent, basePath } = useCatalogueAudience();
  const [guitar, setGuitar] = useState<PublicCatalogueGuitar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOptions, setPreviewOptions] = useState<Record<string, string>>({});

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
        const match = (data.guitars ?? []).find((g) => g.id === guitarId);
        if (!cancelled) {
          if (!match) {
            setError("Guitar not found in the Run 19 catalogue.");
            setGuitar(null);
          } else {
            setGuitar(match);
          }
        }
      } catch {
        if (!cancelled) setError("Unable to load guitar details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guitarId, audience]);

  const displayImages = useMemo(() => {
    if (!guitar) return [];
    if (guitar.options?.length && Object.keys(previewOptions).length > 0) {
      for (const option of guitar.options) {
        const valueId = previewOptions[option.optionId];
        if (!valueId) continue;
        const val = option.values.find((v) => v.valueId === valueId);
        if (val?.images?.length) return val.images;
      }
    }
    return guitar.images?.length ? guitar.images : [];
  }, [guitar, previewOptions]);

  const pricesDoc = useMemo((): PricesDoc | null => {
    if (!guitar?.pricing.rrp) return null;
    return {
      guitarId: guitar.id,
      currency: "AUD",
      basePrice: guitar.pricing.dealerPrice ?? 0,
      rrp: guitar.pricing.rrp,
    };
  }, [guitar]);

  const colourOption = guitar ? findCatalogueOption(guitar.options, "colour") : undefined;
  const presetColourLabel =
    presetColour && colourOption
      ? colourOption.values.find((v) => v.valueId === presetColour)?.label
      : undefined;

  useEffect(() => {
    if (!guitar || !presetColour || !colourOption) return;
    if (colourOption.values.some((v) => v.valueId === presetColour)) {
      setPreviewOptions({ [colourOption.optionId]: presetColour });
    }
  }, [guitar, presetColour, colourOption]);

  const displayTitle =
    presetColourLabel && guitar
      ? `${guitar.name.replace(/\s*\(Run \d+\)\s*/i, "").trim()} — ${presetColourLabel}`
      : guitar?.name;

  const baseDealerPrice = useMemo(() => {
    if (!guitar || !pricesDoc) return null;
    const variantRrp = getRRPForVariant(
      pricesDoc,
      guitar.options,
      null,
      discountPercent,
    );
    if (variantRrp == null) return null;
    return getDealerPriceFromRRP(variantRrp, discountPercent);
  }, [guitar, pricesDoc, discountPercent]);

  if (loading) {
    return (
      <main className="px-4 py-12 sm:px-6">
        <p className="text-sm text-neutral-400">Loading…</p>
      </main>
    );
  }

  if (error || !guitar) {
    return (
      <main className="px-4 py-12 sm:px-6">
        <p className="text-sm text-red-300">{error ?? "Not found"}</p>
        <Link
          href={basePath}
          className="mt-4 inline-flex items-center gap-2 text-sm text-accent"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to catalogue
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to {PUBLIC_CATALOGUE_RUN} catalogue
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <ImageCarousel images={displayImages} name={guitar.name} />
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                {guitar.run}
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-white">{displayTitle}</h1>
              <p className="mt-1 font-mono text-sm text-neutral-500">
                {presetColour && colourOption
                  ? `${guitar.sku}${colourOption.values.find((v) => v.valueId === presetColour)?.skuSuffix ?? ""}`
                  : guitar.sku}
              </p>
              {guitar.etaDelivery && (
                <p className="mt-2 text-sm text-neutral-400">{guitar.etaDelivery}</p>
              )}
            </div>

            <AvailabilityBadge
              state={guitar.availability.state}
              etaDate={guitar.availability.etaDate}
              batchName={guitar.availability.batchName}
            />

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              {guitar.pricing.rrp != null && guitar.pricing.rrp > 0 && (
                <p className="text-sm text-neutral-500 line-through">
                  {new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: "AUD",
                  }).format(guitar.pricing.rrp)}{" "}
                  RRP from
                </p>
              )}
              <div className="flex items-baseline gap-3">
                <PriceTag price={baseDealerPrice} currency="AUD" />
                <span className="text-sm font-medium text-accent">
                  {discountPercent}% off
                </span>
              </div>
            </div>

            <PublicCatalogueConfigureWizard
              guitar={guitar}
              pricesDoc={pricesDoc}
              displayImages={displayImages}
              presetColourValueId={
                presetColourLabel ? presetColour : undefined
              }
              onOptionsChange={setPreviewOptions}
            />

            <Link
              href={`${basePath}#your-order`}
              className="block text-center text-sm text-neutral-400 transition hover:text-accent"
            >
              Review full order →
            </Link>
          </div>
        </div>

        {guitar.specs && Object.keys(guitar.specs).length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Specifications</h2>
            <SpecTable specs={guitar.specs} />
          </div>
        )}
      </div>
    </main>
  );
}
