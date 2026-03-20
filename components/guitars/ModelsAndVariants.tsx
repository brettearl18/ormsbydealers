"use client";

import { GuitarOption } from "@/lib/types";

interface Props {
  options: GuitarOption[];
  /** Optional: show as compact inline list instead of cards */
  compact?: boolean;
}

/**
 * Shows all available models/variants at a glance (strings, colours, etc.)
 * so dealers can see what configurations exist before selecting.
 */
export function ModelsAndVariants({ options, compact = false }: Props) {
  if (!options || options.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        {options.map((opt) => (
          <span key={opt.optionId} className="flex items-center gap-1.5">
            <span className="font-medium text-neutral-400">{opt.label}:</span>
            <span className="text-white">
              {opt.values.map((v) => v.label).join(", ")}
            </span>
            {opt !== options[options.length - 1] && (
              <span className="text-neutral-600">|</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/80 p-5 sm:p-6">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
        Models & variants
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        Available configurations — select your options below to see price and add to cart.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <div
            key={option.optionId}
            className="rounded-xl border border-white/5 bg-black/20 p-4"
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
              {option.label}
              {option.required && (
                <span className="ml-1 text-red-400" aria-label="Required">*</span>
              )}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {option.values.map((val) => (
                <li
                  key={val.valueId}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white"
                >
                  {val.label}
                  {val.skuSuffix && (
                    <span className="ml-1.5 font-mono text-neutral-500">
                      {val.skuSuffix}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
