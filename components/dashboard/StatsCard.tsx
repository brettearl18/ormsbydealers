interface Props {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({ label, value, icon, trend }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-2xl glass-strong p-4 transition-all duration-200 hover:border-white/10 sm:p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-accent/0 opacity-0 transition-opacity duration-200 group-hover:opacity-[0.06]" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-white sm:text-3xl">{value}</p>
          {trend && (
            <p
              className={`mt-2 text-xs font-medium ${
                trend.isPositive ? "text-green-400" : "text-red-400"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="shrink-0 rounded-xl bg-accent/15 p-2 text-accent">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

