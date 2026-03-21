"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import {
  AdminSettingsDoc,
  AdminBrandingSettings,
  AdminNotificationSettings,
  AdminSmtpSettings,
  AdminMailgunSettings,
  AdminEmailTemplateSettings,
} from "@/lib/types";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, functions, auth } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { getIdToken } from "firebase/auth";
import { CheckCircleIcon, Cog6ToothIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

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
  orderDealerRevisionSubmittedEmail: true,
  orderAdminProposedChangesEmail: true,
  orderDealerProposalResponseEmail: true,
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
  const [mailgun, setMailgun] = useState<AdminMailgunSettings | null>(null);
  const [staffNotes, setStaffNotes] = useState<string>("");
  const [refreshingFxRates, setRefreshingFxRates] = useState(false);
  const [fxRatesStatus, setFxRatesStatus] = useState<string | null>(null);
  const [termsTemplate, setTermsTemplate] = useState<string>("");
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
          setMailgun(data.mailgun ?? null);
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
        mailgun: mailgun ?? null,
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
                notifications.accountRequestEmail ||
                notifications.orderDealerRevisionSubmittedEmail ||
                notifications.orderAdminProposedChangesEmail ||
                notifications.orderDealerProposalResponseEmail
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

            {/* Right column: Mailgun API, SMTP fallback, notifications, email templates */}
            <div className="space-y-6">
              {/* Mailgun API (primary) */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">Mailgun (API)</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Sending uses the Mailgun API when configured. Set in Firebase:{" "}
                  <code className="rounded bg-white/10 px-1 text-xs">functions:config:set mailgun.api_key="KEY" mailgun.domain="mg.yourdomain.com"</code>
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-accent underline-offset-2 hover:underline"
                    onClick={() =>
                      setMailgun((prev) => (prev ? null : { fromEmail: "" }))
                    }
                  >
                    {mailgun ? "Clear" : "Set from address"}
                  </button>
                </div>
                {mailgun && (
                  <div className="mt-3">
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      From email (optional)
                    </label>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={mailgun.fromEmail ?? ""}
                      onChange={(e) =>
                        setMailgun((prev) =>
                          prev ? { ...prev, fromEmail: e.target.value || undefined } : null,
                        )
                      }
                      placeholder="noreply@yourdomain.com"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      If empty, defaults to noreply@ your Mailgun domain.
                    </p>
                  </div>
                )}
              </div>

              {/* Test email & email types list */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">Test email</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Send a test email to verify Mailgun/SMTP is working.
                </p>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-2">
                    Emails you can trial
                  </p>
                  <ul className="space-y-2 text-sm text-neutral-300">
                    <li>
                      <span className="font-medium text-white">Test email</span>
                      <span className="block text-xs text-neutral-400">
                        Use the form below. Generic test to any address.
                      </span>
                    </li>
                    <li>
                      <span className="font-medium text-white">Welcome / login details</span>
                      <span className="block text-xs text-neutral-400">
                        Sent when you create a dealer account with a contact email (Admin → Accounts → Create account). Uses the Welcome subject/body templates.
                      </span>
                    </li>
                    <li>
                      <span className="font-medium text-white">Ad-hoc email</span>
                      <span className="block text-xs text-neutral-400">
                        Any custom email via the sendDealerEmail function (e.g. from scripts or future admin UI).
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px]">
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Send test to
                    </label>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={testEmailTo}
                      onChange={(e) => {
                        setTestEmailTo(e.target.value);
                        setTestEmailMessage(null);
                      }}
                      placeholder="you@example.com"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!testEmailTo.trim() || testEmailSending}
                    className="rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      const to = testEmailTo.trim();
                      if (!to) return;
                      setTestEmailSending(true);
                      setTestEmailMessage(null);
                      try {
                        const sendDealerEmailFn = httpsCallable<
                          { to: string; subject: string; text?: string; html?: string },
                          { success: boolean }
                        >(functions, "sendDealerEmail");
                        await sendDealerEmailFn({
                          to,
                          subject: "Ormsby Dealer Portal – test email",
                          text: "This is a test email. If you received this, the email system is working.",
                        });
                        setTestEmailMessage({ type: "success", text: `Test email sent to ${to}. Check the inbox (and spam).` });
                      } catch (err: any) {
                        setTestEmailMessage({
                          type: "error",
                          text: err?.message || "Failed to send test email.",
                        });
                      } finally {
                        setTestEmailSending(false);
                      }
                    }}
                  >
                    {testEmailSending ? "Sending…" : "Send test email"}
                  </button>
                </div>
                {testEmailMessage && (
                  <p
                    className={`mt-2 text-sm ${testEmailMessage.type === "success" ? "text-green-400" : "text-red-400"}`}
                  >
                    {testEmailMessage.text}
                  </p>
                )}
              </div>

              {/* SMTP (fallback when Mailgun not set) */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-white">SMTP (fallback)</h2>
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
                  Only used if Mailgun API key is not set. For Mailgun, use the API above.
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

                  <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Order revision workflow
                  </p>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                      checked={notifications.orderDealerRevisionSubmittedEmail !== false}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          orderDealerRevisionSubmittedEmail: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="font-medium">Dealer submitted order updates</span>
                      <span className="block text-xs text-neutral-400">
                        Email staff (support email in branding) when a dealer sends an order back for
                        Ormsby review.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                      checked={notifications.orderAdminProposedChangesEmail !== false}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          orderAdminProposedChangesEmail: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="font-medium">Ormsby proposed changes to dealer</span>
                      <span className="block text-xs text-neutral-400">
                        Email the dealer when you submit line/qty/price updates for them to confirm.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/60 text-accent focus:ring-accent/60"
                      checked={notifications.orderDealerProposalResponseEmail !== false}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          orderDealerProposalResponseEmail: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="font-medium">Dealer accepted / requested changes</span>
                      <span className="block text-xs text-neutral-400">
                        Email staff when the dealer accepts your proposal or asks for changes.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* FX Rates */}
              <div className="glass-strong rounded-3xl p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-white">Exchange Rates</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Dealer catalog, cart, and product pages load live Frankfurter rates automatically. Use this to refresh the Firestore backup (used if the live feed fails). AUD → USD, EUR, GBP, CAD. No API key required.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      setRefreshingFxRates(true);
                      setFxRatesStatus(null);
                      try {
                        const currentUser = auth.currentUser;
                        if (!currentUser) {
                          setFxRatesStatus("Error: Not authenticated");
                          return;
                        }
                        await getIdToken(currentUser, true);
                        const refreshFxRatesFn = httpsCallable(functions, "refreshFxRates");
                        const result = await refreshFxRatesFn({});
                        const data = result.data as { success: boolean; asOf: string; base: string };
                        setFxRatesStatus(
                          `Successfully updated rates (base: ${data.base}, as of ${new Date(data.asOf).toLocaleString()})`
                        );
                      } catch (err: any) {
                        console.error("Error refreshing FX rates:", err);
                        setFxRatesStatus(err.message || "Failed to refresh FX rates");
                      } finally {
                        setRefreshingFxRates(false);
                      }
                    }}
                    disabled={refreshingFxRates}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowPathIcon
                      className={`h-4 w-4 ${refreshingFxRates ? "animate-spin" : ""}`}
                    />
                    {refreshingFxRates ? "Refreshing..." : "Refresh FX Rates"}
                  </button>
                  {fxRatesStatus && (
                    <p
                      className={`mt-2 text-xs ${
                        fxRatesStatus.startsWith("Successfully")
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {fxRatesStatus}
                    </p>
                  )}
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
                      Order confirmation body
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={emailTemplates?.orderConfirmationBody ?? ""}
                      onChange={(e) =>
                        setEmailTemplates((prev) => ({
                          ...(prev ?? {}),
                          orderConfirmationBody: e.target.value,
                        }))
                      }
                      placeholder="Thank you for your order. Order ID: {{orderId}}. View: {{orderUrl}}. PO: {{poNumber}}"
                      rows={3}
                    />
                    <p className="mt-1 text-xs text-neutral-500">Placeholders: {"{{orderId}}"}, {"{{orderUrl}}"}, {"{{poNumber}}"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Order status change subject
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={emailTemplates?.statusChangeSubject ?? ""}
                      onChange={(e) =>
                        setEmailTemplates((prev) => ({
                          ...(prev ?? {}),
                          statusChangeSubject: e.target.value,
                        }))
                      }
                      placeholder="Your Ormsby order status has been updated"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Order status change body
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                      value={emailTemplates?.statusChangeBody ?? ""}
                      onChange={(e) =>
                        setEmailTemplates((prev) => ({
                          ...(prev ?? {}),
                          statusChangeBody: e.target.value,
                        }))
                      }
                      placeholder="Order {{orderId}} status is now: {{status}}. View: {{orderUrl}}"
                      rows={3}
                    />
                    <p className="mt-1 text-xs text-neutral-500">Placeholders: {"{{orderId}}"}, {"{{status}}"}, {"{{orderUrl}}"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Welcome / login body
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


