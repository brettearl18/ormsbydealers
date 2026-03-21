"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;
    setError(null);

    if (newPassword.length < 10) {
      setError("Use at least 10 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      const clearPasswordFlag = httpsCallable<unknown, { success: boolean }>(
        functions,
        "clearMustChangePassword",
      );
      await clearPasswordFlag({});

      await auth.currentUser.getIdToken(true);
      router.replace(user?.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err: any) {
      if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
        setError("Current password is incorrect.");
      } else if (err?.code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else {
        setError("Unable to update password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-neutral-400">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-neutral-400">Please sign in to continue.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-12">
      <div className="rounded-2xl border border-white/10 bg-surface/80 p-8 shadow-soft">
        <h1 className="text-2xl font-semibold tracking-tight">Update your password</h1>
        <p className="mt-2 text-sm text-neutral-400">
          This is required before you can access the portal.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Current password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">New password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-60"
          >
            {submitting ? "Updating..." : "Save new password"}
          </button>
        </form>
      </div>
    </main>
  );
}

