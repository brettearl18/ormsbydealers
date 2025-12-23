# Firebase Hosting Deployment Guide

Since this Next.js app uses dynamic routes, we need to deploy it using Firebase Hosting with Cloud Run or use a different approach.

## Recommended: Deploy to Vercel

The easiest way to deploy this Next.js app is using Vercel, which is optimized for Next.js:

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "New Project" and import your GitHub repository (`ormsbydealers`)
3. Vercel will automatically detect Next.js and configure it
4. Add your environment variables (Firebase config)
5. Deploy!

## Alternative: Firebase Hosting with Cloud Run

If you must use Firebase Hosting, you'll need to:

1. Build Next.js as a standalone app
2. Create a Docker container
3. Deploy to Cloud Run
4. Configure Firebase Hosting to proxy to Cloud Run

This is more complex. Let me know if you want to proceed with this approach.

## Current Build Status

The app is configured for static export, but dynamic routes prevent this from working. To make Firebase Hosting work, we would need to either:

1. Remove dynamic routes (not feasible)
2. Use Cloud Run/Cloud Functions (complex setup)
3. Use Vercel (recommended, easiest)

