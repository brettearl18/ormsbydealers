# Ormsby Guitars Dealer Portal

A modern, low-cost B2B distributor/dealer portal built with Next.js, TypeScript, Tailwind CSS, and Firebase.

## Features

- **Authentication**: Firebase Auth with role-based access (ADMIN, DISTRIBUTOR, DEALER)
- **Guitar Catalog**: Browse available guitars with filters, search, and detailed product pages
- **Tiered Pricing**: Automatic price resolution based on account tier, with promo and override support
- **Shopping Cart**: Persistent cart with quantity management
- **Order Management**: Submit purchase orders with shipping details, PO numbers, and notes
- **Order Tracking**: View order history and status updates
- **Admin Panel**: (Coming soon) Manage guitars, pricing, accounts, and orders

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions)
- **Deployment**: Firebase Hosting + Functions

## Prerequisites

- Node.js 18+ and npm
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with:
  - Authentication enabled (Email/Password)
  - Firestore database created
  - Storage bucket created
  - Cloud Functions enabled

## Setup

### 1. Clone and Install

```bash
cd dealer-portal
npm install
```

### 2. Configure Firebase

1. Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

2. Fill in your Firebase project configuration values (from Firebase Console → Project Settings → General → Your apps → Web app).

### 3. Initialize Firebase (if not already done)

```bash
firebase login
firebase use --add  # Select your Firebase project
```

### 4. Deploy Firestore Rules and Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Set Up a Test Dealer Account

1. Create a user in Firebase Console → Authentication → Users
2. Run the script to set custom claims:

```bash
node scripts/setDealerClaims.mjs dealer@example.com
```

This sets:
- `role: "DEALER"`
- `accountId: "acct_demo_ormsby"`
- `tierId: "TIER_A"`
- `currency: "USD"`

3. Seed Firestore with demo data:

```bash
node scripts/seedFirestore.mjs
```

This creates:
- A tier (`TIER_A`)
- An account (`acct_demo_ormsby`)
- A demo guitar with availability and pricing

### 6. Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 7. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your test dealer account.

## Project Structure

```
dealer-portal/
├── app/                    # Next.js App Router pages
│   ├── cart/               # Shopping cart page
│   ├── checkout/           # Checkout form
│   ├── dealer/            # Dealer dashboard (guitar listing)
│   │   └── guitars/        # Guitar detail pages
│   ├── login/              # Login page
│   ├── orders/             # Orders list and detail pages
│   └── page.tsx            # Landing page
├── components/              # React components
│   └── guitars/           # Guitar-related components
├── functions/              # Firebase Cloud Functions
│   └── src/
│       └── index.ts        # submitOrder function
├── lib/                    # Shared utilities
│   ├── auth-context.tsx   # Auth provider
│   ├── cart-context.tsx   # Cart provider
│   ├── dealer-guitars.ts  # Firestore queries
│   ├── firebase.ts        # Firebase initialization
│   ├── pricing.ts          # Pricing resolution logic
│   └── types.ts           # TypeScript types
├── scripts/                # Utility scripts
│   ├── seedFirestore.mjs  # Seed demo data
│   └── setDealerClaims.mjs # Set user custom claims
├── firestore.rules         # Firestore security rules
└── firestore.indexes.json  # Firestore indexes
```

## Data Model

### Collections

- **users/{uid}**: User profiles with role and accountId
- **accounts/{accountId}**: Dealer/distributor accounts with tier and currency
- **tiers/{tierId}**: Pricing tiers
- **guitars/{guitarId}**: Guitar catalog
- **availability/{guitarId}**: Stock availability per guitar
- **prices/{guitarId}**: Pricing configuration (base, tier, overrides, promo)
- **orders/{orderId}**: Purchase orders
- **orders/{orderId}/lines/{lineId}**: Order line items

## Pricing Resolution

Pricing is resolved in this priority order:
1. **Promo price** (if valid date range)
2. **Account override** (account-specific price)
3. **Tier price** (based on account's tier)
4. **Base price** (fallback)

## Security

- Firestore security rules enforce:
  - Dealers can only read their own orders
  - Dealers can only read ACTIVE guitars
  - Admins have full access
- Order submission is handled by a trusted Cloud Function that validates user permissions and locks in pricing.

## Deployment

### Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Deploy Everything

```bash
firebase deploy
```

## Development

- **Local dev**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`

## Cost Optimization

- Firestore queries use pagination and limits
- Cloud Functions only used for trusted operations (order submission)
- Client-side pricing computation (with server validation)
- Minimal serverless usage to keep costs low

## License

Private - Ormsby Guitars

