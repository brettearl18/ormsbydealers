/**
 * Seed Firebase Auth dealer users from dealer-logins-template.json.
 *
 * For each dealer entry:
 * - Creates or finds a Firebase Auth user by email
 * - Sets custom claims: role=DEALER, accountId, tierId, currency
 *
 * Usage:
 *   cd dealer-portal
 *   node scripts/seedDealerUsersFromJson.mjs
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

const auth = admin.auth();

const loginsJsonPath = join(
  __dirname,
  "../dealer-logins-template.json",
);

async function ensureUserWithClaims(entry) {
  const email = entry.login?.email;
  const tempPassword = entry.login?.tempPassword || "TempPass123!";
  const enabled = entry.login?.enabled !== false;

  if (!email || !enabled) {
    console.log("Skipping dealer without email or disabled login:", entry.dealerName);
    return;
  }

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log("  • Found existing user for", email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      user = await auth.createUser({
        email,
        emailVerified: false,
        password: tempPassword,
        disabled: false,
      });
      console.log("  • Created new user for", email);
    } else {
      throw err;
    }
  }

  const claims = {
    role: "DEALER",
    accountId: entry.accountId,
    tierId: entry.tierId || "TIER_A",
    currency: entry.currency || "AUD",
  };

  await auth.setCustomUserClaims(user.uid, claims);
  console.log("    Set claims for", email, "→", claims);
}

async function seed() {
  console.log("🌱 Seeding dealer users from dealer-logins-template.json\n");

  const raw = readFileSync(loginsJsonPath, "utf8");
  const data = JSON.parse(raw);
  const dealers = data.dealers || [];

  if (!Array.isArray(dealers) || dealers.length === 0) {
    console.error("❌ No dealers array found in dealer-logins-template.json.");
    process.exit(1);
  }

  for (const entry of dealers) {
    try {
      await ensureUserWithClaims(entry);
    } catch (err) {
      console.error("❌ Error processing dealer", entry.dealerName, ":", err.message || err);
    }
  }

  console.log("\n🎉 Dealer user seeding complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error in seeding dealer users:", err);
    process.exit(1);
  });

