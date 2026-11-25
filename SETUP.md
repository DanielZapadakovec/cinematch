# CineMatch – server setup (Supabase, TMDB, Google, signing)

The app is already pointed at the Supabase project `mjauqshyvahdhzleluuj` (see `web/config.js`).
Do these steps once, in this order.

## 1. Database (2 min)
1. Supabase → **SQL Editor** → **New query**.
2. Paste everything from [`supabase/migrations/0001_cinematch.sql`](supabase/migrations/0001_cinematch.sql) → **Run**.
   It should finish with “Success. No rows returned”.

## 2. Sign-in settings (1 min)
Supabase → **Authentication**:
* **Sign In / Providers → Email**: for testing you can turn **Confirm email** off, so new accounts can sign in at once.
  Leave it on later for real users (they get a confirmation link).
* **URL Configuration → Redirect URLs**: add `https://localhost/*` (Android app) and the address where you host the web version, if any.

## 3. TMDB through an Edge Function (3 min)
1. Supabase → **Edge Functions → Secrets** → add `TMDB_READ_TOKEN` = your TMDB *API Read Access Token* (the long one).
2. **Edge Functions → Deploy a new function → Via editor**, name it exactly `tmdb`,
   paste [`supabase/functions/tmdb/index.ts`](supabase/functions/tmdb/index.ts) → **Deploy**.
3. Open the function → **Details / Settings** → turn **Verify JWT** (Enforce JWT verification) **off** → Save.
   (The function only reads public movie data; your key never leaves Supabase.)

The app switches from the demo catalog to live TMDB on its own once the function answers.

## 4. Signing key for the Android app (2 min)
GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**, add two secrets
with the values from `cinematch-signing-secrets.txt` (sent to you privately, never commit it):
* `ANDROID_KEYSTORE_BASE64`
* `ANDROID_KEYSTORE_PASSWORD`

From then on every APK is signed with the same key: updates install over the old app and Google sign-in works.
Uninstall any CineMatch APK you installed before this step once (it had a throwaway key).
Keep `cinematch.keystore` safe: Google Play needs the same key for every update.

## 5. Google sign-in (10 min)
In [Google Cloud Console](https://console.cloud.google.com/):
1. Create a project (e.g. “CineMatch”).
2. **APIs & Services → OAuth consent screen** (Google Auth Platform): External, app name *CineMatch*, your email.
   While in *Testing*, add your Google accounts under **Audience → Test users**.
3. **Clients → Create client → Web application**
   * Authorized redirect URI: `https://mjauqshyvahdhzleluuj.supabase.co/auth/v1/callback`
   * Copy the **Client ID** and **Client secret**.
4. **Clients → Create client → Android**
   * Package name: `sk.cinematch.app`
   * SHA-1: `4E:67:89:E2:C3:5D:D1:2A:FE:C8:9E:74:CC:2E:36:68:9D:D8:11:21`
5. Supabase → **Authentication → Sign In / Providers → Google**: enable, paste the **Web** Client ID and Client secret → Save.
6. Put the **Web** Client ID into `web/config.js` → `GOOGLE_WEB_CLIENT_ID` (it is public), push, and the next APK has Google sign-in.

## How the app behaves
* Server reachable → real accounts, friends by ID (CM-1234), films sent between friends, live updates.
* Server unreachable (offline, or the claude.ai preview) → the offline demo with demo friends.
