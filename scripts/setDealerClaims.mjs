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

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/setDealerClaims.mjs dealer@example.com");
    process.exit(1);
  }

  const userRecord = await admin.auth().getUserByEmail(email);

  const claims = {
    role: "DEALER",
    accountId: "acct_demo_ormsby",
    tierId: "TIER_A",
    currency: "USD",
  };

  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  console.log("Updated custom claims for", email, "→", claims);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);


