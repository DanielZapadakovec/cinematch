/*
 * Thin wrapper around Capacitor plugins. In a browser every call is a no-op
 * (or a web fallback), inside the Android/iOS app it uses the native plugin.
 * Plugins used (installed by package.json): App, Haptics, StatusBar, SplashScreen, Share.
 */
window.Native = (() => {
  const C = window.Capacitor;
  const native = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = (C && C.Plugins) || {};
  const safe = f => { try { const r = f(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
  return {
    native,
    platform: native ? C.getPlatform() : 'web',
    haptic(style = 'LIGHT') { safe(() => P.Haptics ? P.Haptics.impact({ style }) : (navigator.vibrate && navigator.vibrate(style === 'HEAVY' ? 18 : 8))); },
    onBack(fn) { if (P.App) P.App.addListener('backButton', fn); },
    exit() { safe(() => P.App && P.App.exitApp()); },
    statusBar() {
      if (!P.StatusBar) return;
      safe(() => P.StatusBar.setOverlaysWebView({ overlay: false }));
      safe(() => P.StatusBar.setBackgroundColor({ color: '#03071E' }));
      safe(() => P.StatusBar.setStyle({ style: 'DARK' }));
    },
    hideSplash() { safe(() => P.SplashScreen && P.SplashScreen.hide()); },
    async share(text) {
      if (P.Share) return P.Share.share({ title: 'CineMatch', text });
      if (navigator.share) return navigator.share({ title: 'CineMatch', text });
      throw new Error('no share');
    }
  };
})();
