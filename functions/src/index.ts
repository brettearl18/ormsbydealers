import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

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
    const { cartItems, shippingAddress, poNumber, notes } =
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

