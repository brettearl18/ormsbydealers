"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Navigation() {
  const { user, loading } = useAuth();
  const { items } = useCart();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

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
          Ormsby
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
          Ormsby
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
      <div className="flex items-center gap-6">
        <Link
          href="/dashboard"
          className="text-xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent transition hover:from-accent hover:to-accent-soft"
        >
          Ormsby
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

      <div className="flex items-center gap-3">
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

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="rounded-2xl border border-white/10 glass px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 hover:border-red-500/30 hover:text-red-400 hover:scale-105 disabled:opacity-50"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </nav>
  );
}

