import Link from "next/link";
import {
  ShoppingBagIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";

export function QuickActionsCard({
  hideCartAndCheckout = false,
}: {
  /** Admin dealer preview: cart/checkout are disabled */
  hideCartAndCheckout?: boolean;
}) {
  const actions = [
    {
      label: "Browse Guitars",
      href: "/dealer",
      icon: ShoppingBagIcon,
      primary: true,
    },
    ...(!hideCartAndCheckout
      ? [
          {
            label: "Cart & Checkout",
            href: "/cart",
            icon: ShoppingCartIcon,
            primary: false,
          } as const,
        ]
      : []),
    {
      label: "View Orders",
      href: "/orders",
      icon: DocumentTextIcon,
      primary: false,
    },
    {
      label: "Download Catalog",
      href: "#",
      icon: ArrowDownTrayIcon,
      primary: false,
      disabled: true,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Cog6ToothIcon,
      primary: false,
    },
  ];

  return (
    <div className="glass-strong h-full rounded-2xl p-4 shadow-xl sm:p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
        Quick actions
      </h3>
      <div className="flex flex-col gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const className = `group relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
            action.primary
              ? "border-accent/30 bg-accent/10 text-accent hover:border-accent/50 hover:bg-accent/15"
              : "border-white/10 bg-black/20 text-white hover:border-white/20 hover:bg-white/5"
          } ${action.disabled ? "cursor-not-allowed opacity-40" : ""}`;

          if (action.disabled) {
            return (
              <div key={action.label} className={className}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{action.label}</span>
              </div>
            );
          }

          return (
            <Link key={action.label} href={action.href} className={className}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{action.label}</span>
            </Link>
          );
        })}
      </div>
      <p className="mt-3 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-neutral-500">
        <Link href="/dealer" className="text-accent-soft hover:underline">
          Browse
        </Link>
        {!hideCartAndCheckout && (
          <>
            {" → "}
            <Link href="/cart" className="text-accent-soft hover:underline">
              Cart
            </Link>
            {" → "}
            <Link href="/checkout" className="text-accent-soft hover:underline">
              Place order
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
