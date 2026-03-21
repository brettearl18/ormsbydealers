import type { GuitarDoc } from "@/lib/types";

export function formatOptionIdFallback(optionId: string): string {
  return optionId
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-readable labels for stored option ids (uses guitar schema when available). */
export function resolveLineOptionLabels(
  guitar: GuitarDoc | undefined,
  optionId: string,
  valueId: string,
): { optionLabel: string; valueLabel: string } {
  const opt = guitar?.options?.find((o) => o.optionId === optionId);
  const optionLabel = opt?.label ?? formatOptionIdFallback(optionId);
  const val = opt?.values.find((v) => v.valueId === valueId);
  const valueLabel =
    val?.label ??
    valueId
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return { optionLabel, valueLabel };
}
