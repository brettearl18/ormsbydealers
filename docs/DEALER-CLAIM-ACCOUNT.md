# Dealer account claim (easy setup)

## What dealers do

1. Ormsby creates their Auth user and sends the **setup link** — either via the welcome email from `createDealerAuthUser` (if Mailgun/SMTP is configured), or by using **Copy email link** on Admin → Accounts to paste the link into your own email.
2. The email contains a **single setup link** (Firebase password reset) — the temporary password is **not** in the email (it is a fixed internal default: `OrmsbyDealer2026` — support can give this only if the link fails; dealers should use the link first).
3. The link opens **`/claim-account`** on the portal (after Firebase validates the action, when configured — see below).
4. They enter a **new password** twice → they are **signed in** and sent to the dashboard.

## What Ormsby does

- **Preferred:** Admin → Accounts → create dealer auth user with email, then either automated welcome email (Mailgun/SMTP in Settings) or **Copy email link** and paste into your own message to the dealer.
- **Bulk script:** `npm run provision:dealers -- --apply` sets the same initial password as Cloud Functions (`OrmsbyDealer2026`, overridable with env `DEALER_INITIAL_PASSWORD`). Then use **Copy email link** per account (or your existing automated welcome email if configured) so each dealer gets a setup link.

## Custom welcome copy

Admin → Settings → Email templates → **Welcome / dealer setup body**

Placeholders:

- `{{claimLink}}` — one-click password setup (required for the easy flow)
- `{{loginUrl}}` — normal sign-in page after setup
- `{{email}}` — dealer email  
- `{{password}}` — legacy; replaced with a short note if still in your template

## Firebase Console (recommended)

For the smoothest experience, point password-reset handling at your site:

1. Firebase Console → **Authentication** → **Templates** → **Password reset**.
2. Set the **action URL** (or custom domain / continue URL, per your Firebase project UI) to your production claim page, e.g.  
   `https://ormsbydealers.vercel.app/claim-account`
3. Under **Authentication** → **Settings** → **Authorized domains**, ensure your Vercel domain (and `localhost` for dev) are listed.

If the email link still opens Firebase’s default page first, dealers can still complete reset there; they may land on your **continue URL** afterward. The in-app **`/claim-account`** page is used when the link passes an `oobCode` query (typical when the action URL targets your app).

## Troubleshooting: “Domain not allowlisted by project”

Setup links use Firebase `generatePasswordResetLink` with continue URL  
`https://<your-portal-host>/claim-account`. That **host** must be in **Firebase Console → Authentication → Settings → Authorized domains**.

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Settings** → **Authorized domains**.
2. Click **Add domain** and add exactly the host you use in the browser (e.g. `ormsbydealers.vercel.app`).  
   Do **not** include `https://` or a path.
3. Wait a minute and try **Copy email link** again.

Default portal URL in Cloud Functions is `https://ormsbydealers.vercel.app`. To point links at another domain without changing code:

`firebase functions:config:set portal.base_url="https://your-approved-domain.com"`  
then redeploy functions.

## Related

- **Forgot password** (login page) uses the same reset flow and continues to `/claim-account`.
- Legacy users with **`mustChangePassword: true`** still use **`/update-password`** after signing in with an old temporary password.
