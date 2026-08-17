# LifeOS — Release Guide

Free, end-to-end flow for shipping LifeOS to phones with auto-updates.

- **EAS Update** pushes JS/asset changes over-the-air. No reinstall.
- **GitHub Releases** distributes the signed APK for first-time downloads and native rebuilds.

Do every step in order. Do **PART 1** before **PART 2** — the APK has to bake in the EAS Update URL.

---

## Prerequisites

Run `npm run doctor` — it checks all of these and tells you what's missing.

- Node + npm
- JDK 17
- Android SDK (`adb`, `keytool` on PATH)
- `gh` CLI (GitHub), for publishing releases
- macOS + Xcode **only** for local iOS builds

### Windows (current dev machine)

Android builds run natively. `ANDROID_HOME` is `C:\Android\Sdk`; set it once in
System Environment Variables and add `%ANDROID_HOME%\platform-tools` to PATH.

**iOS cannot be built locally on Windows.** Use EAS cloud builds instead — they build
both platforms in one command:

```bash
npm run build:preview        # eas build --platform all --profile preview
npm run build:production
```

An Apple Developer account ($99/yr) is required for iOS builds, including via EAS.
Android needs no paid account.

### macOS

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH
```

---

## PART 1 — Set up EAS Update (one-time)

### 1.1 Free Expo account
Sign up: https://expo.dev/signup — no card needed.

### 1.2 Log in from CLI
```bash
npx eas-cli@latest login
```
Interactive — paste email + password. (You can also `npm install -g eas-cli` once and then use `eas` directly. `npx eas-cli@latest` always picks up the newest CLI.)

Docs: https://docs.expo.dev/eas/

### 1.3 Install expo-updates and wire it up
```bash
npx expo install expo-updates                # (already done — package is in package.json)
npx eas-cli@latest update:configure
```
This:
- Adds `expo-updates` to `package.json`.
- Edits `app.json`: writes `extra.eas.projectId`, `updates.url`, `runtimeVersion`.
- Creates the project on Expo's servers.

Commit the changes:
```bash
git add app.json package.json package-lock.json
git commit -m "chore: enable EAS Update"
```

### 1.4 Sanity-check `app.json`
Open `app.json` and confirm these fields exist (values will differ):
```json
{
  "expo": {
    "runtimeVersion": { "policy": "appVersion" },
    "updates": {
      "url": "https://u.expo.dev/<project-id>"
    },
    "extra": { "eas": { "projectId": "<project-id>" } }
  }
}
```
If `runtimeVersion` is missing, add `"runtimeVersion": { "policy": "appVersion" }` so updates are bound to the `versionName` in `android/app/build.gradle`.

**Runtime version policies** (https://docs.expo.dev/eas-update/runtime-versions/):
- `appVersion` (recommended for this app): increments runtime version when you bump app version. Simple. You must remember to bump `versionName` when changing native code.
- `fingerprint`: auto-detects native changes and bumps runtime version. Bulletproof but forces a new APK build for any tiny native config change.

---

## PART 2 — Build the signed Release APK

### 2.1 Generate a release keystore (ONCE — back this up forever)
```bash
keytool -genkeypair -v \
  -keystore android/app/lifeos-release.keystore \
  -alias lifeos \
  -keyalg RSA -keysize 2048 -validity 10000
```
Prompts:
- Keystore password — pick one, save it
- Org/name fields — anything reasonable
- Key password — press **Enter** to reuse the keystore password

⚠️ **If you lose this file or password, you can never publish updates to the same Android app on Play Store. Save it in a password manager + a backup drive.**

### 2.2 Save passwords to `~/.gradle/gradle.properties` (never committed)
```bash
mkdir -p ~/.gradle && cat >> ~/.gradle/gradle.properties <<'EOF'

LIFEOS_RELEASE_STORE_FILE=lifeos-release.keystore
LIFEOS_RELEASE_KEY_ALIAS=lifeos
LIFEOS_RELEASE_STORE_PASSWORD=REPLACE_ME
LIFEOS_RELEASE_KEY_PASSWORD=REPLACE_ME
EOF
```
Open `~/.gradle/gradle.properties` and replace both `REPLACE_ME` with the password you just typed in 2.1.

(`android/app/build.gradle` is already wired to read these properties — see `signingConfigs.release` block.)

### 2.3 Build the release APK
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
cd android && ./gradlew assembleRelease && cd ..

ls -lh android/app/build/outputs/apk/release/app-release.apk
```
Expect a 30–40 MB signed APK.

If R8/proguard fails, retry with shrink off:
```bash
cd android && ./gradlew assembleRelease -P android.enableShrinkResourcesInReleaseBuilds=false && cd ..
```

### 2.4 Test the release APK on your phone
```bash
adb -s be354e3b uninstall com.yaksishroff.lifeos   # debug build blocks reinstall (different signing key)
adb -s be354e3b install android/app/build/outputs/apk/release/app-release.apk
adb -s be354e3b shell monkey -p com.yaksishroff.lifeos -c android.intent.category.LAUNCHER 1
```
Open the app on the phone. It should run on its own (no Metro needed — the JS bundle is baked in).

---

## PART 3 — Publish v1.0.0 on GitHub

```bash
# stage tracked changes (android/ is gitignored, so build.gradle inside it is NOT included unless force-tracked)
git add app.json package.json package-lock.json android/app/build.gradle .gitignore
git commit -m "release v1.0.0"

git tag v1.0.0
git push origin main
git push origin v1.0.0

gh release create v1.0.0 \
  android/app/build/outputs/apk/release/app-release.apk \
  --title "LifeOS v1.0.0" \
  --notes "Initial public release. Sideload the APK on Android."
```

⚠️ Do **not** commit:
- `android/app/lifeos-release.keystore`
- `~/.gradle/gradle.properties`

---

## PART 4 — Day-to-day update workflow

### When you change JS / UI / colors / logic / screens / text
This is most updates. Two commands:
```bash
git add -A && git commit -m "fix: dashboard layout" && git push

npx eas-cli@latest update --channel production --message "fix: dashboard layout" --environment production
```
**Note:** Expo SDK 55+ requires `--environment`. The first `--channel production` matches the channel set in `eas.json` (already present).

Docs: https://docs.expo.dev/eas-update/getting-started/
Every device with v1.0.0 (or the matching `runtimeVersion`) installed will fetch and apply the update on its next cold launch. No reinstall.

### When you change native code or upgrade SDK
Triggers requiring a new APK:
- New npm package with native code (anything with `android/` or iOS `Podfile` entries)
- Expo SDK upgrade
- Change to `app.json` icon, splash, package id, permissions, plugins
- Bump `versionCode`/`versionName` in `android/app/build.gradle`

Steps:
1. Bump `versionName` in `android/app/build.gradle` (e.g. `1.0.0` → `1.1.0`) and `versionCode` (`1` → `2`).
2. Bump `version` in `package.json` to match.
3. Repeat **PART 2.3 → PART 3** with a new tag (`v1.1.0`).
4. Each user reinstalls the new APK once. After that, JS updates flow via EAS again.

### Bump app version helper (optional)
For consistency:
```bash
# edit android/app/build.gradle versionCode/versionName
# edit package.json version
git tag v1.1.0
```

---

## Reference links

- EAS Update getting started: https://docs.expo.dev/eas-update/getting-started/
- Runtime versions: https://docs.expo.dev/eas-update/runtime-versions/
- Android signed APK (React Native official): https://reactnative.dev/docs/signed-apk-android
- Expo distribution overview: https://docs.expo.dev/distribution/introduction/
- GitHub Releases (gh CLI): https://cli.github.com/manual/gh_release_create
- Obtainium (Android-only auto-update from GitHub Releases): https://github.com/ImranR98/Obtainium

---

## PART 5 — iOS notes

iOS sideloading is much more painful (Apple Dev membership $99/yr or weekly re-signing). Practical free options:

- **For yourself only**: rebuild via Xcode → `Product → Archive` → install via `xcrun devicectl` whenever you bump native deps. EAS Update covers JS-only changes between rebuilds.
- **For broader iOS distribution**: use `eas build --platform ios --profile production` (free Expo account works for one build a week on free tier). It produces a signed `.ipa`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` on `adb install` | Different signing key from previous install. `adb uninstall com.yaksishroff.lifeos` first. |
| Gradle "Could not find storeFile" | `~/.gradle/gradle.properties` missing or has wrong path. Path is relative to `android/app/`. |
| EAS Update doesn't reach device | Confirm `app.json → updates.url` is set, app was built **after** that field was added, `runtimeVersion` matches the published update's runtime version, and device has internet. |
| `gh release create` fails | `gh auth login` first. Make sure the tag is pushed: `git push origin v1.0.0`. |
| Release APK works in `adb install` but crashes immediately | Check `adb logcat \| grep -i lifeos` for proguard rule issues; rebuild with `-P android.enableShrinkResourcesInReleaseBuilds=false` and `minifyEnabled false` to confirm. |

---

## What is committed vs. local

| File | Committed | Why |
|---|---|---|
| `app.json` | ✅ yes | EAS project id + updates URL must travel with the repo |
| `android/` (whole folder) | ❌ no (gitignored) | Regenerated by `expo prebuild`. Track it explicitly only if you stop using prebuild. |
| `android/app/build.gradle` (signing wiring) | ✅ yes if you `git add -f` | Edit will be wiped on next prebuild — re-apply or move to a config plugin if that becomes annoying. |
| `android/app/lifeos-release.keystore` | ❌ never | Secret. |
| `~/.gradle/gradle.properties` | ❌ never (outside repo) | Secret. |
| `lifeos-release.keystore` backup | Outside repo, password-managed | Lose this = can't update Android app ever. |
