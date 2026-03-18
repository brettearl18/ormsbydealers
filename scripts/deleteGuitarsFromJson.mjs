/**
 * Delete guitars (and their availability/pricing) that were seeded
 * from guitar-run-template.json.
 *
 * Usage:
 *   cd dealer-portal
 *   node scripts/deleteGuitarsFromJson.mjs
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

const guitarsJsonPath = join(
  __dirname,
  "../guitar-run-template.json",
);

function slugFromSku(sku) {
  return String(sku)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "guitar";
}

async function run() {
  console.log("🗑  Deleting seeded guitars from guitar-run-template.json…\n");

  const raw = readFileSync(guitarsJsonPath, "utf8");
  const data = JSON.parse(raw);
  const guitars = data.guitars || [];

  if (!Array.isArray(guitars) || guitars.length === 0) {
    console.error("❌ No guitars array found in guitar-run-template.json.");
    process.exit(1);
  }

  for (const g of guitars) {
    const id = slugFromSku(g.sku);
    console.log(`  • Deleting guitar ${g.sku} (id: ${id})`);

    const guitarRef = db.collection("guitars").doc(id);
    const availRef = db.collection("availability").doc(id);
    const pricesRef = db.collection("prices").doc(id);

    await Promise.allSettled([
      guitarRef.delete(),
      availRef.delete(),
      pricesRef.delete(),
    ]);
  }

  console.log("\n✅ Finished deleting seeded guitars. Any manually created guitars were left untouched.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error deleting seeded guitars:", err);
    process.exit(1);
  });

