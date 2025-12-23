#!/usr/bin/env node

/**
 * Script to create an admin user in Firebase Auth and set custom claims
 * Usage: node scripts/createAdminUser.mjs <email> <password>
 */

import admin from "firebase-admin";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get email and password from command line arguments
const email = process.argv[2] || "guitars@ormsbyguitars.com";
const password = process.argv[3] || "Ormsby123!@#";

// Initialize Firebase Admin SDK
const serviceAccountPath = join(__dirname, "..", "..", "ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json");

try {
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, "utf8"));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  console.log(`Creating admin user: ${email}...`);

  // Check if user already exists
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    console.log(`User ${email} already exists. Updating password and claims...`);
    
    // Update password
    await admin.auth().updateUser(user.uid, {
      password: password,
    });
    console.log("✓ Password updated");
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      // User doesn't exist, create it
      user = await admin.auth().createUser({
        email: email,
        password: password,
        emailVerified: true,
      });
      console.log(`✓ User created: ${user.uid}`);
    } else {
      throw error;
    }
  }

  // Set custom claims for admin
  await admin.auth().setCustomUserClaims(user.uid, {
    role: "ADMIN",
    // Admin users don't need accountId or tierId since they have full access
    // But we can set them if needed for consistency
  });

  console.log("✓ Custom claims set:");
  console.log("  - role: ADMIN");
  console.log(`\n✓ Admin user setup complete!`);
  console.log(`\nEmail: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`\nYou can now log in to the admin portal.`);

  process.exit(0);
} catch (error) {
  console.error("Error:", error.message);
  if (error.code) {
    console.error("Error code:", error.code);
  }
  process.exit(1);
}


