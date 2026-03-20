import { GuitarSpecs } from "@/lib/types";

interface Props {
  specs: Partial<GuitarSpecs>;
  optionOverrides?: Partial<GuitarSpecs>;
  /** If true, group specs into sections (Body, Neck, Hardware, etc.) for better scanability */
  grouped?: boolean;
}

function formatValue(val: unknown): string {
  if (val == null) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

const SPEC_GROUPS: { title: string; keys: (keyof GuitarSpecs)[] }[] = [
  {
    title: "Body & top",
    keys: ["body", "finish"],
  },
  {
    title: "Neck",
    keys: ["neck", "neckShape", "scale", "scaleLength", "frets"],
  },
  {
    title: "Fingerboard",
    keys: ["fretboard", "fretboardRadius", "fretwire", "inlay", "sideDots"],
  },
  {
    title: "Hardware",
    keys: ["hardwareColour", "bridgeMachineheads", "hardware"],
  },
  {
    title: "Electronics",
    keys: ["pickups", "bridgePickup", "neckPickup", "electronics"],
  },
  {
    title: "Other",
    keys: ["stringCount", "other", "notes"],
  },
];

const SPEC_LABELS: Record<keyof GuitarSpecs, string> = {
  body: "Body",
  neck: "Neck",
  neckShape: "Neck shape",
  fretboard: "Fretboard",
  fretboardRadius: "Fretboard radius",
  fretwire: "Fretwire",
  inlay: "Inlay",
  sideDots: "Side dots",
  hardwareColour: "Hardware colour",
  bridgeMachineheads: "Bridge & machine heads",
  electronics: "Electronics",
  pickups: "Pickups",
  finish: "Finish",
  scale: "Scale",
  other: "Other",
  scaleLength: "Scale length",
  frets: "Frets",
  stringCount: "String count",
  bridgePickup: "Bridge pickup",
  neckPickup: "Neck pickup",
  hardware: "Hardware",
  notes: "Notes",
};

export function SpecTable({ specs, optionOverrides, grouped = true }: Props) {
  const finalSpecs = { ...specs, ...optionOverrides };

  if (grouped) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface/80 p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
          Full specifications
        </h2>
        <div className="space-y-6">
          {SPEC_GROUPS.map((group) => {
            const rows = group.keys
              .map((key) => {
                const value = finalSpecs[key];
                const str = formatValue(value);
                if (str === "") return null;
                return { key, label: SPEC_LABELS[key] ?? key, value: str };
              })
              .filter(Boolean) as { key: string; label: string; value: string }[];
            if (rows.length === 0) return null;
            return (
              <div key={group.title}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">
                  {group.title}
                </h3>
                <dl className="space-y-2.5">
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className="flex flex-col gap-0.5 border-b border-white/5 py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between"
                    >
                      <dt className="text-xs font-medium text-neutral-500">
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
          })}
        </div>
      </div>
    );
  }

  const rows = [
    ...SPEC_GROUPS.flatMap((g) => g.keys),
  ]
    .filter((key, i, arr) => arr.indexOf(key) === i)
    .map((key) => ({
      label: (SPEC_LABELS[key] ?? key).toUpperCase(),
      value: formatValue(finalSpecs[key]),
    }))
    .filter((row) => row.value !== "");

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

