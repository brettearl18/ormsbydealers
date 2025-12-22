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
    <div className="group relative overflow-hidden rounded-3xl glass-strong p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/0 via-accent/0 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-10" />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-extrabold text-white">{value}</p>
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
          <div className="rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 p-3 text-accent shadow-lg">
            {icon}
          </div>
        )}
      </div>
      
      {/* Decorative corner */}
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/5 blur-xl transition-all duration-300 group-hover:bg-accent/10" />
    </div>
  );
}

