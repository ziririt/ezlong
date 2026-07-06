# ezlong time mobile app

This folder contains the iOS/Android app shell for `ezlong.com/time`.

The app bundles the flip clock/weather/quote experience locally through Capacitor, then keeps the lower ezlong.com section as the live service surface. This avoids shipping a bare remote WebView while preserving the same product experience as the web route.

## Build flow

```bash
cd mobile/time-app
npm install
npm run cap:sync
npm run cap:open:ios
npm run cap:open:android
```

## Review value checklist

- Local first-screen clock/weather/quote experience, not a blank remote WebView.
- Native haptics on scene and settings interactions.
- Native local notification opt-in for a daily investment mindset quote.
- Native device/platform detection for app-only polish.
- Offline-capable bundled quote/background seed data.
- Live `ezlong.com` access remains available below the main clock.

## Release notes

For App Store and Play Store review, describe the app as a calming weather clock and long-term-investing mindset companion. Do not describe it as a wrapper for ezlong.com.
