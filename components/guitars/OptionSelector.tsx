"use client";

import { GuitarOption, GuitarOptionValue } from "@/lib/types";
import { useState, useEffect } from "react";

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

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-white">
        {option.label}
        {option.required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {option.values.map((val) => (
          <button
            key={val.valueId}
            type="button"
            onClick={() => handleChange(val.valueId)}
            className={`group relative flex flex-col overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${
              selectedValue === val.valueId
                ? "border-accent bg-accent/20 shadow-lg shadow-accent/30 ring-2 ring-accent/20"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            {/* Option Image if available */}
            {val.images && val.images.length > 0 && (
              <div className="mb-3 aspect-square w-full overflow-hidden rounded-lg bg-neutral-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={val.images[0]}
                  alt={val.label}
                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                />
              </div>
            )}
            
            {/* Title and SKU below image */}
            <div className="space-y-1">
              <p className={`text-sm font-medium ${
                selectedValue === val.valueId ? "text-white" : "text-white"
              }`}>
                {val.label}
              </p>
              {val.skuSuffix && (
                <p className="text-[10px] text-neutral-500">
                  SKU: {val.skuSuffix}
                </p>
              )}
              {val.priceAdjustment && val.priceAdjustment !== 0 && (
                <p
                  className={`text-xs font-medium ${
                    val.priceAdjustment > 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {val.priceAdjustment > 0 ? "+" : ""}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(val.priceAdjustment)}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

