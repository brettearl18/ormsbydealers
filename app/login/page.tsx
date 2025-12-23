"use client";

import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, authLoading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Wait for auth state to update and get the user's role
      const token = await userCredential.user.getIdTokenResult();
      const role = token.claims.role as string | undefined;
      
      // Redirect based on role
      if (role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("Invalid email or password");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />
      
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <span className="text-2xl font-bold text-accent">O</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Ormsby Dealer Portal
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Sign in with your Ormsby Guitars account
          </p>
        </div>

        {/* Login Form Card */}
        <div className="glass-strong rounded-2xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                  placeholder="dealer@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Password
              </label>
              <div className="relative">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs text-red-400" role="alert">
                  {error}
                </p>
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-accent-soft hover:shadow-lg hover:shadow-accent/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
            >
              {submitting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-400">
              Don't have an account?{" "}
              <Link
                href="#"
                className="font-medium text-accent transition hover:text-accent-soft"
              >
                Contact Ormsby Guitars
              </Link>
            </p>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-neutral-500">Or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Access Requirements */}
          <div className="mt-6 rounded-lg border border-white/5 bg-white/5 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Access Requirements
            </h3>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-accent">•</span>
                <span>Have an authorized dealer account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-accent">•</span>
                <span>Be authorized by Ormsby Guitars management</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-accent">•</span>
                <span>Use secure authentication</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}


