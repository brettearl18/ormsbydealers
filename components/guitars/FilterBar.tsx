import { FormEvent } from "react";

export interface GuitarFilters {
  search: string;
  series: string;
}

interface Props {
  value: GuitarFilters;
  onChange: (value: GuitarFilters) => void;
}

export function FilterBar({ value, onChange }: Props) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="glass-strong flex flex-wrap items-end gap-4 rounded-3xl p-6 shadow-xl"
    >
      <div className="flex-1 min-w-[240px]">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">
          Search
        </label>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Search by model or SKU"
              className="glass w-full rounded-2xl border border-white/10 bg-black/30 pl-10 pr-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-all duration-300 focus:border-accent/50 focus:ring-2 focus:ring-accent/30 focus:shadow-lg"
          />
        </div>
      </div>
      <div className="min-w-[160px]">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">
          Series
        </label>
        <select
          value={value.series}
          onChange={(e) => onChange({ ...value, series: e.target.value })}
              className="glass w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-all duration-300 focus:border-accent/50 focus:ring-2 focus:ring-accent/30 focus:shadow-lg"
        >
          <option value="">All series</option>
          {/* In a fuller version, populate from Firestore */}
          <option value="HYPE">Hype</option>
          <option value="TX">TX</option>
          <option value="METAL-X">Metal X</option>
        </select>
      </div>
      {value.search && (
        <button
          type="button"
          onClick={() => onChange({ ...value, search: "" })}
            className="mb-0.5 rounded-2xl border border-white/10 glass px-4 py-2.5 text-xs font-semibold text-neutral-400 transition-all duration-300 hover:border-accent/30 hover:text-white hover:scale-105"
        >
          Clear
        </button>
      )}
    </form>
  );
}


