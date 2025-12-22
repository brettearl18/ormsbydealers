import { SessionUser } from "@/lib/auth-context";

interface Props {
  user: SessionUser;
  accountName?: string;
  territory?: string;
}

export function AccountInfoCard({ user, accountName, territory }: Props) {
  return (
    <div className="glass-strong rounded-3xl p-6 shadow-xl">
      <h3 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
        Account Information
      </h3>
      <div className="space-y-4 text-sm">
        {accountName && (
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Company
            </p>
            <p className="font-bold text-white">{accountName}</p>
          </div>
        )}
        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Email
          </p>
          <p className="font-bold text-white">{user.email}</p>
        </div>
        {user.tierId && (
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tier
            </p>
            <p className="font-bold text-accent">{user.tierId}</p>
          </div>
        )}
        {user.currency && (
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Currency
            </p>
            <p className="font-bold text-white">{user.currency}</p>
          </div>
        )}
        {territory && (
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Territory
            </p>
            <p className="font-bold text-white">{territory}</p>
          </div>
        )}
      </div>
    </div>
  );
}

