/**
 * Seed the guitars collection from guitar-run-template.json.
 * Document ID for each guitar is derived from sku (lowercase, spaces → hyphens).
 *
 * Usage: node scripts/seedGuitarsFromJson.mjs
 * Optional: SEED_JSON_PATH=./path/to/json node scripts/seedGuitarsFromJson.mjs
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  join(__dirname, "../../ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json");
const seedJsonPath =
  process.env.SEED_JSON_PATH ||
  join(__dirname, "../guitar-run-template.json");

if (!existsSync(serviceAccountPath)) {
  console.error("❌ Service account not found at:", serviceAccountPath);
  console.error("   Set GOOGLE_APPLICATION_CREDENTIALS or place the key file in the project root.");
  process.exit(1);
}

if (!existsSync(seedJsonPath)) {
  console.error("❌ Seed JSON not found at:", seedJsonPath);
  console.error("   Set SEED_JSON_PATH or use dealer-portal/guitar-run-template.json");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

/** Derive a stable Firestore document ID from sku (e.g. R19-GENESIS → r19-genesis). */
function slugFromSku(sku) {
  return String(sku)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "guitar";
}

async function seed() {
  const raw = readFileSync(seedJsonPath, "utf8");
  const data = JSON.parse(raw);
  const guitars = data.guitars;
  if (!Array.isArray(guitars) || guitars.length === 0) {
    console.error("❌ No 'guitars' array in JSON or array is empty.");
    process.exit(1);
  }

  console.log("🌱 Seeding guitars from", seedJsonPath, "\n");

  for (const guitar of guitars) {
    const id = slugFromSku(guitar.sku);
    const docRef = db.collection("guitars").doc(id);

    const payload = {
      sku: guitar.sku ?? "",
      name: guitar.name ?? "",
      series: guitar.series ?? "",
      run: guitar.run ?? undefined,
      etaDelivery: guitar.etaDelivery ?? undefined,
      images: Array.isArray(guitar.images) ? guitar.images : [],
      specs: guitar.specs && typeof guitar.specs === "object" ? guitar.specs : {},
      options: Array.isArray(guitar.options) ? guitar.options : undefined,
      status: guitar.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      createdAt: guitar.createdAt ?? new Date().toISOString(),
      updatedAt: guitar.updatedAt ?? new Date().toISOString(),
    };

    await docRef.set(payload, { merge: false });
    console.log("  ✅", guitar.sku, "→", id);
  }

  console.log("\n🎉 Seeded", guitars.length, "guitar(s).");
  console.log("   Add availability and prices per guitar in the admin panel (or via separate seed).");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
