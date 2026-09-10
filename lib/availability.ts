import type { AvailabilityState } from "@/lib/types";

/** Dealers can order only when availability is not CLOSED. */
export function isAvailabilityOrderable(state: AvailabilityState | string | null | undefined): boolean {
  return state !== "CLOSED";
}
