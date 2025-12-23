# Deploy to Vercel

## Quick Deploy Steps

1. **Go to [vercel.com](https://vercel.com)** and sign up/login with your GitHub account

2. **Click "New Project"** and import your repository:
   - Repository: `brettearl18/ormsbydealers`
   - Framework: Vercel will auto-detect Next.js

3. **Configure Environment Variables**:
   Add these in the Vercel project settings (Settings → Environment Variables):
   
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCs1g1ZA7i9bWxKRdRjLUKXM6aJDhP7v_w
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ormsbydistribute.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=ormsbydistribute
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ormsbydistribute.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=689935135020
   NEXT_PUBLIC_FIREBASE_APP_ID=1:689935135020:web:989718ad3ef1bb632bbc89
   ```

4. **Deploy!** Click "Deploy" and Vercel will:
   - Build your Next.js app
   - Deploy it to a production URL
   - Set up automatic deployments on every git push

## After Deployment

- Your app will be live at: `https://your-project-name.vercel.app`
- Every push to `main` branch will trigger a new deployment
- You can add a custom domain in Vercel settings

## Build Configuration

The `vercel.json` file is optional - Vercel auto-detects Next.js projects. It's included for reference.

## Local Testing

Test the production build locally:
```bash
npm run build
npm start
```

