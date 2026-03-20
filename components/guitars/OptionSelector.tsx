"use client";

import { GuitarOption, GuitarOptionValue } from "@/lib/types";
import { useState, useEffect } from "react";

/** Pricing is RRP-based: dealer price = (base RRP + rrpAdjustments) × (1 - discount%). Show RRP adjustment in AUD to match admin. */
const RRP_CURRENCY = "AUD";

interface Props {
  option: GuitarOption;
  value: string | null;
  onChange: (valueId: string) => void;
}

export function OptionSelector({ option, value, onChange }: Props) {
  const [selectedValue, setSelectedValue] = useState<string | null>(value);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const handleChange = (valueId: string) => {
    setSelectedValue(valueId);
    onChange(valueId);
  };

  if (option.type === "number") {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-white">
          {option.label}
          {option.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type="number"
          value={selectedValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          required={option.required}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-accent focus:outline-none"
          placeholder={`Enter ${option.label.toLowerCase()}`}
        />
      </div>
    );
  }

  const hasImages = option.values.some((v) => v.images && v.images.length > 0);
  const isCompactOption = !hasImages; // e.g. strings = compact pills

  if (isCompactOption) {
    return (
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {option.label}
          {option.required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {option.values.map((val) => (
            <button
              key={val.valueId}
              type="button"
              onClick={() => handleChange(val.valueId)}
              className={`rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                selectedValue === val.valueId
                  ? "border-accent bg-accent/20 text-white"
                  : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
              }`}
            >
              {val.label}
              {(() => {
                const rrp = val.rrpAdjustment;
                const legacy = val.priceAdjustment;
                if (rrp != null && rrp !== 0) {
                  return (
                    <span className={`ml-2 ${rrp > 0 ? "text-green-400" : "text-red-400"}`}>
                      {rrp > 0 ? "+" : ""}
                      {new Intl.NumberFormat("en-AU", { style: "currency", currency: RRP_CURRENCY, minimumFractionDigits: 0 }).format(rrp)}
                    </span>
                  );
                }
                if (legacy != null && legacy !== 0) {
                  return (
                    <span className={`ml-2 ${legacy > 0 ? "text-green-400" : "text-red-400"}`}>
                      {legacy > 0 ? "+" : ""}
                      {new Intl.NumberFormat("en-AU", { style: "currency", currency: RRP_CURRENCY, minimumFractionDigits: 0 }).format(legacy)}
                    </span>
                  );
                }
                return null;
              })()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {option.label}
        {option.required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {option.values.map((val) => (
          <button
            key={val.valueId}
            type="button"
            onClick={() => handleChange(val.valueId)}
            className={`group relative flex flex-col overflow-hidden rounded-xl border-2 p-2 text-left transition-all ${
              selectedValue === val.valueId
                ? "border-accent bg-accent/20 ring-2 ring-accent/30"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            {val.images && val.images.length > 0 && (
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-neutral-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={val.images[0]}
                  alt={val.label}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
            )}
            <p className="mt-1.5 truncate text-xs font-medium text-white">
              {val.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

