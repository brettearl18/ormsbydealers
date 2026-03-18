/**
 * Seed Firestore orders from purchase-orders-by-company.json.
 *
 * - Creates/updates an account per dealer (accounts/{accountId}).
 * - Creates a DRAFT order for each purchase order and line items in orders/{orderId}/lines.
 *
 * Usage:
 *   cd dealer-portal
 *   node scripts/seedOrdersFromJson.mjs
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account from parent directory (same as other scripts)
const serviceAccountPath = join(
  __dirname,
  "../../ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json",
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const ordersJsonPath = join(
  __dirname,
  "../purchase-orders-by-company.json",
);

function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureAccountForDealer(dealerName, currency = "AUD") {
  const baseId = slugify(dealerName || "dealer");
  const accountId = `acct_${baseId || "dealer"}`;
  const ref = db.collection("accounts").doc(accountId);

  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: dealerName,
      tierId: "TIER_A",
      currency,
      territory: "",
      terms: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("  • Created account", accountId, "for", dealerName);
  }

  return accountId;
}

async function seed() {
  console.log("🌱 Seeding orders from purchase-orders-by-company.json\n");

  const raw = readFileSync(ordersJsonPath, "utf8");
  const data = JSON.parse(raw);
  const purchaseOrders = data.purchaseOrders || [];

  if (!Array.isArray(purchaseOrders) || purchaseOrders.length === 0) {
    console.error("❌ No purchaseOrders found in JSON.");
    process.exit(1);
  }

  for (const po of purchaseOrders) {
    const dealerName = po.dealer || "Unknown Dealer";
    const run = po.run || "";

    const accountId = await ensureAccountForDealer(dealerName, "AUD");

    const orderRef = db.collection("orders").doc();

    const nowIso = new Date().toISOString();
    const cartItems = Array.isArray(po.cartItems) ? po.cartItems : [];

    const subtotal = cartItems.reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.qty) || 0),
      0,
    );

    // Ensure company name is set even if shippingAddress.company was empty in JSON
    const shippingAddress = {
      company: dealerName,
      line1: "",
      line2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "",
      ...(po.shippingAddress || {}),
    };
    if (!shippingAddress.company) {
      shippingAddress.company = dealerName;
    }

    const orderDoc = {
      accountId,
      createdByUid: "system-seed",
      status: "DRAFT",
      currency: "AUD",
      totals: {
        subtotal,
        currency: "AUD",
      },
      shippingAddress,
      poNumber: po.poNumber || "",
      notes: po.notes || `Seeded from purchase-orders JSON for ${dealerName} (${run}).`,
      termsAccepted: {
        accepted: false,
        acceptedAt: "",
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      etaDate: "",
      run: run || "",
    };

    const batch = db.batch();
    batch.set(orderRef, orderDoc);

    for (const item of cartItems) {
      const lineRef = orderRef.collection("lines").doc();
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;

      batch.set(lineRef, {
        guitarId: item.guitarId,
        sku: item.sku,
        name: item.name,
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
        selectedOptions: item.selectedOptions || {},
      });
    }

    await batch.commit();
    console.log(
      `✅ Created order ${orderRef.id} for ${dealerName} (${run}) with ${cartItems.length} line(s)`,
    );
  }

  console.log(
    `\n🎉 Seeded ${purchaseOrders.length} order(s). Check /admin/orders in the portal.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error seeding orders:", err);
    process.exit(1);
  });

