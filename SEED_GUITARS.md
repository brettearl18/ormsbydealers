# Seeding Guitars (Model + Variants)

## Structure

- **One Firestore document = one Model** (e.g. "Hype (Run 20)", "Genesis (Run 19)").
- **Colour** and **Strings** are **variants** stored as `options` on that document, not as separate documents.
- Dealers see one product per model and choose colour + strings; the effective SKU is built from the base SKU plus option suffixes.

So the admin "Manage Guitars" list shows **models**; each model’s colour and string variants are configured in **Edit → Product Options**.

## Seed the 9 models from JSON

From the `dealer-portal` directory:

```bash
node scripts/seedGuitarsFromJson.mjs
```

**Requirements:**

- Firebase Admin key at project root: `ormsbydistribute-firebase-adminsdk-fbsvc-21a40c5ae7.json`  
  **or** set `GOOGLE_APPLICATION_CREDENTIALS` to the key path.

**Result:**

- Creates/updates 9 guitar documents in the `guitars` collection (IDs from SKU, e.g. `r19-genesis`, `r20-hype`, `tx-shark`).
- Each document is one **model** with **Colour** and **Strings** options (variants).
- After seeding, refresh **Admin → Manage Guitars** to see the 9 model cards.

If you had previously added variant-level documents (one doc per colour/string combo), delete those cards in the admin UI so only the model-level guitars remain.

## Optional: custom JSON path

```bash
SEED_JSON_PATH=./path/to/your-guitars.json node scripts/seedGuitarsFromJson.mjs
```
