"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { OptionSelector } from "@/components/guitars/OptionSelector";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";
import { useCatalogueAudience } from "@/lib/public-catalogue-context";
import {
  type PublicCatalogueGuitar,
  addToPublicCatalogueCart,
  buildOptionSummary,
  buildVariantSku,
  findCatalogueOption,
} from "@/lib/public-catalogue";
import type { PricesDoc } from "@/lib/types";

const STEPS = [
  { id: 1, title: "Colour", key: "colour" as const },
  { id: 2, title: "Strings", key: "strings" as const },
  { id: 3, title: "Amount", key: "amount" as const },
];

interface Props {
  guitar: PublicCatalogueGuitar;
  pricesDoc: PricesDoc | null;
  displayImages: string[];
  /** Pre-selected from catalogue grid (?colour=valueId). Skips colour step. */
  presetColourValueId?: string;
  /** Updates hero image when colour / options change during the wizard. */
  onOptionsChange?: (options: Record<string, string>) => void;
}

export function PublicCatalogueConfigureWizard({
  guitar,
  pricesDoc,
  displayImages,
  presetColourValueId,
  onOptionsChange,
}: Props) {
  const { audience, discountPercent } = useCatalogueAudience();
  const colourOption = findCatalogueOption(guitar.options, "colour");
  const stringsOption = findCatalogueOption(guitar.options, "strings");
  const colourLocked = Boolean(
    presetColourValueId &&
      colourOption?.values.some((v) => v.valueId === presetColourValueId),
  );

  const [step, setStep] = useState(colourLocked ? 2 : 1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (colourLocked && colourOption && presetColourValueId) {
      return { [colourOption.optionId]: presetColourValueId };
    }
    return {};
  });
  const [quantity, setQuantity] = useState(1);
  const [showAddedModal, setShowAddedModal] = useState(false);
  const [lastAddedSummary, setLastAddedSummary] = useState("");

  const presetColourLabel = colourLocked
    ? colourOption?.values.find((v) => v.valueId === presetColourValueId)?.label
    : undefined;

  const visibleSteps = colourLocked
    ? STEPS.filter((s) => s.id !== 1)
    : STEPS;

  const colourSelected = colourOption
    ? Boolean(selectedOptions[colourOption.optionId])
    : true;
  const stringsSelected = stringsOption
    ? Boolean(selectedOptions[stringsOption.optionId])
    : true;

  const { dealerPrice, lineTotal } = useMemo(() => {
    if (!guitar || !pricesDoc) {
      return { dealerPrice: null as number | null, lineTotal: null as number | null };
    }
    const variantRrp = getRRPForVariant(
      pricesDoc,
      guitar.options,
      selectedOptions,
      discountPercent,
    );
    if (variantRrp == null) return { dealerPrice: null, lineTotal: null };
    const dealerPrice = getDealerPriceFromRRP(variantRrp, discountPercent);
    return { dealerPrice, lineTotal: dealerPrice * quantity };
  }, [guitar, pricesDoc, selectedOptions, quantity, discountPercent]);

  function resetWizard() {
    if (colourLocked && colourOption && presetColourValueId) {
      const locked = { [colourOption.optionId]: presetColourValueId };
      setSelectedOptions(locked);
      onOptionsChange?.(locked);
      setStep(2);
    } else {
      setSelectedOptions({});
      onOptionsChange?.({});
      setStep(1);
    }
    setQuantity(1);
  }

  function setOption(optionId: string, valueId: string) {
    setSelectedOptions((prev) => {
      const next = { ...prev, [optionId]: valueId };
      onOptionsChange?.(next);
      return next;
    });
  }

  useEffect(() => {
    if (Object.keys(selectedOptions).length === 0) {
      onOptionsChange?.({});
    }
  }, [selectedOptions, onOptionsChange]);

  function goNext() {
    if (step === 1 && colourOption && !colourSelected) return;
    if (step === 2 && stringsOption && !stringsSelected) return;
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    const minStep = colourLocked ? 2 : 1;
    setStep((s) => Math.max(minStep, s - 1));
  }

  function addToOrder() {
    if (!guitar || dealerPrice == null) return;
    if (colourOption && !colourSelected) return;
    if (stringsOption && !stringsSelected) return;

    const summary = buildOptionSummary(guitar.options, selectedOptions);
    addToPublicCatalogueCart(audience, {
      guitarId: guitar.id,
      sku: buildVariantSku(guitar.sku, guitar.options, selectedOptions),
      name: guitar.name,
      imageUrl: displayImages[0] ?? guitar.images?.[0] ?? null,
      qty: quantity,
      unitPrice: dealerPrice,
      selectedOptions: { ...selectedOptions },
      optionSummary: summary,
    });

    setLastAddedSummary(
      `${quantity}× ${guitar.name}${summary ? ` — ${summary}` : ""}`,
    );
    setShowAddedModal(true);
    resetWizard();
  }

  useEffect(() => {
    if (!showAddedModal) return;
    const t = setTimeout(() => setShowAddedModal(false), 3500);
    return () => clearTimeout(t);
  }, [showAddedModal]);

  const formatAud = (n: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Build your order
        </p>

        {/* Step indicator */}
        {colourLocked && presetColourLabel && (
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
            <span className="text-neutral-400">Colour: </span>
            <span className="font-semibold text-white">{presetColourLabel}</span>
          </div>
        )}

        <div className="mb-6 flex items-center gap-2">
          {visibleSteps.map((s, i) => {
            const done = s.id < step;
            const active = s.id === step;
            const stepNum = colourLocked ? i + 1 : s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    active
                      ? "bg-accent text-black"
                      : done
                        ? "bg-emerald-500/30 text-emerald-300"
                        : "bg-white/10 text-neutral-500"
                  }`}
                >
                  {done ? "✓" : stepNum}
                </div>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    active ? "text-white" : "text-neutral-500"
                  }`}
                >
                  {s.title}
                </span>
                {i < visibleSteps.length - 1 && (
                  <div
                    className={`mx-1 h-px flex-1 ${done ? "bg-emerald-500/40" : "bg-white/10"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {step === 1 && !colourLocked && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Step 1 — Choose colour</h3>
            {colourOption ? (
              <OptionSelector
                option={colourOption}
                value={selectedOptions[colourOption.optionId] ?? null}
                onChange={(valueId) => setOption(colourOption.optionId, valueId)}
              />
            ) : (
              <p className="text-sm text-neutral-400">No colour options for this model.</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {colourLocked ? "Step 1" : "Step 2"} — Choose strings
            </h3>
            {stringsOption ? (
              <OptionSelector
                option={stringsOption}
                value={selectedOptions[stringsOption.optionId] ?? null}
                onChange={(valueId) => setOption(stringsOption.optionId, valueId)}
              />
            ) : (
              <p className="text-sm text-neutral-400">No string options for this model.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-white">
              {colourLocked ? "Step 2" : "Step 3"} — Amount
            </h3>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-300">
              <p className="font-medium text-white">{guitar.name}</p>
              {buildOptionSummary(guitar.options, selectedOptions) && (
                <p className="mt-1 text-neutral-400">
                  {buildOptionSummary(guitar.options, selectedOptions)}
                </p>
              )}
              {dealerPrice != null && (
                <p className="mt-2 text-accent">
                  {formatAud(dealerPrice)} each · {discountPercent}% off RRP
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-xl text-white transition hover:border-accent/40"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-neutral-500">Quantity</p>
                <p className="text-3xl font-bold text-white">{quantity}</p>
              </div>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-xl text-white transition hover:border-accent/40"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {lineTotal != null && (
              <p className="text-center text-sm text-neutral-400">
                Line total:{" "}
                <span className="font-semibold text-white">{formatAud(lineTotal)}</span>
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={
                (step === 1 && colourOption && !colourSelected) ||
                (step === 2 && stringsOption && !stringsSelected)
              }
              className="ml-auto rounded-xl bg-accent px-6 py-3 text-sm font-bold text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={addToOrder}
              disabled={dealerPrice == null}
              className="ml-auto rounded-xl bg-accent px-6 py-3 text-sm font-bold text-black transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to order
            </button>
          )}
        </div>
      </div>

      <Dialog
        open={showAddedModal}
        onClose={() => setShowAddedModal(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircleIcon className="h-8 w-8 text-emerald-400" />
            </div>
            <DialogTitle className="text-xl font-semibold text-white">
              Added to order
            </DialogTitle>
            <p className="mt-2 text-sm text-neutral-400">{lastAddedSummary}</p>
            <p className="mt-3 text-xs text-neutral-500">
              Configure another guitar, or use the bar below to review and submit.
            </p>
            <button
              type="button"
              onClick={() => setShowAddedModal(false)}
              className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-bold text-black transition hover:bg-accent-soft"
            >
              Add another
            </button>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
