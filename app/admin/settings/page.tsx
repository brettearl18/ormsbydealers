"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import {
  AdminSettingsDoc,
  AdminBrandingSettings,
  AdminNotificationSettings,
  AdminSmtpSettings,
  AdminEmailTemplateSettings,
} from "@/lib/types";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckCircleIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";

const DEFAULT_BRANDING: AdminBrandingSettings = {
  siteName: "Ormsby Dealer Portal",
  logoUrl: "",
  primaryColor: "#06b6d4",
  secondaryColor: "#a855f7",
  supportEmail: "",
};

const DEFAULT_NOTIFICATIONS: AdminNotificationSettings = {
  orderCreatedEmail: true,
  orderStatusChangedEmail: true,
  accountRequestEmail: true,
  dailySummaryEmail: false,
};

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branding, setBranding] = useState<AdminBrandingSettings>(DEFAULT_BRANDING);
  const [smtp, setSmtp] = useState<AdminSmtpSettings | null>(null);
  const [notifications, setNotifications] =
    useState<AdminNotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [emailTemplates, setEmailTemplates] =
    useState<AdminEmailTemplateSettings | null>(null);
  const [staffNotes, setStaffNotes] = useState<string>("");
  const [termsTemplate, setTermsTemplate] = useState<string>("");

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const ref = doc(db, "adminSettings", "global");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as AdminSettingsDoc;
          setBranding({ ...DEFAULT_BRANDING, ...(data.branding || {}) });
          setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(data.notifications || {}) });
          setSmtp(data.smtp ?? null);
          setEmailTemplates(data.emailTemplates ?? null);
          setStaffNotes(data.staffNotes ?? "");
          setTermsTemplate(data.termsTemplate ?? "");
        } else {
          // No settings yet; use defaults
          setBranding(DEFAULT_BRANDING);
          setNotifications(DEFAULT_NOTIFICATIONS);
          setSmtp(null);
          setEmailTemplates(null);
          setStaffNotes("");
        }
      } catch (err) {
        console.error("Error loading admin settings:", err);
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const payload: AdminSettingsDoc = {
        branding,
        notifications,
        smtp: smtp ?? null,
        emailTemplates: emailTemplates ?? null,
        staffNotes: staffNotes || "",
        termsTemplate: termsTemplate || "",
        updatedAt: new Date().toISOString(),
      };

      const ref = doc(db, "adminSettings", "global");
      await setDoc(ref, payload, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error("Error saving admin settings:", err);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminGuard>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading settings…</p>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                Admin Settings
              </span>
            </h1>
            <p className="mt-3 text-base text-neutral-400 sm:text-lg">
              Configure branding, staff info, email delivery, and notifications for the
              dealer portal.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Overview cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-strong flex items-center gap-4 rounded-3xl p-5 shadow-xl">
              <div className="rounded-2xl bg-accent/10 p-3 text-accent">
                <Cog6ToothIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Branding
                </p>
                <p className="text-sm text-neutral-300">
                  {branding.siteName || "Not set"}
                </p>
              </div>
            </div>
            <div className="glass-strong rounded-3xl p-5 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                SMTP Status
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                {smtp?.host ? `Connected to ${smtp.host}` : "Not configured"}
              </p>
            </div>
            <div className="glass-strong rounded-3xl p-5 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Notifications
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                {notifications.orderCreatedEmail ||
                notifications.orderStatusChangedEmail ||
                notifications.accountRequestEmail
                  ? "Key alerts enabled"
                  : "All email alerts disabled"}
              </p>
            </div>
            <div className="glass-strong rounded-3xl p-5 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Staff Notes
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-neutral-300">
                {staffNotes || "Internal notes for your team"}
              </p>
            </div>
          </section>

          {/* Two-column main layout */}
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Left column: branding + staff */}
            <div className="space-y-6 lg:col-span-2">
              {/* Branding */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">Branding</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Control how the portal presents Ormsby to dealers and distributors.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Site name
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={branding.siteName}
                      onChange={(e) =>
                        setBranding((prev) => ({ ...prev, siteName: e.target.value }))
                      }
                      placeholder="Ormsby Dealer Portal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={branding.logoUrl ?? ""}
                      onChange={(e) =>
                        setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))
                      }
                      placeholder="https://…/logo.png"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Primary colour
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={branding.primaryColor ?? ""}
                      onChange={(e) =>
                        setBranding((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                      placeholder="#06b6d4"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Secondary colour
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={branding.secondaryColor ?? ""}
                      onChange={(e) =>
                        setBranding((prev) => ({
                          ...prev,
                          secondaryColor: e.target.value,
                        }))
                      }
                      placeholder="#a855f7"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Support email
                    </label>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={branding.supportEmail ?? ""}
                      onChange={(e) =>
                        setBranding((prev) => ({
                          ...prev,
                          supportEmail: e.target.value,
                        }))
                      }
                      placeholder="dealers@ormsbyguitars.com"
                    />
                  </div>
                </div>
              </div>

              {/* Staff notes */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">Staff & internal notes</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Keep quick notes for your team – escalation contacts, after-hours
                  procedures, or anything relevant to dealers.
                </p>
                <textarea
                  className="mt-4 min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="e.g. For VIP dealers contact Perry directly…"
                />
              </div>

              {/* Terms & conditions template */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">
                  Purchase order terms template
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Paste your latest terms & conditions here so you can reuse them in
                  emails, documents, or the dealer portal. This is for reference only and
                  does not automatically create a legal agreement.
                </p>
                <textarea
                  className="mt-4 min-h-[200px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                  value={termsTemplate}
                  onChange={(e) => setTermsTemplate(e.target.value)}
                  placeholder="Paste your Terms & Conditions text or Markdown here…"
                />
                <p className="mt-2 text-xs text-neutral-500">
                  Tip: keep the canonical version here, then copy–paste into contracts,
                  invoices, or PDF documents as needed.
                </p>
              </div>
            </div>

            {/* Right column: SMTP, notifications, email templates */}
            <div className="space-y-6">
              {/* SMTP */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-white">SMTP / Email gateway</h2>
                  <button
                    type="button"
                    className="text-xs text-accent underline-offset-2 hover:underline"
                    onClick={() =>
                      setSmtp((prev) =>
                        prev
                          ? null
                          : {
                              host: "",
                              port: 587,
                              username: "",
                              fromEmail: "",
                              useTls: true,
                            },
                      )
                    }
                  >
                    {smtp ? "Clear settings" : "Configure"}
                  </button>
                </div>
                <p className="mt-1 text-sm text-neutral-400">
                  Used for outbound dealer emails (order confirmations, status updates, and
                  notifications).
                </p>

                {smtp && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                          Host
                        </label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                          value={smtp.host}
                          onChange={(e) =>
                            setSmtp((prev) =>
                              prev ? { ...prev, host: e.target.value } : null,
                            )
                          }
                          placeholder="smtp.sendgrid.net"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                          Port
                        </label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                          value={smtp.port}
                          onChange={(e) =>
                            setSmtp((prev) =>
                              prev
                                ? { ...prev, port: Number(e.target.value) || 0 }
                                : null,
                            )
                          }
                          placeholder="587"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Username (optional)
                      </label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                        value={smtp.username ?? ""}
                        onChange={(e) =>
                          setSmtp((prev) =>
                            prev ? { ...prev, username: e.target.value } : null,
                          )
                        }
                        placeholder="apikey"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        From email
                      </label>
                      <input
                        type="email"
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                        value={smtp.fromEmail}
                        onChange={(e) =>
                          setSmtp((prev) =>
                            prev ? { ...prev, fromEmail: e.target.value } : null,
                          )
                        }
                        placeholder="dealers@ormsbyguitars.com"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-neutral-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                        checked={smtp.useTls}
                        onChange={(e) =>
                          setSmtp((prev) =>
                            prev ? { ...prev, useTls: e.target.checked } : null,
                          )
                        }
                      />
                      Use TLS / STARTTLS
                    </label>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">Notifications</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Decide which events should generate email alerts.
                </p>

                <div className="mt-4 space-y-3 text-sm text-neutral-200">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                      checked={notifications.orderCreatedEmail}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          orderCreatedEmail: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="font-medium">Dealer order created</span>
                      <span className="block text-xs text-neutral-400">
                        Send an email when a dealer submits a new purchase order.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                      checked={notifications.orderStatusChangedEmail}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          orderStatusChangedEmail: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="font-medium">Order status changed</span>
                      <span className="block text-xs text-neutral-400">
                        Notify when you move orders between production/shipped/completed.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                      checked={notifications.accountRequestEmail}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          accountRequestEmail: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="font-medium">New account requests</span>
                      <span className="block text-xs text-neutral-400">
                        Email admins when a dealer or distributor submits a new request.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                      checked={notifications.dailySummaryEmail}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          dailySummaryEmail: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="font-medium">Daily summary</span>
                      <span className="block text-xs text-neutral-400">
                        Once-a-day digest of new orders and account activity.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Email templates (simple) */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">Email templates</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Short subjects and snippets used in dealer-facing emails. Full template
                  logic can live in Cloud Functions later.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Welcome subject
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={emailTemplates?.welcomeSubject ?? ""}
                      onChange={(e) =>
                        setEmailTemplates((prev) => ({
                          ...(prev ?? {}),
                          welcomeSubject: e.target.value,
                        }))
                      }
                      placeholder="Welcome to the Ormsby dealer portal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Order confirmation subject
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={emailTemplates?.orderConfirmationSubject ?? ""}
                      onChange={(e) =>
                        setEmailTemplates((prev) => ({
                          ...(prev ?? {}),
                          orderConfirmationSubject: e.target.value,
                        }))
                      }
                      placeholder="We’ve received your Ormsby order"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Internal welcome notes
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={emailTemplates?.welcomeBody ?? ""}
                      onChange={(e) =>
                        setEmailTemplates((prev) => ({
                          ...(prev ?? {}),
                          welcomeBody: e.target.value,
                        }))
                      }
                      placeholder="Short text you want to reuse when welcoming new dealers…"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-medium text-black shadow-lg shadow-accent/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      </main>
    </AdminGuard>
  );
}


