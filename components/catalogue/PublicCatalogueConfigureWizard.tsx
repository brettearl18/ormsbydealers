"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { OptionSelector } from "@/components/guitars/OptionSelector";
import { getRRPForVariant, getDealerPriceFromRRP } from "@/lib/pricing";
import {
  PUBLIC_CATALOGUE_DISCOUNT,
  type PublicCatalogueCartItem,
  type PublicCatalogueGuitar,
  buildOptionSummary,
  buildVariantSku,
  cartItemKey,
  readPublicCatalogueCart,
} from "@/lib/public-catalogue";
import { writePublicCatalogueCartAndNotify } from "@/components/catalogue/PublicCatalogueOrderBar";
import type { GuitarOption, PricesDoc } from "@/lib/types";

const STEPS = [
  { id: 1, title: "Colour", key: "colour" as const },
  { id: 2, title: "Strings", key: "strings" as const },
  { id: 3, title: "Amount", key: "amount" as const },
];

function findOption(
  options: GuitarOption[] | undefined,
  kind: "colour" | "strings",
): GuitarOption | undefined {
  if (!options?.length) return undefined;
  const byId = options.find((o) => o.optionId.toLowerCase() === kind);
  if (byId) return byId;
  const byLabel = options.find((o) =>
    o.label.toLowerCase().includes(kind === "colour" ? "colour" : "string"),
  );
  return byLabel;
}

interface Props {
  guitar: PublicCatalogueGuitar;
  pricesDoc: PricesDoc | null;
  displayImages: string[];
  /** Updates hero image when colour / options change during the wizard. */
  onOptionsChange?: (options: Record<string, string>) => void;
}

export function PublicCatalogueConfigureWizard({
  guitar,
  pricesDoc,
  displayImages,
  onOptionsChange,
}: Props) {
  const [step, setStep] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [showAddedModal, setShowAddedModal] = useState(false);
  const [lastAddedSummary, setLastAddedSummary] = useState("");

  const colourOption = findOption(guitar.options, "colour");
  const stringsOption = findOption(guitar.options, "strings");

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
      PUBLIC_CATALOGUE_DISCOUNT,
    );
    if (variantRrp == null) return { dealerPrice: null, lineTotal: null };
    const dealerPrice = getDealerPriceFromRRP(variantRrp, PUBLIC_CATALOGUE_DISCOUNT);
    return { dealerPrice, lineTotal: dealerPrice * quantity };
  }, [guitar, pricesDoc, selectedOptions, quantity]);

  function resetWizard() {
    setSelectedOptions({});
    setQuantity(1);
    setStep(1);
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
    setStep((s) => Math.max(1, s - 1));
  }

  function addToOrder() {
    if (!guitar || dealerPrice == null) return;
    if (colourOption && !colourSelected) return;
    if (stringsOption && !stringsSelected) return;

    const summary = buildOptionSummary(guitar.options, selectedOptions);
    const item: PublicCatalogueCartItem = {
      guitarId: guitar.id,
      sku: buildVariantSku(guitar.sku, guitar.options, selectedOptions),
      name: guitar.name,
      imageUrl: displayImages[0] ?? guitar.images?.[0] ?? null,
      qty: quantity,
      unitPrice: dealerPrice,
      selectedOptions: { ...selectedOptions },
      optionSummary: summary,
    };

    const key = cartItemKey(item);
    const existing = readPublicCatalogueCart();
    const idx = existing.findIndex((e) => cartItemKey(e) === key);
    if (idx >= 0) {
      existing[idx] = {
        ...existing[idx],
        qty: Math.min(99, existing[idx].qty + quantity),
      };
    } else {
      existing.push(item);
    }
    writePublicCatalogueCartAndNotify(existing);

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
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = s.id < step;
            const active = s.id === step;
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
                  {done ? "✓" : s.id}
                </div>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    active ? "text-white" : "text-neutral-500"
                  }`}
                >
                  {s.title}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-px flex-1 ${done ? "bg-emerald-500/40" : "bg-white/10"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {step === 1 && (
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
            <h3 className="text-lg font-semibold text-white">Step 2 — Choose strings</h3>
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
            <h3 className="text-lg font-semibold text-white">Step 3 — Amount</h3>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-300">
              <p className="font-medium text-white">{guitar.name}</p>
              {buildOptionSummary(guitar.options, selectedOptions) && (
                <p className="mt-1 text-neutral-400">
                  {buildOptionSummary(guitar.options, selectedOptions)}
                </p>
              )}
              {dealerPrice != null && (
                <p className="mt-2 text-accent">
                  {formatAud(dealerPrice)} each · {PUBLIC_CATALOGUE_DISCOUNT}% off RRP
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
