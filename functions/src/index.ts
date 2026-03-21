import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import nodemailer from "nodemailer";

admin.initializeApp();

const db = admin.firestore();

/** Base URL for dealer portal (used in email links). */
const PORTAL_BASE_URL = "https://ormsbydealers.vercel.app";

/** Get dealer email for an order: prefer user doc, else account contactEmail. */
async function getDealerEmailForOrder(accountId: string, createdByUid: string): Promise<string | null> {
  const userSnap = await db.collection("users").doc(createdByUid).get();
  if (userSnap.exists) {
    const email = (userSnap.data() as { email?: string }).email;
    if (email) return email;
  }
  const accountSnap = await db.collection("accounts").doc(accountId).get();
  if (accountSnap.exists) {
    const email = (accountSnap.data() as { contactEmail?: string }).contactEmail;
    if (email) return email;
  }
  return null;
}

async function getSupportEmailFromSettings(): Promise<string | null> {
  const snap = await db.collection("adminSettings").doc("global").get();
  if (!snap.exists) return null;
  const branding = (snap.data() as { branding?: { supportEmail?: string } }).branding;
  const e = branding?.supportEmail?.trim();
  return e || null;
}

interface AdminSmtpSettings {
  host: string;
  port: number;
  username?: string;
  fromEmail: string;
  useTls: boolean;
}

interface FxRatesDoc {
  base: string;
  asOf: string;
  rates: Record<string, number>;
}

/** Mailgun config from Firebase Functions config (preferred over SMTP). */
function getMailgunConfig(): { apiKey: string; domain: string } | null {
  const mailgun = functions.config().mailgun as { api_key?: string; domain?: string } | undefined;
  if (mailgun?.api_key && mailgun?.domain) {
    return { apiKey: mailgun.api_key, domain: mailgun.domain };
  }
  return null;
}

async function getFromEmail(): Promise<string> {
  const docRef = db.collection("adminSettings").doc("global");
  const snap = await docRef.get();
  if (snap.exists) {
    const data = snap.data() as { smtp?: { fromEmail?: string }; mailgun?: { fromEmail?: string } };
    const from = data?.mailgun?.fromEmail || data?.smtp?.fromEmail;
    if (from) return from;
  }
  const mailgun = getMailgunConfig();
  if (mailgun) return `noreply@${mailgun.domain}`;
  return "noreply@example.com";
}

/** Send one email via Mailgun API. */
async function sendEmailViaMailgun(params: {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** Set false so login/reset links are not rewritten (avoids tracking domain SSL issues). */
  trackingClicks?: boolean;
}): Promise<void> {
  const { apiKey, domain } = getMailgunConfig()!;
  const { from, to, subject, text, html, trackingClicks = true } = params;
  const body = new URLSearchParams();
  body.set("from", from);
  body.set("to", to);
  body.set("subject", subject);
  if (text) body.set("text", text);
  if (html) body.set("html", html);
  if (trackingClicks === false) body.set("o:tracking-clicks", "no");

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Mailgun API error ${res.status}: ${errText}`);
  }
}

async function getSmtpSettings(): Promise<AdminSmtpSettings> {
  const docRef = db.collection("adminSettings").doc("global");
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SMTP settings are not configured in admin settings.",
    );
  }
  const data = snap.data() as { smtp?: AdminSmtpSettings };
  const smtp = data.smtp;
  if (!smtp || !smtp.host || !smtp.port || !smtp.fromEmail) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "SMTP settings are incomplete. Please configure host, port and from email.",
    );
  }
  return smtp;
}

/** Send email via Mailgun API (if configured) or SMTP. */
async function sendEmail(params: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  /** Set false for emails with login/reset links so they are not rewritten by Mailgun. */
  trackingClicks?: boolean;
}): Promise<void> {
  const from = params.from || (await getFromEmail());
  const mailgun = getMailgunConfig();
  if (mailgun) {
    await sendEmailViaMailgun({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      trackingClicks: params.trackingClicks,
    });
    return;
  }
  const smtp = await getSmtpSettings();
  const smtpPassword = functions.config().smtp?.password as string | undefined;
  if (smtp.username && !smtpPassword) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Either set Mailgun (functions config mailgun.api_key + mailgun.domain) or SMTP password (smtp.password).",
    );
  }
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.username ? { user: smtp.username, pass: smtpPassword } : undefined,
  });
  await transporter.sendMail({
    from: smtp.fromEmail,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

interface SubmitOrderRequest {
  cartItems: Array<{
    guitarId: string;
    sku: string;
    name: string;
    qty: number;
    unitPrice: number;
    selectedOptions?: Record<string, string>;
  }>;
  shippingAddress: {
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
  };
  poNumber?: string;
  notes?: string;
  termsAccepted?: {
    accepted: boolean;
    acceptedAt: string;
  };
}

export const submitOrder = functions.https.onCall(async (data: SubmitOrderRequest, context: functions.https.CallableContext) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated",
      );
    }

    const uid = context.auth.uid;
    const { cartItems, shippingAddress, poNumber, notes, termsAccepted } =
      data as SubmitOrderRequest;

  // Validate input
  if (!cartItems || cartItems.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Cart must contain at least one item",
    );
  }

  if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.country) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Shipping address is required",
    );
  }

  // Get user's accountId and currency from custom claims
  const token = await admin.auth().getUser(uid);
  const accountId = token.customClaims?.accountId as string | undefined;
  // Base currency is AUD - orders are stored in dealer's currency for display
  // but pricing is always in AUD
  const currency = (token.customClaims?.currency as string | undefined) || "AUD";

  if (!accountId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "User account is not configured",
    );
  }

  // Compute totals
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0,
  );

  // Create order document
  const orderRef = db.collection("orders").doc();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const orderData = {
    accountId,
    createdByUid: uid,
    status: "SUBMITTED" as const,
    currency,
    totals: {
      subtotal,
      currency,
    },
    shippingAddress,
    poNumber: poNumber || null,
    notes: notes || null,
    termsAccepted: termsAccepted || null,
    createdAt: now,
    updatedAt: now,
  };

  // Write order and lines in a batch
  const batch = db.batch();
  batch.set(orderRef, orderData);

  // Add order lines
  for (const item of cartItems) {
    const lineRef = orderRef.collection("lines").doc();
    batch.set(lineRef, {
      guitarId: item.guitarId,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.qty,
      selectedOptions: item.selectedOptions || null,
    });
  }

    await batch.commit();

    // Order confirmation email (if enabled)
    const orderId = orderRef.id;
    (async () => {
      try {
        const settingsSnap = await db.collection("adminSettings").doc("global").get();
        if (!settingsSnap.exists) return;
        const settings = settingsSnap.data() as {
          notifications?: { orderCreatedEmail?: boolean };
          emailTemplates?: { orderConfirmationSubject?: string; orderConfirmationBody?: string };
        };
        if (!settings.notifications?.orderCreatedEmail) return;
        const dealerEmail = await getDealerEmailForOrder(accountId, uid);
        if (!dealerEmail) return;
        const orderUrl = `${PORTAL_BASE_URL}/orders/${orderId}`;
        const subject =
          settings.emailTemplates?.orderConfirmationSubject ||
          "We've received your Ormsby order";
        let body =
          settings.emailTemplates?.orderConfirmationBody ||
          "Thank you for your order.\n\nOrder ID: {{orderId}}\nView order: {{orderUrl}}\n\nWe'll notify you when the status changes.";
        body = body
          .replace(/\{\{orderId\}\}/g, orderId)
          .replace(/\{\{orderUrl\}\}/g, orderUrl)
          .replace(/\{\{poNumber\}\}/g, poNumber || "");
        await sendEmail({ to: dealerEmail, subject, text: body });
      } catch (err) {
        console.error("Order confirmation email failed:", err);
      }
    })();

    return {
      orderId: orderRef.id,
      status: "SUBMITTED",
    };
  } catch (error: any) {
    console.error("Error in submitOrder:", error);
    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    // Otherwise, wrap it in an internal error
    throw new functions.https.HttpsError(
      "internal",
      error.message || "An error occurred while processing your order",
    );
  }
});

interface SendDealerEmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendDealerEmail = functions.https.onCall(
  async (data: SendDealerEmailRequest, context: functions.https.CallableContext) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated to send emails.",
        );
      }

      const role = context.auth.token.role as string | undefined;
      if (role !== "ADMIN") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only admin users can send system emails.",
        );
      }

      const { to, subject, text, html } = data;
      if (!to || !subject || (!text && !html)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Email 'to', 'subject', and at least one of 'text' or 'html' are required.",
        );
      }

      await sendEmail({ to, subject, text, html });
      return { success: true };
    } catch (error: any) {
      console.error("Error in sendDealerEmail:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to send email.",
      );
    }
  },
);

/**
 * Password reset via Mailgun (no auth required).
 * Generates a Firebase reset link and sends it from your domain for better deliverability.
 */
export const requestPasswordReset = functions.https.onCall(
  async (data: { email: string }, context: functions.https.CallableContext) => {
    const email = typeof data?.email === "string" ? data.email.trim() : "";
    if (!email) {
      throw new functions.https.HttpsError("invalid-argument", "Email is required.");
    }
    try {
      const auth = admin.auth();
      let link: string;
      try {
        link = await auth.generatePasswordResetLink(email, {
          url: `${PORTAL_BASE_URL}/login`,
        });
      } catch (err: any) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
          return { success: true };
        }
        throw err;
      }
      const settingsSnap = await db.collection("adminSettings").doc("global").get();
      const settings = settingsSnap.exists
        ? (settingsSnap.data() as {
            emailTemplates?: { passwordResetSubject?: string; passwordResetBody?: string };
          })
        : null;
      const subject =
        settings?.emailTemplates?.passwordResetSubject ||
        "Reset your Ormsby Dealer Portal password";
      let body =
        settings?.emailTemplates?.passwordResetBody ||
        "You requested a password reset.\n\nClick the link below to set a new password:\n{{resetLink}}\n\nIf you didn't request this, you can ignore this email. The link expires in 1 hour.";
      body = body.replace(/\{\{resetLink\}\}/g, link);
      await sendEmail({ to: email, subject, text: body, trackingClicks: false });
      return { success: true };
    } catch (error: any) {
      console.error("Error in requestPasswordReset:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send reset email. Please try again.",
      );
    }
  },
);

/**
 * Check if the current user has a pending account request (for login flow).
 * Requires auth; avoids client needing Firestore read on accountRequests.
 */
export const checkAccountRequestStatus = functions.https.onCall(
  async (_data: unknown, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = context.auth.uid;
    const snap = await db
      .collection("accountRequests")
      .where("uid", "==", uid)
      .where("status", "==", "PENDING")
      .limit(1)
      .get();
    return { hasPendingRequest: !snap.empty };
  },
);

/**
 * Clears mustChangePassword custom claim after the user updates password.
 * Requires auth.
 */
export const clearMustChangePassword = functions.https.onCall(
  async (_data: unknown, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = context.auth.uid;
    const user = await admin.auth().getUser(uid);
    const claims = user.customClaims || {};
    await admin.auth().setCustomUserClaims(uid, {
      ...claims,
      mustChangePassword: false,
    });
    return { success: true };
  },
);

/** Request body for createDealerAuthUser */
interface CreateDealerAuthUserRequest {
  accountId: string;
  email: string;
  companyName: string;
  contactName?: string;
  accountType: "DEALER" | "DISTRIBUTOR";
  /** If true, send login details email via SMTP. Default true. */
  sendEmail?: boolean;
}

/**
 * Creates (or updates) a Firebase Auth user for a dealer/distributor with
 * temporary password = companyName + "123!@#", sets custom claims, writes
 * users/{uid}, and optionally sends login-details email.
 * Admin only.
 */
export const createDealerAuthUser = functions.https.onCall(
  async (data: CreateDealerAuthUserRequest, context: functions.https.CallableContext) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated.",
        );
      }
      const role = context.auth.token.role as string | undefined;
      if (role !== "ADMIN") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only admin users can create dealer auth users.",
        );
      }

      const { accountId, email, companyName, contactName, accountType } =
        data as CreateDealerAuthUserRequest;
      const shouldSendEmail = data.sendEmail !== false;

      if (!accountId || !email || !companyName?.trim()) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "accountId, email, and companyName are required.",
        );
      }

      const accountSnap = await db.collection("accounts").doc(accountId).get();
      if (!accountSnap.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Account not found. Create the account first.",
        );
      }
      const accountData = accountSnap.data() as { tierId?: string; currency?: string };
      const tierId = accountData.tierId || "TIER_A";
      const currency = accountData.currency || "AUD";

      const tempPassword = companyName.trim() + "123!@#";
      const auth = admin.auth();
      let user: admin.auth.UserRecord;

      try {
        user = await auth.getUserByEmail(email);
        await auth.updateUser(user.uid, { password: tempPassword });
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          user = await auth.createUser({
            email,
            emailVerified: false,
            password: tempPassword,
            displayName: contactName || companyName.trim(),
          });
        } else {
          throw err;
        }
      }

      const claims = {
        role: accountType,
        accountId,
        tierId,
        currency,
        mustChangePassword: true,
      };
      await auth.setCustomUserClaims(user.uid, claims);

      const now = new Date().toISOString();
      await db.collection("users").doc(user.uid).set(
        {
          role: accountType,
          accountId,
          email,
          name: contactName || companyName.trim(),
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      let emailSent = false;
      if (shouldSendEmail) {
        try {
          const mailgun = getMailgunConfig();
          const smtp = mailgun ? null : await getSmtpSettings().catch(() => null);
          const smtpPassword = functions.config().smtp?.password as string | undefined;
          const canSend = mailgun || (smtp && (smtpPassword || !smtp.username));
          if (canSend) {
            const settingsSnap = await db.collection("adminSettings").doc("global").get();
            const settingsData = (settingsSnap.exists ? settingsSnap.data() : null) as {
              emailTemplates?: { welcomeSubject?: string; welcomeBody?: string };
            } | null;
            const welcomeSubject =
              settingsData?.emailTemplates?.welcomeSubject || "Your Ormsby Dealer Portal login";
            let body =
              settingsData?.emailTemplates?.welcomeBody ||
              "Your dealer portal account is ready.\n\nLogin URL: {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{password}}\n\nPlease change your password after first login if the portal allows it.";
            body = body
              .replace(/\{\{email\}\}/g, email)
              .replace(/\{\{password\}\}/g, tempPassword)
              .replace(/\{\{loginUrl\}\}/g, `${PORTAL_BASE_URL}/login`);
            await sendEmail({
              to: email,
              subject: welcomeSubject,
              text: body,
              trackingClicks: false,
            });
            emailSent = true;
          }
        } catch (emailErr: any) {
          console.error("Failed to send login email:", emailErr);
        }
      }

      return { uid: user.uid, emailSent };
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error("Error in createDealerAuthUser:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to create dealer auth user.",
      );
    }
  },
);

/** Request body for resendDealerLoginEmail */
interface ResendDealerLoginEmailRequest {
  accountId: string;
  /** If omitted, uses account.contactEmail */
  email?: string;
}

/**
 * Resends the dealer login/welcome email (new temp password + same template).
 * Admin only. Use when the first email didn't come through.
 */
export const resendDealerLoginEmail = functions.https.onCall(
  async (data: ResendDealerLoginEmailRequest, context: functions.https.CallableContext) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated.",
        );
      }
      const role = context.auth.token.role as string | undefined;
      if (role !== "ADMIN") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only admin users can resend login emails.",
        );
      }

      const accountId = typeof data?.accountId === "string" ? data.accountId.trim() : "";
      if (!accountId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "accountId is required.",
        );
      }

      const accountSnap = await db.collection("accounts").doc(accountId).get();
      if (!accountSnap.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Account not found.",
        );
      }
      const accountData = accountSnap.data() as {
        name?: string;
        contactEmail?: string;
        tierId?: string;
        currency?: string;
      };
      const companyName = accountData.name?.trim() || accountId;
      const email =
        (typeof data?.email === "string" ? data.email.trim() : null) ||
        accountData.contactEmail?.trim() ||
        null;
      if (!email) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "No email to send to. Set contact email on the account or pass email.",
        );
      }

      const auth = admin.auth();
      let user: admin.auth.UserRecord;
      try {
        user = await auth.getUserByEmail(email);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "No Firebase user found with that email. Create the user first (e.g. via Create Account with email).",
          );
        }
        throw err;
      }

      const tempPassword = companyName + "123!@#";
      await auth.updateUser(user.uid, { password: tempPassword });
      const existingClaims = user.customClaims || {};
      await auth.setCustomUserClaims(user.uid, {
        ...existingClaims,
        mustChangePassword: true,
      });

      let emailSent = false;
      try {
        const mailgun = getMailgunConfig();
        const smtp = mailgun ? null : await getSmtpSettings().catch(() => null);
        const smtpPassword = functions.config().smtp?.password as string | undefined;
        const canSend = mailgun || (smtp && (smtpPassword || !smtp?.username));
        if (canSend) {
          const settingsSnap = await db.collection("adminSettings").doc("global").get();
          const settingsData = (settingsSnap.exists ? settingsSnap.data() : null) as {
            emailTemplates?: { welcomeSubject?: string; welcomeBody?: string };
          } | null;
          const welcomeSubject =
            settingsData?.emailTemplates?.welcomeSubject ||
            "Your Ormsby Dealer Portal login";
          let body =
            settingsData?.emailTemplates?.welcomeBody ||
            "Your dealer portal account is ready.\n\nLogin URL: {{loginUrl}}\nEmail: {{email}}\nTemporary password: {{password}}\n\nPlease change your password after first login if the portal allows it.";
          body = body
            .replace(/\{\{email\}\}/g, email)
            .replace(/\{\{password\}\}/g, tempPassword)
            .replace(/\{\{loginUrl\}\}/g, `${PORTAL_BASE_URL}/login`);
          await sendEmail({
            to: email,
            subject: welcomeSubject,
            text: body,
            trackingClicks: false,
          });
          emailSent = true;
        }
      } catch (emailErr: any) {
        console.error("Failed to resend login email:", emailErr);
      }

      return { emailSent };
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error("Error in resendDealerLoginEmail:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to resend login email.",
      );
    }
  },
);

/**
 * Refresh FX rates from Frankfurter API (free, no API key).
 * Base: AUD. Targets: USD, EUR, GBP, CAD for EU, USA, GBP, CAD dealers.
 * @see https://frankfurter.dev/
 */
const FRANKFURTER_BASE = "AUD";
const FRANKFURTER_SYMBOLS = "USD,EUR,GBP,CAD";

export const refreshFxRates = functions.https.onCall(
  async (_data: unknown, context: functions.https.CallableContext) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated to refresh FX rates.",
        );
      }

      const role = context.auth.token.role as string | undefined;
      if (role !== "ADMIN") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only admin users can refresh FX rates.",
        );
      }

      const url = `https://api.frankfurter.dev/v1/latest?base=${FRANKFURTER_BASE}&symbols=${FRANKFURTER_SYMBOLS}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error("Frankfurter API error:", response.status, response.statusText);
        throw new functions.https.HttpsError(
          "internal",
          "Failed to fetch FX rates from Frankfurter.",
        );
      }

      const json = (await response.json()) as {
        base: string;
        date: string;
        rates: Record<string, number>;
      };

      const now = new Date();
      let asOf: string;
      if (json.date) {
        const apiDate = new Date(json.date + "T12:00:00.000Z");
        // Never store a future date — use now if API date is ahead (avoids confusion)
        asOf = apiDate > now ? now.toISOString() : apiDate.toISOString();
      } else {
        asOf = now.toISOString();
      }
      const fxDoc: FxRatesDoc = {
        base: json.base,
        asOf,
        rates: json.rates,
      };

      await db.collection("fxRates").doc("latest").set(fxDoc, { merge: true });

      return { success: true, asOf: fxDoc.asOf, base: fxDoc.base };
    } catch (error: any) {
      console.error("Error in refreshFxRates:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to refresh FX rates.",
      );
    }
  },
);

/** Send email to dealer when order status is updated (if notification enabled). */
export const onOrderUpdated = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as { status?: string };
    const after = change.after.data() as { status?: string; accountId?: string; createdByUid?: string };
    if (before.status === after.status) return;

    try {
      const settingsSnap = await db.collection("adminSettings").doc("global").get();
      if (!settingsSnap.exists) return;
      const settings = settingsSnap.data() as {
        notifications?: { orderStatusChangedEmail?: boolean };
        emailTemplates?: { statusChangeSubject?: string; statusChangeBody?: string };
      };
      if (!settings.notifications?.orderStatusChangedEmail) return;

      const orderId = context.params.orderId as string;
      const accountId = after.accountId;
      const createdByUid = after.createdByUid;
      if (!accountId || !createdByUid) return;

      const dealerEmail = await getDealerEmailForOrder(accountId, createdByUid);
      if (!dealerEmail) return;

      const newStatus = after.status || "Unknown";
      const orderUrl = `${PORTAL_BASE_URL}/orders/${orderId}`;
      const subject =
        settings.emailTemplates?.statusChangeSubject ||
        "Your Ormsby order status has been updated";
      let body =
        settings.emailTemplates?.statusChangeBody ||
        "Order {{orderId}} status is now: {{status}}\n\nView order: {{orderUrl}}";
      body = body
        .replace(/\{\{orderId\}\}/g, orderId)
        .replace(/\{\{status\}\}/g, newStatus)
        .replace(/\{\{orderUrl\}\}/g, orderUrl);

      await sendEmail({ to: dealerEmail, subject, text: body });
    } catch (err) {
      console.error("Order status change email failed:", err);
    }
  });

/** Emails for dealer revision submit / admin proposed changes / dealer response (independent of status). */
export const onOrderRevisionWorkflowEmail = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Record<string, unknown>;
    const after = change.after.data() as Record<string, unknown>;
    const orderId = context.params.orderId as string;
    const accountId = after.accountId as string | undefined;
    const createdByUid = after.createdByUid as string | undefined;
    const orderUrl = `${PORTAL_BASE_URL}/orders/${orderId}`;
    const adminOrderUrl = `${PORTAL_BASE_URL}/admin/orders/${orderId}`;

    try {
      const settingsSnap = await db.collection("adminSettings").doc("global").get();
      const notifications = settingsSnap.exists
        ? (settingsSnap.data() as {
            notifications?: {
              orderDealerRevisionSubmittedEmail?: boolean;
              orderAdminProposedChangesEmail?: boolean;
              orderDealerProposalResponseEmail?: boolean;
            };
          }).notifications
        : {};

      const staffEmail = await getSupportEmailFromSettings();

      // Dealer submitted updated order for Ormsby review (skip if same update is "reject admin proposal")
      if (after.pendingOrmsbyRevisionReview && !before.pendingOrmsbyRevisionReview) {
        const isRejectAdminProposal =
          Boolean(after.dealerRejectedAdminProposedAt) &&
          after.dealerRejectedAdminProposedAt !== before.dealerRejectedAdminProposedAt;
        if (
          !isRejectAdminProposal &&
          notifications?.orderDealerRevisionSubmittedEmail !== false &&
          staffEmail
        ) {
          await sendEmail({
            to: staffEmail,
            subject: `[Ormsby] Dealer submitted order updates — ${orderId.slice(0, 8)}`,
            text: `A dealer submitted changes on order ${orderId} for review.\n\nReview in admin: ${adminOrderUrl}`,
          });
        }
      }

      // Ormsby sent proposed line/pricing changes to dealer
      if (after.dealerPendingAdminProposedChanges && !before.dealerPendingAdminProposedChanges) {
        if (notifications?.orderAdminProposedChangesEmail !== false && accountId && createdByUid) {
          const dealerEmail = await getDealerEmailForOrder(accountId, createdByUid);
          if (dealerEmail) {
            const note = (after.adminProposedChangesNote as string | undefined)?.trim();
            await sendEmail({
              to: dealerEmail,
              subject: `[Ormsby] Please confirm updated order — ${orderId.slice(0, 8)}`,
              text: `Ormsby has updated your order ${orderId}. Please open the portal to review and accept or request changes.\n\n${orderUrl}${note ? `\n\nNote from Ormsby:\n${note}` : ""}`,
            });
          }
        }
      }

      // Dealer accepted admin proposal
      if (after.dealerAcceptedAdminChangesAt && !before.dealerAcceptedAdminChangesAt) {
        if (notifications?.orderDealerProposalResponseEmail !== false && staffEmail) {
          await sendEmail({
            to: staffEmail,
            subject: `[Ormsby] Dealer accepted proposed order changes — ${orderId.slice(0, 8)}`,
            text: `The dealer accepted the proposed changes on order ${orderId}.\n\n${adminOrderUrl}`,
          });
        }
      }

      // Dealer requested changes after admin proposal
      if (after.dealerRejectedAdminProposedAt && !before.dealerRejectedAdminProposedAt) {
        if (notifications?.orderDealerProposalResponseEmail !== false && staffEmail) {
          const note = (after.dealerRejectedAdminProposedNote as string | undefined)?.trim();
          await sendEmail({
            to: staffEmail,
            subject: `[Ormsby] Dealer requested changes — ${orderId.slice(0, 8)}`,
            text: `The dealer requested changes after your proposed update on order ${orderId}.${note ? `\n\nDealer note:\n${note}` : ""}\n\n${adminOrderUrl}`,
          });
        }
      }
    } catch (err) {
      console.error("Order revision workflow email failed:", err);
    }
  });


