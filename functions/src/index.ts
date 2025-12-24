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
  const currency = (token.customClaims?.currency as string | undefined) || "USD";

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

      const smtp = await getSmtpSettings();

      // Secret (password / API key) is stored in Functions config:
      // firebase functions:config:set smtp.password="YOUR_SECRET"
      const smtpPassword = functions.config().smtp?.password as
        | string
        | undefined;

      if (!smtpPassword && smtp.username) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "SMTP password is not configured in Functions config (smtp.password).",
        );
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465, // true for 465, false for 587/others
        auth: smtp.username
          ? {
              user: smtp.username,
              pass: smtpPassword,
            }
          : undefined,
      });

      await transporter.sendMail({
        from: smtp.fromEmail,
        to,
        subject,
        text,
        html,
      });

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

      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${appId}`,
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



