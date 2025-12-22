"use client";

import { useState } from "react";
import { GuitarOption, GuitarOptionValue } from "@/lib/types";
import { ImageUpload } from "./ImageUpload";
import { PlusIcon, TrashIcon, PencilIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface Props {
  options: GuitarOption[];
  onChange: (options: GuitarOption[]) => void;
}

export function GuitarOptionsManager({ options, onChange }: Props) {
  const [expandedOption, setExpandedOption] = useState<string | null>(null);

  function handleAddOption() {
    const newOption: GuitarOption = {
      optionId: `opt_${Date.now()}`,
      label: "",
      type: "select",
      required: true,
      values: [],
    };
    onChange([...options, newOption]);
    setExpandedOption(newOption.optionId);
  }

  function handleUpdateOption(index: number, updates: Partial<GuitarOption>) {
    const updated = [...options];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }

  function handleDeleteOption(index: number) {
    if (confirm("Delete this option? All values will be removed.")) {
      onChange(options.filter((_, i) => i !== index));
      if (expandedOption === options[index].optionId) {
        setExpandedOption(null);
      }
    }
  }

  function handleAddValue(optionIndex: number) {
    const option = options[optionIndex];
    const newValue: GuitarOptionValue = {
      valueId: `val_${Date.now()}`,
      label: "",
    };
    const updated = [...options];
    updated[optionIndex] = {
      ...option,
      values: [...option.values, newValue],
    };
    onChange(updated);
  }

  function handleUpdateValue(
    optionIndex: number,
    valueIndex: number,
    updates: Partial<GuitarOptionValue>
  ) {
    const updated = [...options];
    updated[optionIndex].values[valueIndex] = {
      ...updated[optionIndex].values[valueIndex],
      ...updates,
    };
    onChange(updated);
  }

  function handleDeleteValue(optionIndex: number, valueIndex: number) {
    const updated = [...options];
    updated[optionIndex].values = updated[optionIndex].values.filter(
      (_, i) => i !== valueIndex
    );
    onChange(updated);
  }

  function toggleExpand(optionId: string) {
    setExpandedOption(expandedOption === optionId ? null : optionId);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Product Options</h3>
          <p className="mt-1 text-sm text-neutral-400">
            Define options dealers can choose (colors, frets, strings, bridge, etc.)
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddOption}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
        >
          <PlusIcon className="h-4 w-4" />
          Add Option
        </button>
      </div>

      {options.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-neutral-400">No options defined</p>
          <p className="mt-1 text-xs text-neutral-500">
            Add options like Color, Fret Count, String Count, Bridge Type, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option, optionIndex) => (
            <div
              key={option.optionId}
              className="rounded-lg border border-white/10 bg-white/5 overflow-hidden"
            >
              {/* Option Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex-1 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(option.optionId)}
                    className="text-neutral-400 hover:text-white transition"
                  >
                    {expandedOption === option.optionId ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </button>
                  <div className="flex-1">
                    {expandedOption === option.optionId ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-300">
                            Option Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={option.label}
                            onChange={(e) =>
                              handleUpdateOption(optionIndex, { label: e.target.value })
                            }
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50"
                            placeholder="Color"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-300">
                            Type
                          </label>
                          <select
                            value={option.type}
                            onChange={(e) =>
                              handleUpdateOption(optionIndex, {
                                type: e.target.value as "select" | "number",
                              })
                            }
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-accent/50"
                          >
                            <option value="select">Select (Dropdown)</option>
                            <option value="number">Number Input</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={option.required}
                              onChange={(e) =>
                                handleUpdateOption(optionIndex, { required: e.target.checked })
                              }
                              className="rounded border-white/10 bg-black/30 text-accent focus:ring-accent"
                            />
                            <span className="text-xs text-neutral-300">Required</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-white">{option.label || "Unnamed Option"}</p>
                        <p className="text-xs text-neutral-400">
                          {option.values.length} value{option.values.length !== 1 ? "s" : ""} •{" "}
                          {option.type} • {option.required ? "Required" : "Optional"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteOption(optionIndex)}
                  className="ml-4 rounded-lg border border-red-500/20 p-2 text-red-400 transition hover:border-red-500/40 hover:bg-red-500/10"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Option Values */}
              {expandedOption === option.optionId && (
                <div className="border-t border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-neutral-300">Values</p>
                    <button
                      type="button"
                      onClick={() => handleAddValue(optionIndex)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/10"
                    >
                      <PlusIcon className="h-3 w-3" />
                      Add Value
                    </button>
                  </div>

                  {option.values.length === 0 ? (
                    <p className="text-xs text-neutral-500 text-center py-4">
                      No values added. Add at least one value for dealers to choose from.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {option.values.map((value, valueIndex) => (
                        <div
                          key={value.valueId}
                          className="rounded-lg border border-white/5 bg-black/30 p-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-neutral-400">
                                Label *
                              </label>
                              <input
                                type="text"
                                required
                                value={value.label}
                                onChange={(e) =>
                                  handleUpdateValue(optionIndex, valueIndex, {
                                    label: e.target.value,
                                  })
                                }
                                className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none transition focus:border-accent/50"
                                placeholder="Satin Black"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-neutral-400">
                                SKU Suffix
                              </label>
                              <input
                                type="text"
                                value={value.skuSuffix || ""}
                                onChange={(e) =>
                                  handleUpdateValue(optionIndex, valueIndex, {
                                    skuSuffix: e.target.value,
                                  })
                                }
                                className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none transition focus:border-accent/50"
                                placeholder="-BLK"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-neutral-400">
                                Price Adjustment ($)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={value.priceAdjustment || ""}
                                onChange={(e) =>
                                  handleUpdateValue(optionIndex, valueIndex, {
                                    priceAdjustment: e.target.value
                                      ? parseFloat(e.target.value)
                                      : undefined,
                                  })
                                }
                                className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none transition focus:border-accent/50"
                                placeholder="0.00"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => handleDeleteValue(optionIndex, valueIndex)}
                                className="w-full rounded border border-red-500/20 px-2 py-1.5 text-xs text-red-400 transition hover:border-red-500/40 hover:bg-red-500/10"
                              >
                                <TrashIcon className="h-3 w-3 mx-auto" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-2">
                            <label className="mb-2 block text-xs font-medium text-neutral-400">
                              Images (optional)
                            </label>
                            <ImageUpload
                              value={value.images || []}
                              onChange={(images) =>
                                handleUpdateValue(optionIndex, valueIndex, { images })
                              }
                              folder={`guitars/options/${option.label.toLowerCase().replace(/\s+/g, "_")}`}
                              multiple={true}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

