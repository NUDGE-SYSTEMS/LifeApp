# LifeOS — Android bring-up audit

Running record of what has actually been **run and observed on a device**, as opposed to what
the code claims. Every ✅ below was verified against a real running app, not inferred from source.

**Environment:** Windows 11 · Node v24.18.1 · JDK 17.0.20 · Android SDK `C:\Android\Sdk` ·
emulator `gami_pixel7` (Pixel 7a, API 36, `emulator-5554`) · package `com.yaksishroff.lifeos`

> Legend — ✅ verified on device · ⚠️ open issue · 🔒 blocked, needs hardware · ⬜ not yet run

---

## 1. Session log

### 2026-08-21 — first Android build in the project's history

| # | Step | Result |
|---|---|---|
| 1 | `npm run doctor` | ✅ Node, JDK 17, SDK, adb all OK; no device until emulator booted |
| 2 | First `npm run android` | ❌ failed — `UnknownHostException: services.gradle.org` |
| 3 | Re-run with sandbox disabled | ✅ **BUILD SUCCESSFUL in 31m 27s** |
| 4 | Install + launch | ✅ installed, bundled 1404 modules, **zero JS errors** |
| 5 | Smoke-test all 9 screens | ✅ all render, dark theme correct, dates correct |
| 6 | Notification channels | ✅ both created with correct importance |
| 7 | 11 daily reminders | ✅ after fixing a blocking bug — see F1 |
| 8 | Bug fixes + rebuild | ✅ **1m 22s** incremental, all fixes verified on device |

**Build-time note.** The 31 min was almost entirely one-time downloads: the Gradle 8.14.3
distribution (never previously fetched — only a stale `.part`/`.lck` in
`~/.gradle/wrapper/dists/`) plus NDK 27.1.12297006 (~1 GB). The incremental rebuild after code
changes took **1m 22s**. Expect ~1–2 min for JS-only changes from here.

---

## 2. Build environment gotcha — read this before building

Gradle fails inside the agent's Bash sandbox with:

```
Exception in thread "main" java.net.UnknownHostException: services.gradle.org
```

This is **not** a network fault. `curl` and `nslookup` in the same shell reach the host fine —
the JVM specifically gets no network under the sandbox. Native Android builds must run with the
sandbox disabled. If a build dies this way, also clear any partial download before retrying:

```sh
rm -f ~/.gradle/wrapper/dists/gradle-8.14.3-bin/*/gradle-8.14.3-bin.zip.{part,lck}
```

---

## 3. Findings

### F1 — Notifications were entirely unusable on any emulator ✅ FIXED

**Severity: high.** `requestPermissions()` opened with `if (!Device.isDevice) return false`.
Emulators report `isDevice === false`, so the function returned `false` *before ever consulting
the OS*. Observed: with `POST_NOTIFICATIONS` genuinely granted
(`dumpsys`: `granted=true`, `importance=DEFAULT`), the app still showed
**"Permission Denied — Please enable notifications in Settings → LifeOS → Notifications"**,
directing the user to a setting that was already on. Reminders could never be scheduled.

- **Fix:** `src/utils/notifications.ts` — guard is now
  `if (!Device.isDevice && Platform.OS !== 'android') return false`. iOS simulators still bail
  (they genuinely cannot deliver local notifications); Android emulators, which can, no longer do.
- **Verified:** toggle flips on → "Reminders Active" dialog → 11 alarms appear in `dumpsys alarm`.

### F2 — Reminders are inexact by a full hour ⚠️ OPEN — decided 2026-09-29, not built

> **Decision 2026-09-29:** keep both. Reminders stay notifications (inexact is acceptable);
> Alarms become real wake-up alarms on Android and iOS. The two schedules are now decoupled in
> `notifications.ts`. See ROADMAP §2.1b.

All 11 reminders schedule as `RTC_WAKEUP` with **`window=+1h0m0s0ms`**. A 06:30 gym reminder may
legitimately fire any time up to 07:30. `expo-notifications` never requests
`SCHEDULE_EXACT_ALARM`, so Android 12+ downgrades them, and Doze can extend it further.

This confirms ROADMAP §4's "alarms are inexact" and quantifies it — the roadmap guessed "minutes";
the real window is **one hour**. Not fixed here because it is the architectural call the roadmap
already flagged: *is the Alarms tab a reminder or a real alarm?* A real alarm needs a different
mechanism (exact-alarm permission + full-screen intent, or a native module) — a notification
cannot take over the screen the way an alarm app does.

Observed schedule (all `+1h` window):
`06:30 · 07:00 · 09:00 · 13:00 · 16:30 · 19:30 · 20:00 · 21:00 · 22:00 · 22:45 · 23:00`

### F3 — `bypassDnd` silently does nothing ⚠️ OPEN — documented

Code sets `bypassDnd: true` on the `alarms` channel; runtime reports **`mBypassDnd=false`**.
Android only honours it once the user grants the app *Do Not Disturb access* in system settings.
Same story for `lockscreenVisibility: PUBLIC` → runtime `mLockscreenVisibility=-1000`
(`VISIBILITY_NO_OVERRIDE`).

So ROADMAP's "`alarms` (MAX, bypasses DND)" is half true: MAX importance is real, DND bypass is
not. A code comment now records this so the claim isn't re-trusted. Making it true requires a
user-granted DND-access flow.

### F4 — Growth showed the wrong day on every fresh install ✅ FIXED

`LearningPanel.tsx`'s fallback was written as a *weekend* banner
(`dow === 6 ? 'Saturday…' : 'Sunday…'`) but is reached whenever the rotation is empty — and
`LEARNING_ROTATION` defaults **every weekday** to `[]`. Result: on a Thursday, a fresh install
displayed **"Sunday: Research Work (1:30–3:30 PM)"**. There was no weekday branch at all.

- **Fix:** added the missing weekday case → `No rotation set for {day} — add one in Manage.`
- **Verified:** on Friday it now reads "No rotation set for Friday — add one in Manage."

### F5 — Three screens showed lowercase route names as titles ✅ FIXED

`analytics`, `journal`, `finance` were registered with `options={{ href: null }}` and no `title`,
so expo-router fell back to the raw route name — the headers literally read *"analytics"*,
*"journal"*, *"finance"*. Only `alarms` had a title.

- **Fix:** added `title` to all three in `app/(tabs)/_layout.tsx`.
- **Verified:** headers now read **Analytics**, **Journal**, **Finance**.

### F6 — Phantom `schedule` route ✅ FIXED

`_layout.tsx` registered `<Tabs.Screen name="schedule" />` but no `app/(tabs)/schedule.tsx`
exists. Dead config. Removed.

### F7 — Apple Music offered on Android where it cannot work ✅ FIXED

The alarm picker already hid Apple Music on Android (`music://` resolves to nothing there), but
two pieces of user-facing copy still advertised it:

- Settings row: *"Wake-up alarms · Spotify & Apple Music"*
- Alarms banner: *"…open your chosen Spotify or Apple Music track."*

- **Fix:** both are now `Platform.OS` conditional.
- **Verified:** Settings reads "Wake-up alarms · Spotify" on Android.

### F8 — ROADMAP says "Tabs (9)"; the tab bar has 5 ⚠️ DOC DRIFT

There are 9 screens, but only **5** are in the tab bar (Dashboard · Tasks · Fitness · Growth ·
Settings). Journal, Finance, Analytics and Alarms are `href: null` and reachable only through the
Dashboard's "Jump To" row. ROADMAP §0 should say so.

---

## 4. Blocker status (ROADMAP §2.1)

| Blocker | Status |
|---|---|
| First Android build on a device | ✅ done — 31m 27s, then 1m 22s incremental |
| Smoke-test all 9 tabs | ✅ done — all render, zero JS errors |
| Alarms fire with sound on the `alarms` channel | ⬜ **not finished** — channel verified, firing not yet observed |
| The 11 daily reminders on the `reminders` channel | ✅ done — 11 scheduled, confirmed in `dumpsys alarm` |
| Android Auto Backup round-trips | ⬜ not started |
| Release APK path end-to-end | ⬜ not started |

**Channels, as read back from the running system:**

| Channel | Importance | Vibration | DND bypass |
|---|---|---|---|
| `alarms` | 5 (MAX) ✅ | `[0,400,200,400]` ✅ | ❌ `false` — see F3 |
| `reminders` | 4 (HIGH) ✅ | `[0,250]` ✅ | n/a |

---

## 4b. Housekeeping batch — 2026-08-21

Ran after the bug fixes, all verified on the running app.

| Item | Result |
|---|---|
| Version bump | ✅ `app.json` + `package.json` → **1.2.0** |
| `app/timer.tsx` | ✅ deleted (275 lines) + its `Stack.Screen` in `app/_layout.tsx` |
| `react-native-chart-kit` | ✅ uninstalled — nothing imported it |
| ROADMAP corrections | ✅ tabs 9→5, DND bypass, 1-hour window, blocker status |
| `npx tsc --noEmit` | ✅ clean |
| App restart on emulator | ✅ renders, **zero JS errors, zero route warnings** |

Two notes worth carrying forward:

- **The version bump forces a native rebuild.** `runtimeVersion.policy` is `appVersion`, so
  1.2.0 is a new runtime version — OTA will not reach existing 1.1.0 installs. Tag + cut a
  release before pushing any more `eas update`.
- **Deleting `timer.tsx` fixed a live warning.** Metro was emitting
  `[Layout children]: Too many screens defined. Route "timer" is extraneous.` — the same class of
  warning the phantom `schedule` route (F6) was producing. Both are gone; restart is clean.

The Pomodoro screen is recoverable from git history if the Mind meditation timer (ROADMAP §6)
ever wants its ring/SVG.

---

## 5. Changed files

| File | Finding |
|---|---|
| `src/utils/notifications.ts` | F1 (guard), F3 (comment) |
| `src/components/growth/LearningPanel.tsx` | F4 |
| `app/(tabs)/_layout.tsx` | F5, F6 |
| `app/(tabs)/settings.tsx` | F7 |
| `app/(tabs)/alarms.tsx` | F7 |

`npx tsc --noEmit` passes clean. All changes are JS/TS only — **no native rebuild required**,
so these ship over OTA.

---

## 6. What still needs a real Android phone

- **Alarm firing with sound** — schedulable on an emulator, but "does it actually wake you up"
  is a hardware question (Doze, DND, screen-off behaviour).
- **F2's exact-alarm decision** — emulator Doze does not reflect real-device Doze.
- **Auto Backup round-trip** — needs a real Google account bound to the device.

---

*Last updated: 2026-08-21 — after the bug-fix rebuild, before Kevin's manual test pass.*
