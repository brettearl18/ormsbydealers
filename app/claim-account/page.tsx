"use client";

import { Suspense, FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  confirmPasswordReset,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";

function readOobCodeFromWindow(): string | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  let code = search.get("oobCode") || search.get("oobcode");
  if (code) return code;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  if (hash.includes("oobCode=")) {
    const q = hash.includes("?") ? hash.split("?")[1]! : hash;
    code = new URLSearchParams(q).get("oobCode");
    if (code) return code;
  }
  return null;
}

function ClaimAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [emailFromCode, setEmailFromCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const code =
      searchParams.get("oobCode") ||
      searchParams.get("oobcode") ||
      readOobCodeFromWindow();
    if (!code) {
      setChecking(false);
      return;
    }
    setOobCode(code);
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        setEmailFromCode(email);
        setCodeInvalid(false);
      })
      .catch(() => {
        setCodeInvalid(true);
      })
      .finally(() => setChecking(false));
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!oobCode) return;
    setError(null);
    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      await signInWithEmailAndPassword(auth, emailFromCode, password);
      try {
        const clearPasswordFlag = httpsCallable<unknown, { success: boolean }>(
          functions,
          "clearMustChangePassword",
        );
        await clearPasswordFlag({});
      } catch {
        /* ok if claim-only users already have mustChangePassword false */
      }
      await auth.currentUser?.getIdToken(true);
      const token = await auth.currentUser?.getIdTokenResult();
      const role = token?.claims?.role as string | undefined;
      router.replace(role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
      if (code === "auth/weak-password") {
        setError("Password is too weak. Use a longer mix of letters and numbers.");
      } else {
        setError(
          "Could not complete setup. The link may have expired — ask Ormsby to resend your welcome email.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-[50vh] flex-1 items-center justify-center px-6">
        <p className="text-sm text-neutral-400">Checking your link…</p>
      </main>
    );
  }

  if (!oobCode || codeInvalid) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-surface/80 p-8 shadow-soft">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Claim your account</h1>
          <p className="mt-3 text-sm text-neutral-400">
            Use the <span className="text-neutral-300">setup link</span> in your welcome email from
            Ormsby. It opens this page so you can choose your password in one step — no temporary
            password to type.
          </p>
          <p className="mt-4 text-sm text-neutral-400">
            Already set a password?{" "}
            <Link href="/login" className="font-medium text-accent-soft hover:text-accent">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-12">
      <div className="rounded-2xl border border-white/10 bg-surface/80 p-8 shadow-soft">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Choose your password</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Account: <span className="text-neutral-200">{emailFromCode}</span>
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs text-neutral-400">New password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save password & sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ClaimAccountPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[50vh] flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading…</p>
        </main>
      }
    >
      <ClaimAccountForm />
    </Suspense>
  );
}
