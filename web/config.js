/*
 * CineMatch configuration
 * -----------------------------------------------------------------------
 * Accounts and data live in Supabase (setup steps: SETUP.md in the repo).
 * The TMDB key is NOT stored here: it lives in Supabase as the secret
 * TMDB_READ_TOKEN and the app reaches TMDB through the "tmdb" Edge Function.
 */
window.CINEMATCH_CONFIG = {
  // true  = everything stays on this device with demo friends (no server)
  // false = real accounts in Supabase; falls back to the demo if the server can't be reached
  DEMO_MODE: false,

  // Supabase project (Project Settings → API). The publishable/anon key is meant to be public.
  SUPABASE_URL: 'https://mjauqshyvahdhzleluuj.supabase.co',
  SUPABASE_KEY: 'sb_publishable_Xnmb1ve5R1Og1O87ytIo2Q_GSDcmRz5',

  // Public web version (GitHub Pages). Email confirmation and password links open here.
  WEB_URL: 'https://danielzapadakovec.github.io/cinematch/',

  // TMDB goes through the Supabase Edge Function "tmdb" (supabase/functions/tmdb),
  // which holds the TMDB_READ_TOKEN secret. Until it is deployed the demo catalog is used.
  USE_TMDB: true,
  TMDB_PROXY_URL: '',           // empty = <SUPABASE_URL>/functions/v1/tmdb
  TMDB_READ_TOKEN: '',          // only for running without Supabase; never commit a real token
  TMDB_API_KEY: '',
  TMDB_LANGUAGE: 'en-US',
  TMDB_REGION: 'SK',

  // Google sign-in: the *Web* OAuth client ID from Google Cloud (also used by the Android app)
  GOOGLE_WEB_CLIENT_ID: '971915730200-k02effkthh47vphl468mjke7ap8lqh82.apps.googleusercontent.com'
};
