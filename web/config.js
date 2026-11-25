/*
 * CineMatch configuration
 * -----------------------------------------------------------------------
 * Fill in the keys below when you deploy the app on your own domain.
 * While DEMO_MODE is true the app ignores every key and uses the built-in
 * demo catalog + demo accounts, so nothing here is required for testing.
 *
 * TMDB
 *   1. Create a free account at https://www.themoviedb.org/
 *   2. Settings → API → copy the "API Read Access Token" (v4, long JWT)
 *      into TMDB_READ_TOKEN  (preferred)
 *      or the short "API Key" (v3) into TMDB_API_KEY.
 *   3. Set DEMO_MODE to false.
 *   Note: a key in front-end code is visible to anyone. For production,
 *   call TMDB from your own backend / serverless function and point
 *   TMDB_PROXY_URL at it instead (the app then sends no key at all).
 *
 * GOOGLE SIGN-IN
 *   1. Google Cloud Console → APIs & Services → Credentials →
 *      Create OAuth client ID → "Web application".
 *   2. Add your site origin (e.g. https://cinematch.app) to
 *      "Authorized JavaScript origins".
 *   3. Paste the client ID into GOOGLE_CLIENT_ID.
 *   The app decodes the returned ID token only to show the name/email.
 *   Your backend must verify the token before trusting it.
 */
window.CINEMATCH_CONFIG = {
  DEMO_MODE: true,

  TMDB_READ_TOKEN: '',          // v4 "API Read Access Token"
  TMDB_API_KEY: '',             // v3 "API Key" (used only if no read token)
  TMDB_PROXY_URL: '',           // optional: your backend proxy, e.g. https://api.yoursite.com/tmdb
  TMDB_LANGUAGE: 'en-US',
  TMDB_REGION: 'SK',

  GOOGLE_CLIENT_ID: '',         // xxxxxxxx.apps.googleusercontent.com

  DAILY_GOAL: 10                // swipes per day to keep a streak
};
