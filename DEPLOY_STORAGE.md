# Deploy Firebase Storage Rules

To fix the CORS errors and enable image uploads, you need to deploy the Firebase Storage rules.

## Quick Fix

1. **Login to Firebase** (if not already):
   ```bash
   firebase login
   ```

2. **Set your Firebase project**:
   ```bash
   firebase use --add
   ```
   Then select `ormsbydistribute` from the list.

3. **Deploy Storage Rules**:
   ```bash
   firebase deploy --only storage:rules
   ```

## Alternative: Deploy Everything

```bash
firebase deploy
```

This will deploy:
- Firestore rules
- Firestore indexes
- Storage rules
- Cloud Functions (if any)
- Hosting (if configured)

## Verify Storage is Enabled

1. Go to [Firebase Console](https://console.firebase.google.com/project/ormsbydistribute/storage)
2. Make sure Storage is enabled
3. Check that the bucket exists: `ormsbydistribute.firebasestorage.app`

## After Deployment

Once rules are deployed, the CORS errors should disappear and image uploads will work.


