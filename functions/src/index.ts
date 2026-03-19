import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import nodemailer from "nodemailer";

admin.initializeApp();

const db = admin.firestore();

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
}): Promise<void> {
  const { apiKey, domain } = getMailgunConfig()!;
  const { from, to, subject, text, html } = params;
  const body = new URLSearchParams();
  body.set("from", from);
  body.set("to", to);
  body.set("subject", subject);
  if (text) body.set("text", text);
  if (html) body.set("html", html);

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
      const sendEmail = data.sendEmail !== false;

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
      if (sendEmail) {
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
              .replace(/\{\{loginUrl\}\}/g, "https://ormsbydistribute.web.app/login");
            await sendEmail({
              to: email,
              subject: welcomeSubject,
              text: body,
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

      const appId = functions.config().oer?.app_id as string | undefined;
      if (!appId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "OpenExchangeRates app_id is not configured. Set functions config oer.app_id.",
        );
      }

      // Fetch FX rates with AUD as base currency
      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=AUD`,
      );

      if (!response.ok) {
        console.error("OpenExchangeRates error:", response.status, response.statusText);
        throw new functions.https.HttpsError(
          "internal",
          "Failed to fetch FX rates from OpenExchangeRates.",
        );
      }

      const json = (await response.json()) as {
        base: string;
        rates: Record<string, number>;
        timestamp: number;
      };

      const fxDoc: FxRatesDoc = {
        base: json.base,
        asOf: new Date(json.timestamp * 1000).toISOString(),
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



