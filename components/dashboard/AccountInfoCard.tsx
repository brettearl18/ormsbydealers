import { SessionUser } from "@/lib/auth-context";

interface Props {
  user: SessionUser;
  /** Prefer Firestore account currency (Settings); overrides token claims */
  currency?: string | null;
  accountName?: string;
  territory?: string;
  /** Dealer discount % off RRP (e.g. 30 = 30% off). Shown prominently so dealers see their pricing. */
  discountPercent?: number | null;
}

export function AccountInfoCard({
  user,
  currency,
  accountName,
  territory,
  discountPercent,
}: Props) {
  const displayCurrency = currency?.trim() || user.currency || "—";
  const hasDiscount = discountPercent != null && discountPercent > 0;

  return (
    <div className="glass-strong rounded-2xl p-4 shadow-xl sm:p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
        Account
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {hasDiscount && (
          <div className="col-span-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2.5 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
              Dealer discount
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">{discountPercent}% off RRP</p>
          </div>
        )}
        {accountName && (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Company
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white" title={accountName}>
              {accountName}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Email
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white" title={user.email ?? ""}>
            {user.email}
          </p>
        </div>
        {user.tierId && (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Tier</p>
            <p className="mt-0.5 text-sm font-semibold text-accent">{user.tierId}</p>
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Currency
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">{displayCurrency}</p>
        </div>
        {!hasDiscount && (discountPercent === 0 || discountPercent == null) && (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Pricing
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">Tier / RRP</p>
          </div>
        )}
        {territory && (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Territory
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">{territory}</p>
          </div>
        )}
      </div>
    </div>
  );
}
