# LifeApp (LifeOS)

> A privacy-first personal life tracker. Habits, schedule, fitness, learning, skills, journal, finance, analytics, alarms — all on-device. No accounts. No cloud. Your data stays on your phone.

Open the app and see today: a single-glance Dashboard, zero-friction tap-first logging, and a full JSON export that is your backup. Everything is stored locally in AsyncStorage — no backend, no login, no subscription. Built first as a daily-use tool for one person; the source is generic enough to fork.

**Cross-platform.** Android and iOS are both first-class — every release builds for both. This is a personal tool, not a product: no App Store / Play Store listing, no support promise. Android installs by sideloading the APK from GitHub Releases; web is best-effort.

**Stack:** Expo ~54 · React Native 0.81 · React 19 · Expo Router (file-based tabs) · AsyncStorage · react-native-svg · expo-notifications · expo-updates (EAS Update OTA).

**Status:** v1.1.0 shipped (~70% built). Maintained by Kevin. Next: v1.2 — daily-friction fixes + auto-backup (iCloud on iOS, Android Auto Backup already wired via `plugins/withAndroidAutoBackup.js`).

## Development

Works on Windows, macOS and Linux. Native iOS builds still need macOS + Xcode; from Windows, build iOS in the cloud with EAS.

```bash
npm install
npm run doctor         # check JDK / Android SDK / adb / device / LAN IP
npm run dev            # Metro, bound to this machine's LAN IP

npm run android        # build + install on a connected Android device or emulator
npm run ios            # same for iOS (macOS only)

npm run android:release   # standalone build, no Metro needed
npm run prebuild          # regenerate android/ and ios/ from app.json
```

Cloud builds for both platforms at once (needs `npm i -g eas-cli` and `eas login`):

```bash
npm run build:preview      # internal APK + iOS build
npm run build:production
npm run update             # OTA JS-only update to the production channel
```

Optional `.env` at the repo root:

```
ANDROID_DEVICE=<adb serial>   # only if several Android devices are attached
DEVICE_UDID=<ios udid>        # only if several iOS devices are attached
```

**Docs:** The full build/ship/OTA flow is in [RELEASE.md](./RELEASE.md); machine-readable contracts in [contracts/](./contracts). Full plan & spec: kept in the portfolio `planning/` workspace (not in this public repo).

## License

MIT — use it, fork it, make it yours.
