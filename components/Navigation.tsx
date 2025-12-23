"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { AdminBrandingSettings, AdminSettingsDoc } from "@/lib/types";

const DEFAULT_BRANDING: AdminBrandingSettings = {
  siteName: "Ormsby",
  logoUrl: "",
  primaryColor: "#ffffff",
  secondaryColor: "#ffffff",
  supportEmail: "",
};

export function Navigation() {
  const { user, loading } = useAuth();
  const { items } = useCart();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
   const [branding, setBranding] = useState<AdminBrandingSettings | null>(null);

  useEffect(() => {
    async function loadBranding() {
      try {
        const ref = doc(db, "adminSettings", "global");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as AdminSettingsDoc;
          setBranding({
            ...DEFAULT_BRANDING,
            ...(data.branding || {}),
          });
        } else {
          setBranding(DEFAULT_BRANDING);
        }
      } catch (err) {
        console.error("Failed to load branding settings:", err);
        setBranding(DEFAULT_BRANDING);
      }
    }

    loadBranding();
  }, []);

  const cartItemCount = items.reduce((sum, item) => sum + item.qty, 0);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut(auth);
      router.push("/");
    } catch (err) {
      console.error(err);
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <nav className="glass-strong flex items-center justify-between border-b border-white/5 px-6 py-5">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.siteName || "Ormsby"}
              className="h-7 w-auto"
            />
          ) : (
            "Ormsby"
          )}
        </Link>
        <div className="h-8 w-24 animate-pulse rounded-2xl bg-neutral-800/50" />
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="glass-strong flex items-center justify-between border-b border-white/5 px-6 py-5">
        <Link
          href="/"
          className="text-xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent transition hover:from-accent hover:to-accent-soft"
        >
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.siteName || "Ormsby"}
              className="h-7 w-auto"
            />
          ) : (
            "Ormsby"
          )}
        </Link>
        <Link
          href="/login"
          className="rounded-2xl border border-white/10 glass px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:border-accent/50 hover:scale-105 hover:shadow-lg"
        >
          Log in
        </Link>
      </nav>
    );
  }

  return (
    <nav className="glass-strong flex items-center justify-between border-b border-white/5 px-6 py-5">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent transition hover:from-accent hover:to-accent-soft"
        >
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.siteName || "Ormsby"}
              className="h-7 w-auto"
            />
          ) : (
            "Ormsby"
          )}
        </Link>
        <div className="hidden items-center gap-2 md:flex">
          {user.role === "ADMIN" ? (
            <>
              <Link
                href="/admin"
                className="rounded-xl border border-white/10 glass px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all duration-300 hover:border-accent/30 hover:scale-105"
              >
                Admin
              </Link>
              <Link
                href="/admin/guitars"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-white/10 hover:text-white hover:scale-105"
              >
                Guitars
              </Link>
              <Link
                href="/admin/orders"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-white/10 hover:text-white hover:scale-105"
              >
                Orders
              </Link>
              <Link
                href="/admin/pricing"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-white/10 hover:text-white hover:scale-105"
              >
                Pricing
              </Link>
              <Link
                href="/admin/accounts"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-white/10 hover:text-white hover:scale-105"
              >
                Accounts
              </Link>
              <Link
                href="/admin/settings"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-white/10 hover:text-white hover:scale-105"
              >
                Settings
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="rounded-xl border border-white/10 glass px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all duration-300 hover:border-accent/30 hover:scale-105"
              >
                Dashboard
              </Link>
              <Link
                href="/dealer"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-white/10 hover:text-white hover:scale-105"
              >
                Guitars
              </Link>
              <Link
                href="/orders"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-white/10 hover:text-white hover:scale-105"
              >
                Orders
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user.role !== "ADMIN" && (
          <Link
            href="/cart"
            className="group relative rounded-2xl border border-white/10 glass p-2.5 text-neutral-400 transition-all duration-300 hover:border-accent/30 hover:text-accent-soft hover:scale-110"
            aria-label="Shopping cart"
          >
          <svg
            className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
            {cartItemCount > 0 && (
              <span 
                className="absolute -right-1.5 -top-1.5 flex min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-black shadow-lg ring-2 ring-accent/50 ring-offset-2 ring-offset-black/50"
                style={{ backgroundColor: '#F97316', color: '#000000' }}
              >
                {cartItemCount > 9 ? "9+" : cartItemCount}
              </span>
            )}
          </Link>
        )}

        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-xl border border-white/5 glass px-3 py-1.5 text-xs font-semibold text-neutral-300">
            {user.email}
          </span>
          <span className="rounded-xl bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            {user.role ?? "Dealer"}
          </span>
        </div>

        {/* Desktop sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="hidden rounded-2xl border border-white/10 glass px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-red-500/30 hover:text-red-400 hover:scale-105 disabled:opacity-50 md:inline-flex"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-200 transition hover:border-accent/40 hover:text-accent md:hidden"
          aria-label="Toggle navigation menu"
        >
          <span className="sr-only">Toggle menu</span>
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="absolute inset-x-0 top-[64px] z-40 border-b border-white/10 bg-black/95 px-4 pb-4 pt-2 shadow-lg md:hidden">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 text-xs">
              {user.role === "ADMIN" ? (
                <>
                  <Link
                    href="/admin"
                    className="rounded-lg bg-white/10 px-3 py-2 font-semibold text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                  <Link
                    href="/admin/guitars"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Guitars
                  </Link>
                  <Link
                    href="/admin/orders"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Orders
                  </Link>
                  <Link
                    href="/admin/pricing"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/admin/accounts"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Accounts
                  </Link>
                  <Link
                    href="/admin/settings"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Settings
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-white/10 px-3 py-2 font-semibold text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/dealer"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Guitars
                  </Link>
                  <Link
                    href="/orders"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Orders
                  </Link>
                  <Link
                    href="/cart"
                    className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-white/10"
                    onClick={() => setMobileOpen(false)}
                  >
                    Cart ({cartItemCount})
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <div className="flex flex-col text-[10px] text-neutral-300">
                <span className="truncate">{user.email}</span>
                <span className="mt-0.5 text-[9px] uppercase tracking-wide text-neutral-500">
                  {user.role ?? "Dealer"}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="ml-2 rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-300 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

