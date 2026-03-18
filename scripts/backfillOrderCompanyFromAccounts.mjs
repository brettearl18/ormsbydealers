/**
 * Backfill shippingAddress.company on existing orders using the related account name.
 *
 * Usage:
 *   cd dealer-portal
 *   node scripts/backfillOrderCompanyFromAccounts.mjs
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(
  __dirname,
  "../../ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json",
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backfill() {
  console.log("🔍 Backfilling shippingAddress.company from accounts…");

  const snap = await db.collection("orders").get();
  if (snap.empty) {
    console.log("No orders found.");
    return;
  }

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const shipping = data.shippingAddress || {};
    const hasCompany = shipping.company && String(shipping.company).trim().length > 0;
    if (hasCompany) continue;

    const accountId = data.accountId;
    if (!accountId) continue;

    const accountSnap = await db.collection("accounts").doc(accountId).get();
    if (!accountSnap.exists) continue;

    const account = accountSnap.data() || {};
    const accountName = account.name;
    if (!accountName) continue;

    const newShipping = {
      company: accountName,
      line1: shipping.line1 || "",
      line2: shipping.line2 || "",
      city: shipping.city || "",
      region: shipping.region || "",
      postalCode: shipping.postalCode || "",
      country: shipping.country || "",
    };

    await docSnap.ref.update({
      shippingAddress: newShipping,
      updatedAt: new Date().toISOString(),
    });
    console.log("  • Updated", docSnap.id, "→ company:", accountName);
  }

  console.log("✅ Backfill complete.");
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error in backfill:", err);
    process.exit(1);
  });

