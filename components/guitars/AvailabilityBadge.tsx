import { AvailabilityState } from "@/lib/types";

interface Props {
  state: AvailabilityState;
  etaDate?: string | null;
  batchName?: string | null;
}

export function AvailabilityBadge({ state, etaDate, batchName }: Props) {
  const common =
    "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide";

  if (state === "IN_STOCK") {
    return (
      <span className={`${common} bg-emerald-500/10 text-emerald-300`}>
        In stock
      </span>
    );
  }

  if (state === "PREORDER") {
    return (
      <span className={`${common} bg-amber-500/10 text-amber-300`}>
        Preorder{etaDate ? ` · ETA ${new Date(etaDate).toLocaleDateString()}` : ""}
      </span>
    );
  }

  // BATCH
  return (
    <span className={`${common} bg-sky-500/10 text-sky-300`}>
      Batch {batchName ?? ""}{" "}
      {etaDate ? ` · ETA ${new Date(etaDate).toLocaleDateString()}` : ""}
    </span>
  );
}



