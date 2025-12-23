import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

// Load service account
const serviceAccountPath = join(
  __dirname,
  "../../ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json"
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];

if (!uid) {
  console.error("Usage: node setAdminClaims.mjs <uid>");
  console.error("Example: node setAdminClaims.mjs TiVwWCAJoLZxiGCG5fqVH19ZpPC2");
  process.exit(1);
}

async function setAdminClaims() {
  try {
    // Get user by UID
    const userRecord = await admin.auth().getUser(uid);
    console.log(`Found user: ${userRecord.email} (${userRecord.uid})`);

    // Set admin claims
    const claims = {
      role: "ADMIN",
    };

    await admin.auth().setCustomUserClaims(uid, claims);
    console.log(`✅ Successfully set ADMIN role for ${userRecord.email}`);
    console.log("\n⚠️  Note: User may need to sign out and sign back in for changes to take effect.");
  } catch (error) {
    console.error("Error setting admin claims:", error);
    process.exit(1);
  }
}

setAdminClaims();


