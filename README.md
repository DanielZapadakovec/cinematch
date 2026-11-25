# CineMatch

Swipe films and series, send picks to friends to keep streaks, earn XP and plan movie nights.
Runs as a web app (PWA) and as an Android app through Capacitor.

## Project layout
| Path | What it is |
|---|---|
| `web/` | The whole app (this folder is what the phone app ships) |
| `web/config.js` | **Your keys**: TMDB, Google client ID, `DEMO_MODE` |
| `web/js/app.js` | App logic: auth, onboarding, swipe deck, XP, friend streaks, plans, profile |
| `web/js/native.js` | Capacitor bridge: back button, haptics, status bar, splash, share |
| `web/js/data.js` | Demo catalog, demo friends, level names |
| `web/js/tmdb.js` | TMDB adapter (used when `DEMO_MODE` is `false`) |
| `web/icons/*.svg` | App icons (24×24, `currentColor`). Replace a file and keep its name |
| `assets/` | Sources for the Android launcher icon and splash screen |
| `android/` | Generated Android Studio project |
| `capacitor.config.json` | App id `sk.cinematch.app`, name, splash and status bar colours |
| `.github/workflows/android-apk.yml` | Builds the APK on GitHub automatically |

Colours and corner radii are CSS variables at the top of `web/index.html`
(`--slate --white --taupe --cerulean --charcoal`, `--r-card --r-box --r-btn --r-chip --r-bar`).

## Run in a browser
```
npm install
npm run serve        # http://localhost:8000
```

## Build the APK

### Option A: GitHub (no Android Studio needed)
1. Push this folder to a GitHub repository (branch `main`).
2. Open **Actions → Android APK**. It runs on every push, or click **Run workflow**.
3. When it finishes, download **cinematch-debug-apk** from the run page, unzip it and install `app-debug.apk` on your phone
   (allow "Install unknown apps" for your browser or file manager).

### Option B: on your computer
Needs Node 20+, JDK 21 and Android Studio (or the Android SDK command-line tools).
```
npm install
npm run apk          # = cap sync + gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```
Or `npm run open` to open the project in Android Studio and press Run with a phone connected.

### After changing the web app
`npx cap sync android` copies `web/` into the Android project. Both build options above already run it.

### After changing the logo
Edit `web/icons/app-icon.svg`, export new PNGs into `assets/` (icon-only, icon-foreground, icon-background, splash),
then `npm run assets`.

### Release build for Google Play
Create a keystore (`keytool -genkey -v -keystore cinematch.keystore -alias cinematch -keyalg RSA -keysize 2048 -validity 10000`),
add a `signingConfigs` block in `android/app/build.gradle`, bump `versionCode`/`versionName`, then `npm run apk:release`
(or build an `.aab` with `./gradlew bundleRelease`).

## Server setup
See **[SETUP.md](SETUP.md)**: database, TMDB Edge Function, signing key and Google sign-in.

## Going live (more)
1. Keys in `web/config.js`, set `DEMO_MODE: false`.
2. Replace `localStorage` in `web/js/app.js` (`save()` / `DB`) with a real backend. Tables:
   `users`, `friendships`, `swipes`, `ratings`, `film_sends (from, to, movie_id, sent_at)`, `events`, `votes`, `xp_log`.
   A friend streak is the run of consecutive days with at least one `film_sends` row in each direction.
3. Google sign-in: on the web the Google Identity Services button works as is. Inside the Android app the web
   button is blocked by Google, so use a native plugin such as `@capgo/capacitor-social-login` and call
   `googleLogin(sub, name, email)` in `app.js` with its result.
4. Keep the TMDB key behind your own proxy (`TMDB_PROXY_URL`). Push notifications for "your streak ends tonight"
   can be added with `@capacitor/push-notifications` + Firebase Cloud Messaging.
