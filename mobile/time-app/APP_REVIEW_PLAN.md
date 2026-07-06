# App review plan

## Capacitor scaffold status (2026-07-06, Claude Cowork)

- `package.json`, `capacitor.config.ts` (`appId: com.ezlong.time`, `appName: ezlong time`) added.
- `scripts/sync-web.mjs` copies `index.html` / `app.js` / `styles.css` / `investment-quotes.js` +
  both manifests + the small `assets/backgrounds/` set (~7MB, 48 files) into `www/`. It deliberately
  excludes the growing `assets/background-archive/` (~40MB+) — that stays Firebase-Storage-only and
  is fetched over the network at runtime via `publicUrl`, so the app bundle doesn't bloat with every
  new archive photo.
- `npm install`, `npx cap add android`, `npx cap add ios`, and `npx cap sync` were all run and verified
  in this session. Both native projects build their package/bundle identity from
  `capacitor.config.ts` correctly (`com.ezlong.time`, "ezlong time") — confirmed in
  `android/app/build.gradle` (`namespace`/`applicationId`), `android/app/src/main/res/values/strings.xml`,
  `ios/App/App.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`), and `ios/App/App/Info.plist`
  (`CFBundleDisplayName`).
- Known sandbox quirk (not an app bug): `npx cap add android`'s file-rename step hit an `EPERM` when
  deleting the default `com.getcapacitor.myapp` template stub files in this session's mounted folder.
  Fixed by hand — all Java sources now live under `com/ezlong/time/` with matching `package` statements,
  and the stray `com/getcapacitor/` folders were removed. If you re-run `npx cap add android` fresh on
  your own Mac, this shouldn't happen (it's specific to the sandbox mount, not Capacitor itself).
- `index.html`'s viewport meta now includes `viewport-fit=cover` (it didn't before) — required for
  `env(safe-area-inset-*)` in `styles.css` to actually populate inside the native WebView, matching the
  existing web safe-area handling described in section 3 of the handover.
- **Not done in this session** (needs your Mac + Xcode/Android Studio, which this sandbox doesn't have):
  actually opening/building the projects (`npm run cap:open:ios` / `cap:open:android`), replacing
  placeholder app icons/splash images, wiring the native haptics/local-notification/share calls into
  `app.js` (the plugins are installed and synced, but no JS in `app.js` calls them yet), and any
  Apple Team / Play signing setup.


## Product positioning

`ezlong time` is a calming weather clock for long-term investors. The first screen is a native-packaged, offline-capable flip clock with local weather, seasonal background imagery, and rotating investment mindset quotes. The ezlong.com web section is secondary and appears below the main app experience.

## Native app value

- Bundled clock, weather, quote, and background experience starts without waiting for a remote web page.
- Local notification opt-in gives users a daily investment mindset reminder.
- Haptics make scene changes, settings, and app-only actions feel native.
- Device/platform detection allows app-only safe-area and system chrome tuning.
- Offline seed data keeps the core experience useful when the network is weak.
- Share action uses the device share sheet.

## Reviewer notes

- The app is not a trading, brokerage, or investment-advice app.
- The app does not ask users to buy or sell securities.
- All investment text is educational and mindset-oriented.
- Weather is used to set the emotional background of the clock.
- The website area links to free ezlong.com tools, but the app's primary value is the clock/weather/quote experience.

## Store metadata draft

Name: ezlong time

Subtitle: Weather clock for long investors

Short description: A calming flip clock with weather, seasonal backgrounds, and long-term investing mindset quotes.

Keywords: investing, weather clock, flip clock, long term, mindset, finance, quote, ezlong

## Update strategy

- The bundled app shell is versioned through App Store and Play Store releases.
- Quote/background manifests can update through normal web/Firebase content publishing.
- A future remote config file should expose `minimumSupportedAppVersion`, `recommendedAppVersion`, and `releaseMessage`.
- Native permission prompts must stay user initiated.
- New quote/photo content should keep source metadata and rights notes.

## Pre-submission checklist

- Confirm location permission copy is clear and weather-only.
- Confirm notification prompt is shown only after user taps the app notification control.
- Replace placeholder app icons and splash assets.
- Build iOS archive in Xcode with a real Apple Team.
- Build Android release bundle with a Play signing key.
- Test first screen offline after first install.
- Test `ezlong.com/time/` web route separately before each app release.
