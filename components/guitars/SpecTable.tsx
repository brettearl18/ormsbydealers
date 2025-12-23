import { GuitarSpecs } from "@/lib/types";

interface Props {
  specs: Partial<GuitarSpecs>;
  optionOverrides?: Partial<GuitarSpecs>;
}

export function SpecTable({ specs, optionOverrides }: Props) {
  // Merge option overrides with base specs
  const finalSpecs = { ...specs, ...optionOverrides };

  const rows = [
    { label: "BODY", value: finalSpecs.body },
    { label: "NECK", value: finalSpecs.neck },
    { label: "NECK SHAPE", value: finalSpecs.neckShape },
    { label: "FRETBOARD", value: finalSpecs.fretboard },
    { label: "FRETBOARD RADIUS", value: finalSpecs.fretboardRadius },
    { label: "FRETWIRE", value: finalSpecs.fretwire },
    { label: "INLAY", value: finalSpecs.inlay },
    { label: "SIDE DOTS", value: finalSpecs.sideDots },
    { label: "HARDWARE COLOUR", value: finalSpecs.hardwareColour },
    { label: "BRIDGE + MACHINEHEADS", value: finalSpecs.bridgeMachineheads },
    { label: "ELECTRONICS", value: finalSpecs.electronics },
    { label: "PICKUPS", value: finalSpecs.pickups },
    { label: "FINISH", value: finalSpecs.finish },
    { label: "SCALE", value: finalSpecs.scale },
    { label: "OTHER", value: finalSpecs.other },
  ].filter(row => row.value != null && row.value !== "");

  return (
    <div className="rounded-2xl bg-surface/80 p-4 sm:p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 sm:text-sm">
        Specifications
      </h2>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1 border-b border-neutral-800 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between"
          >
            <dt className="text-xs font-medium text-neutral-500 sm:text-sm">
              {row.label}
            </dt>
            <dd className="text-sm font-medium text-white sm:text-right">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

