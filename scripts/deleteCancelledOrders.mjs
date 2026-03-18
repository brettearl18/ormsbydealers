/**
 * Delete all CANCELLED orders (and their line items) from Firestore.
 *
 * Usage:
 *   cd dealer-portal
 *   node scripts/deleteCancelledOrders.mjs
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

async function deleteCancelledOrders() {
  console.log("🔍 Finding CANCELLED orders…");

  const snapshot = await db
    .collection("orders")
    .where("status", "==", "CANCELLED")
    .get();

  if (snapshot.empty) {
    console.log("✅ No CANCELLED orders found.");
    return;
  }

  console.log(`Found ${snapshot.size} CANCELLED order(s). Deleting…`);

  for (const docSnap of snapshot.docs) {
    const orderId = docSnap.id;
    console.log(`  • Deleting order ${orderId}`);

    // Delete line items subcollection
    const linesSnap = await db
      .collection("orders")
      .doc(orderId)
      .collection("lines")
      .get();

    const batch = db.batch();

    linesSnap.docs.forEach((lineDoc) => {
      batch.delete(lineDoc.ref);
    });

    batch.delete(docSnap.ref);
    await batch.commit();
  }

  console.log("🧹 Finished deleting CANCELLED orders.");
}

deleteCancelledOrders()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error deleting cancelled orders:", err);
    process.exit(1);
  });

