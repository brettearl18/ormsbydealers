import Link from "next/link";
import {
  ShoppingBagIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

export function QuickActionsCard() {
  const actions = [
    {
      label: "Browse Guitars",
      href: "/dealer",
      icon: ShoppingBagIcon,
      primary: true,
    },
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
      label: "Account Settings",
      href: "#",
      icon: Cog6ToothIcon,
      primary: false,
      disabled: true,
    },
  ];

  return (
    <div className="glass-strong rounded-3xl p-6 shadow-xl">
      <h3 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
        Quick Actions
      </h3>
      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const Component = action.disabled ? "div" : Link;
          const props = action.disabled
            ? {}
            : { href: action.href };

          return (
            <Component
              key={action.label}
              {...props}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-5 py-4 text-sm font-semibold transition-all duration-300 ${
                action.primary
                  ? "border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 text-accent hover:border-accent/50 hover:scale-105 hover:shadow-lg hover:shadow-accent/20"
                  : "glass border-white/10 text-white hover:border-accent/30 hover:scale-105 hover:shadow-lg"
              } ${
                action.disabled
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer"
              }`}
            >
              <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
              <span>{action.label}</span>
              {action.primary && !action.disabled && (
                <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              )}
            </Component>
          );
        })}
      </div>
    </div>
  );
}

