import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account from parent directory
const serviceAccountPath = join(__dirname, "../../ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seed() {
  console.log("🌱 Seeding Firestore with demo data...\n");

  // 1. Create tier
  await db.collection("tiers").doc("TIER_A").set({
    name: "Tier A",
    description: "Top tier wholesale pricing",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✅ Created tier: TIER_A");

  // 2. Create account
  await db.collection("accounts").doc("acct_demo_ormsby").set({
    name: "Demo Ormsby Dealer",
    tierId: "TIER_A",
    currency: "USD",
    territory: "US",
    terms: "Net 30",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✅ Created account: acct_demo_ormsby");

  // 3. Create demo guitar
  const guitarId = "gtr_demo_hype";
  await db.collection("guitars").doc(guitarId).set({
    sku: "HYPE-6-DEMO",
    name: "Hype 6 Demo",
    series: "HYPE",
    images: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&q=80",
    ],
    specs: {
      scaleLength: '25.5"',
      frets: 24,
      stringCount: 6,
      pickups: "Humbucker / Humbucker",
      hardware: "Black",
      finish: "Satin Black",
    },
    status: "ACTIVE",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✅ Created guitar: gtr_demo_hype");

  // 4. Create availability
  await db.collection("availability").doc(guitarId).set({
    state: "IN_STOCK",
    qtyAvailable: 5,
    qtyAllocated: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✅ Created availability for: gtr_demo_hype");

  // 5. Create pricing
  await db.collection("prices").doc(guitarId).set({
    guitarId: guitarId,
    currency: "USD",
    basePrice: 1500,
    tierPrices: {
      TIER_A: 1200,
    },
    accountOverrides: {},
    promo: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✅ Created pricing for: gtr_demo_hype");

  console.log("\n🎉 Seed complete! Now:");
  console.log("1. Run: node scripts/setDealerClaims.mjs dealer@test.com");
  console.log("2. Log out and log back in to refresh your token");
  console.log("3. Visit /dealer to see your demo guitar!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });

