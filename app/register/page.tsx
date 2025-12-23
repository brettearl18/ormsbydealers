"use client";

import { FormEvent, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { EnvelopeIcon, LockClosedIcon, BuildingOfficeIcon, UserIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { collection, addDoc } from "firebase/firestore";

interface RegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  contactName: string;
  accountType: "DEALER" | "DISTRIBUTOR";
  phone?: string;
  address?: string;
  territory?: string;
  notes?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegistrationFormData>({
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    contactName: "",
    accountType: "DEALER",
    phone: "",
    address: "",
    territory: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!formData.companyName || !formData.contactName || !formData.email) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Create account request in Firestore
      await addDoc(collection(db, "accountRequests"), {
        email: formData.email,
        uid: userCredential.user.uid,
        companyName: formData.companyName,
        contactName: formData.contactName,
        accountType: formData.accountType,
        phone: formData.phone || null,
        address: formData.address || null,
        territory: formData.territory || null,
        notes: formData.notes || null,
        status: "PENDING",
        requestedAt: new Date().toISOString(),
      });

      // Sign out the user (they need to wait for approval)
      await auth.signOut();

      setSuccess(true);
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError("Registration failed. Please try again.");
      }
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        <div className="relative z-10 w-full max-w-md">
          <div className="glass-strong rounded-2xl border border-white/10 p-8 shadow-2xl text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg
                className="h-8 w-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-white">Registration Submitted</h1>
            <p className="mt-4 text-sm text-neutral-300">
              Your registration request has been submitted successfully. An Ormsby representative will review your request and contact you once your account has been approved.
            </p>
            <div className="mt-6 rounded-lg border border-white/5 bg-white/5 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                What happens next?
              </p>
              <ul className="space-y-2 text-xs text-neutral-300">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>We'll review your registration request</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>You'll receive an email once your account is approved</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>You can then sign in to access the dealer portal</span>
                </li>
              </ul>
            </div>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />
      
      <div className="relative z-10 w-full max-w-2xl">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <span className="text-2xl font-bold text-accent">O</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Request Dealer Access
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Submit a request to access the Ormsby Guitars dealer portal
          </p>
        </div>

        {/* Registration Form Card */}
        <div className="glass-strong rounded-2xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Account Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Account Type <span className="text-red-400">*</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, accountType: "DEALER" })}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    formData.accountType === "DEALER"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/20"
                  }`}
                >
                  <BuildingOfficeIcon className="mx-auto mb-2 h-6 w-6" />
                  Dealer (Store)
                  <p className="mt-1 text-xs text-neutral-400">Single or multiple store locations</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, accountType: "DISTRIBUTOR" })}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    formData.accountType === "DISTRIBUTOR"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/20"
                  }`}
                >
                  <BuildingOfficeIcon className="mx-auto mb-2 h-6 w-6" />
                  Distributor
                  <p className="mt-1 text-xs text-neutral-400">Distribute to multiple stores</p>
                </button>
              </div>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Company Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <BuildingOfficeIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                  placeholder="Your company name"
                />
              </div>
            </div>

            {/* Contact Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Contact Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                  placeholder="Your full name"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Email Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <LockClosedIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            {/* Phone (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Phone (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            {/* Territory (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Territory/Region (Optional)</label>
              <input
                type="text"
                value={formData.territory}
                onChange={(e) => setFormData({ ...formData, territory: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                placeholder="e.g., West Coast, USA, Europe"
              />
            </div>

            {/* Additional Notes (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Additional Information (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-all focus:border-accent/50 focus:bg-white/10 focus:ring-2 focus:ring-accent/20"
                placeholder="Any additional information about your business..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs text-red-400" role="alert">
                  {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
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
                  Submitting...
                </>
              ) : (
                <>
                  Submit Request
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-accent transition hover:text-accent-soft"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}


