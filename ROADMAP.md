# LifeOS — Roadmap

The single source of truth for what ships next, what's planned, and what's been parked.

> **Legend**
> Priority: 🔴 Critical · 🟠 High · 🟡 Nice-to-have · 🔵 Big bet
> Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` skipped/parked
>
> Convert relative dates to absolute when adding entries. Keep priorities honest — if everything is high, nothing is.

> **Restored 2026-08-17.** This file was written on 2026-05-08, deleted in commit `74fa640`,
> and recovered from `git show b30865f:ROADMAP.md`. It has been re-scoped for the ownership
> handover and the move to equal Android + iOS support — see §9. Every `[x]` below was verified
> against the code on 2026-08-17, not taken on trust from the old plan.

---

## 0. Where we are today

- **Owner:** Kevin (`kevinpatildxd`), since 2026-08-17. Developed on Windows.
- **Targets:** Android and iOS, equally. Android is being brought up first because it's the
  device on hand; the iOS pass follows. See §1.
- **Current release:** `app.json` / `package.json` now say **1.2.0** (bumped 2026-08-21).
  Still needs a tag and a cut release. Note `runtimeVersion.policy` is `appVersion`, so this
  bump means a **native rebuild** — OTA won't reach 1.1.0 installs.
- **Stack:** Expo ~54 + React Native 0.81 + React 19 + Expo Router + AsyncStorage (no backend)
- **Screens (9), tab bar (5):** the bar holds Dashboard · Tasks · Fitness · Growth · Settings.
  Journal, Finance, Analytics and Alarms are `href: null` routes reached from the Dashboard's
  "Jump To" row. *(Corrected 2026-08-21 — this line used to claim nine tabs.)*
- **Distribution:**
  - Android: signed APK on GitHub Releases, OTA via EAS Update channel `production`
  - iOS: dev / Xcode archive only — **cannot be built from the current Windows machine**; use EAS cloud
- **Storage:** local-only AsyncStorage with a `schemaVersion` migration runner (`src/utils/migrate.ts`).
  JSON export from Settings. Android Auto Backup wired. No iOS iCloud backup yet, no sync.

**The next thing to do:** the app has never been built or launched on Android. All the Android
work so far is code and config, verified only as far as `expo prebuild` and `tsc`. Once that's
working, the iOS pass is the other half of the same job. See §2.

---

## 1. North-star vision

A fully local, privacy-first life tracker that captures everything that matters in one place:
habits, schedule, fitness, learning, skills, journal, finance, analytics. Built first for daily
personal use. Generic-enough defaults that the source is shareable, but **no Play Store, no App
Store, no support promise**.

Three things must always be true:

1. **Single-glance Dashboard** — open the app and see today.
2. **Zero-friction logging** — tap counts more than typing.
3. **Local-first, exportable** — your data is yours, in JSON, anytime.

**Platforms (changed 2026-08-17): Android and iOS are equal targets.** Neither outranks the
other; a feature is not done until it works on both. This replaces the 2026-05-08 "iOS-first,
Android best-effort" call — that was a ranking, this is not.

What *is* true is a **sequencing** constraint, not a priority one: there's no iOS device on hand
right now, so Android gets built and tested first and iOS follows once Android is working. The
practical consequences:

- Build and verify on Android now; do the iOS pass when the Android side is done.
- Platform-specific work (iCloud vs Auto Backup, HealthKit vs Health Connect) is scheduled in
  whichever order the available hardware allows — both halves still ship. See §4.
- iOS builds go through the EAS cloud rather than a local Xcode, until there's a Mac in the loop.
- Nothing gets designed as Android-only. Every `Platform.OS` branch needs both arms filled in.

---

## 2. Now — the active plan

### 2.1 🔴 Android bring-up (blocking)

Nothing below this line can be trusted until this is done.
**Half of it is now done — see [AUDIT.md](./AUDIT.md) for the device-verified record.**

- [x] 🔴 First Android build — done 2026-08-21 on emulator `gami_pixel7`. 31m 27s cold
      (one-time Gradle dist + ~1 GB NDK), **1m 22s incremental** after.
- [x] 🔴 Smoke-test all 9 screens on Android — all render, **zero JS errors**. Found and fixed
      four bugs in the process (AUDIT F1, F4, F5, F6).
- [ ] 🔴 Verify alarms actually fire, with sound, on the `alarms` channel — *channel verified
      (importance 5/MAX); firing still unobserved. Wants a real phone.*
- [x] 🔴 Verify the 11 daily reminders fire on the `reminders` channel — 11 scheduled and
      confirmed in `dumpsys alarm`. Required fixing AUDIT F1 first, which had made **all**
      notifications impossible on any emulator.
- [ ] 🟠 Verify Android Auto Backup round-trips: log data → uninstall → reinstall → data returns
- [ ] 🟠 Verify the release APK path end-to-end (`npm run android:release`, then §5)

### 2.1b 🟠 Real alarms — separate from reminders (decided 2026-09-29)

Reminders and Alarms are two features that stay independent. Reminders are the 11 daily
nudges — plain notifications, where a late arrival is acceptable. Alarms have to wake you up,
on **both** platforms:

- [x] Decouple the schedules — reminders no longer cancel/rebuild alarms (2026-09-29, `notifications.ts`)
- [ ] Pick the mechanism per platform (exact scheduling + ring-until-dismissed + lock screen).
      Research 2026-09-29 (unverified, re-check before adopting): lead candidate
      `react-native-alarm-scheduler` — Android `setAlarmClock` + ringing service + full-screen UI,
      iOS AlarmKit (26+), Expo config plugin; but new (May 2026) and single-maintainer. Notifee is
      archived (2026-04); its maintained fork `react-native-notify-kit` is the safer Android-only
      fallback. iOS < 26 can only get a time-sensitive notification (≤30 s sound, obeys silent switch).
- [ ] Optional: add `USE_EXACT_ALARM` so the plain reminders stop drifting by up to an hour —
      expo-notifications already schedules exactly when that permission is present
- [ ] Android: exact alarm (`setAlarmClock`-class) + full-screen ringing screen
- [ ] iOS: equivalent (AlarmKit on iOS 26+, with a fallback for older iOS)
- [ ] DND bypass (AUDIT F3) — only real alarms need it; guide the user through granting access
- [ ] Verify on a real Android phone and via an EAS iOS build

### 2.2 Done in the 2026-08-17 cross-platform pass

Shipped in commit `aa2a1ec`. Code-complete, **device-untested** — that's §2.1's job.

- [x] Windows dev tooling — `scripts/` replaces the macOS-only `dev.sh`/`run.sh`/`release.sh`
- [x] `npm run doctor` — checks JDK, Android SDK, adb, device, LAN IP
- [x] Android notification channels — `alarms` (MAX) + `reminders` (HIGH). **The DND bypass does
      not actually work:** verified 2026-08-21, the channel reports `mBypassDnd=false` because
      Android only honours it after the user grants DND access. See [AUDIT.md](./AUDIT.md) F3.
      Without these every alarm and reminder was silent on Android 8+.
- [x] Channels created at boot and before the Android 13+ permission prompt
- [x] Apple Music hidden in the alarm picker on Android — `music://` resolves to nothing there
- [x] `expo-system-ui` — `userInterfaceStyle: "dark"` was being ignored on Android
- [x] Unified `runtimeVersion` policy across platforms so OTA doesn't drift
- [x] `eas.json` emits APKs on development/preview for direct sideloading
- [x] Commit policy — `.githooks/commit-msg` blocks co-author trailers and wrong committers

### 2.3 What's left of the original v1.2

The 2026-05-08 plan had 7 blocks. **Six are already built** (verified in code 2026-08-17):

| # | Block | Status | Evidence |
|---|---|---|---|
| 1 | Time picker wheel | [x] | `src/components/TimeField.tsx`, used in Schedule / Fitness / Settings |
| 2 | 7-day schedule templates | [x] | `schedule_mon`…`schedule_sun` + migration from `schedule_weekday` in `migrate.ts` |
| 3 | Skip-today + per-date override | [x] | `scheduleOverride_{date}` with a `skipped` list |
| 4 | Backlog carry / dismiss + any-day catchup | [x] | `carryBacklog` / `dismissBacklog` in `tasks.tsx`, 7-day lookback |
| 5 | Dashboard pass — rings, mood, shortcuts | [x] | `RingStack`, mood writes to `journal_{date}.mood`, `router.push` shortcut row |
| 6 | **Auto-backup on background** | [~] | **Android done** via `plugins/withAndroidAutoBackup.js`; **iOS iCloud not built** |
| 7 | Pomodoro cleanup + Growth merge | [x] | Growth merge done (`growth.tsx` + `growth/` panels); `app/timer.tsx` deleted 2026-08-21 |

Five of seven are done on both platforms. Block 6 is the one that is genuinely half-built —
Android has auto-backup, iOS does not — so **v1.2 is complete on Android and one feature short
on iOS**. The remaining slices:

- [ ] 🟠 iOS iCloud auto-backup — JSON to `iCloud Drive/LifeOS/backup-latest.json` on background,
      auto-restore on fresh install, no UI. Still owed; it closes the last v1.2 gap on iOS.
- [x] 🟠 Decide `app/timer.tsx` — deleted 2026-08-21 (§3)

---

## 3. Housekeeping — small, do them soon

- [~] 🔴 Bump version to `1.2.0` in `app.json` + `package.json`, tag, and cut a release.
      **Both files bumped 2026-08-21.** Tag and release still owed.
- [~] 🟠 CNG for `ios/` — **decided 2026-09-29: generate it, don't commit it.** `ios/` is now
      gitignored like `android/`, so EAS runs `expo prebuild` and iOS finally gets `app.json`'s
      `plugins`, `icon`, `splash` and `ios` config. (The committed copy was stale — its
      `Info.plist` still said version `1.0.0`.) `expo prebuild` refuses iOS on Windows, so the
      first proof is an `npm run build:preview` iOS build. **Yaksi to review this later**; the
      old `ios/` is in git history (`518dd97`) if it ever needs restoring. Xcode-level tweaks
      now go through config plugins.
- [x] 🟠 Remove `react-native-chart-kit` — uninstalled 2026-08-21. Three comments still name it;
      they're history, not imports.
- [x] 🟠 Delete `app/timer.tsx` — deleted 2026-08-21 along with its `Stack.Screen` in
      `app/_layout.tsx`. Nothing navigated to it and no `pomodoro` reference survives outside it.
      This follows the 2026-05-08 kill-list decision. Recoverable from git if the Mind
      meditation timer (§6) ever wants it back.
- [ ] 🟡 Re-check `RELEASE.md` PART 2/3 against a real Windows Android build; the gradle and
      keystore steps have only ever been run on macOS.

---

## 4. Platform parity

New section, 2026-08-17. Tracks where the two equal targets diverge, so "works on my phone"
stops meaning "works". Gaps run in both directions — the Android list is longer only because
Android is the half being built first.

### Android gaps

- [ ] 🟠 **Alarms are inexact — measured at a full hour.** `expo-notifications` doesn't request
      `SCHEDULE_EXACT_ALARM`, so Android 12+ schedules them inexactly. Verified 2026-08-21:
      `dumpsys alarm` reports **`window=+1h0m0s0ms`** on all 11 reminders, so a 06:30 gym nudge
      may legitimately fire at 07:30 — not "minutes", as this line used to say. Doze can extend
      it further. A notification also can't take over the screen the way a real alarm app does.
      **Decided 2026-09-29: keep both, as separate features** — Reminders stay notifications;
      Alarms become real wake-up alarms (exact, rings until dismissed, lock-screen) on Android
      *and* iOS. Mechanism still to pick — see §2 "Real alarms". See [AUDIT.md](./AUDIT.md) F2.
- [ ] 🟡 Alarm music is Spotify-only on Android. The roadmap's "better alarm music picker"
      (§6 Notifications) is now the fix for this, not a nice-to-have.
- [ ] 🟡 Confirm edge-to-edge rendering and the status/navigation bars look right — Expo 54
      changed Android defaults and the layout was tuned on iOS.

### iOS gaps

- [ ] 🔴 **No iOS device to test on.** Everything below is unverifiable until there's a phone or
      a simulator in the loop. Build via `npm run build:preview` (EAS) when it's time.
- [ ] 🟠 iCloud auto-backup — the Android half shipped, so iOS is the side currently missing
      data-loss protection *(§2.3)*
- [ ] 🟡 Re-verify the alarm music picker on iOS after the Android-conditional change — Apple
      Music must still be offered there.

### Features that need both halves

Neither column leads. Whichever is built first, the other is owed before the feature counts
as done.

| Feature | iOS | Android |
|---|---|---|
| Silent auto-backup | iCloud Drive JSON | Auto Backup — **shipped** |
| Health data | HealthKit | Health Connect |
| Home-screen widgets | WidgetKit | App widgets / Glance |
| Biometric app lock | `expo-local-authentication` — one API covers both | |
| Exact / reliable alarms | works today | needs a strategy — see above |
| Dynamic Island | no Android equivalent — permanently parked | |

---

## 5. Distribution & release

| Channel | Status | Notes |
|---|---|---|
| Android — sideload | ✅ live | Signed APK on GitHub Releases. Obtainium friendly. |
| Android — Play Store | ⛔ skip | Personal tool. No store listing. |
| iOS — local Xcode build | ⛔ blocked | Needs macOS. Not available on the current machine. |
| iOS — EAS cloud build | 🟡 available | `npm run build:preview`. Needs an Apple Developer account ($99/yr). |
| iOS — TestFlight / App Store | ⛔ skip | Personal tool. |
| OTA — JS updates | ✅ live | EAS Update, channel `production`, runtime policy `appVersion`. |

**Release cadence — two-channel model.** Daily channel = the current `production` EAS channel;
push OTA the moment a feature works on your phone. Stable releases = monthly tagged versions
with a written changelog in GitHub Releases, bundling 4–6 features.

Native rebuild (not OTA) is required for: new native deps, SDK upgrades, `app.json` icon /
splash / package / permission / plugin changes, and version bumps.

See [RELEASE.md](./RELEASE.md) for the step-by-step flow and [README.md](./README.md) for the
day-to-day commands.

---

## 6. Full backlog by area

Unchanged from 2026-05-08 except where noted. Anything platform-specific needs both halves
planned before it's pulled into a release — see §4.

### 🗓 Calendar & Schedule
- [x] 🔴 Time picker wheel *(done)*
- [x] 🔴 "Just today" vs "always" schedule edits *(done — `scheduleOverride_`)*
- [x] 🔴 Backlog "Carry to tomorrow" + "Dismiss" *(done)*
- [x] 🔴 Catchup available any day, not just Sunday *(done)*
- [x] 🟠 7-day templates, Mon–Sun *(done)*
- [ ] 🟠 Day-type tags — Rest / Travel / Sick / Holiday / Study, auto-select template
- [ ] 🟠 "What's tomorrow" preview at the bottom of Dashboard
- [ ] 🟠 Long-press Dashboard schedule card → edit today's tasks
- [ ] 🔵 Week view — horizontal 7-day strip, density per day
- [ ] 🔵 Month calendar view — tap any date to see/edit tasks
- [ ] 🔵 Template library — Morning Person / WFH / Travel
- [ ] 🟡 Holiday awareness
- [ ] 🟡 "Planning mode" — view/edit next 7 days before the week starts

### 📋 Tasks & Productivity
- [ ] 🟠 Priority levels (High/Med/Low + colour)
- [ ] 🟠 Swipe gestures — right = complete, left = delete
- [ ] 🟠 Task notes / description
- [ ] 🟠 Drag to reorder manual tasks
- [ ] 🟡 Sub-tasks / checklist
- [ ] 🟡 Time estimate vs actual + stopwatch
- [ ] 🟡 Recurring manual tasks ("every Monday")
- [ ] 🔵 Eisenhower matrix view
- [ ] 🔵 Task search across all days
- [-] Focus mode — depended on Pomodoro *(parked)*

### 🏠 Dashboard
- [x] 🟠 Weekly goal progress rings *(done — `RingStack`)*
- [x] 🟠 Quick mood log *(done)*
- [x] 🟠 Shortcuts to Finance / Journal / Analytics *(done)*
- [ ] 🟠 "Next up" card — next 1–2 tasks within 60 min
- [ ] 🟡 Daily motivational quote in greeting
- [ ] 🟡 Energy-level tracker — 1–5 morning check-in
- [ ] 🟡 Mini week strip (7-day ✓/○ row)
- [ ] 🔵 Customisable Dashboard — reorder/hide sections

### 📊 Analytics & Insights
- [ ] 🟠 Habit correlation engine ("On 7+ hr sleep nights, habits +X%") — first insight that
      earns the Analytics tab
- [ ] 🟠 Streak calendar — full-year heatmap
- [ ] 🟠 Goal vs actual chart — weekly bars per goal
- [ ] 🟡 Weekly review screen (Sunday prompt)
- [ ] 🟡 Monthly report screen
- [ ] 🟡 Personal bests
- [ ] 🟡 Share progress card — image
- [ ] 🔵 Prediction nudges
- [ ] 🔵 Export to PDF

### 💪 Fitness
*(Daily-essential: weight, sleep, meals, deviations, cigs.)*
- [ ] 🟠 Sleep quality rating (1–5 stars, not just hours)
- [ ] 🟠 Workout log — exercise / sets / reps / weight
- [ ] 🟠 Body measurements — waist / chest / arms
- [ ] 🟡 Water reminder push
- [ ] 🟡 Meal nutrition — calorie / macro tracking
- [ ] 🟡 Diet deviation insights
- [ ] 🔵 Health integration (steps / sleep / workouts / weight) — HealthKit on iOS, Health
      Connect on Android. Both halves, in whichever order the hardware allows.
- [ ] 🔵 Running / walking GPS route logging

### 🎯 Growth (Learning + Skills, merged)
- [x] 🟠 Merge Learning + Skills into one tab *(done — `growth.tsx`, `growth/LearningPanel.tsx`,
      `growth/SkillsPanel.tsx`)*
- [ ] 🟠 Practice / session notes (free-text on log entries)
- [ ] 🟠 Resource links per course / per skill
- [ ] 🟠 Skill-level progression chart (1–10 over time)
- [ ] 🟠 Per-skill streak counter
- [ ] 🟡 Built-in metronome (Guitar)
- [ ] 🟡 Course completion milestones
- [ ] 🟡 Study session insights — best time of day
- [ ] 🔵 Flashcards / spaced repetition
- [ ] 🔵 Share-sheet capture → Growth resources *(was Safari-specific; Android share intent works too)*

### 📖 Reading & Listening
Likely a third sub-section inside Growth.
- [ ] 🟠 Reading log — title + minutes + optional notes per session
- [ ] 🟠 Podcast log — same shape, separate tag
- [ ] 🟡 Aggregate weekly chart (minutes by source)
- [ ] 🟡 "Currently reading" pin on Dashboard

### 🧘 Mind
Could live as a Dashboard card or a Journal section.
- [ ] 🟠 Meditation / breathwork log — duration + technique
- [ ] 🟠 Streak counter
- [ ] 🟡 Optional in-app timer — would be a fresh build now; `app/timer.tsx` was deleted
      2026-08-21, but its Pomodoro ring/SVG is recoverable from git history if useful
- [ ] 🟡 Mood pre/post comparison

### 💰 Finance
- [ ] 🟠 Income tracking + net cashflow
- [ ] 🟠 Recurring expenses — monthly auto-create
- [ ] 🟠 Bill reminders — due date + 2-day-before push
- [ ] 🟠 Month-over-month comparison
- [ ] 🟡 Savings goals — target + date
- [ ] 🟡 Receipt photo
- [ ] 🟡 Multi-currency
- [ ] 🔵 Investment portfolio tracker

### 📓 Journal
- [ ] 🟠 Mood trend graph — last 30 days inline
- [ ] 🟠 Journal streak counter
- [ ] 🟠 Search journal entries
- [ ] 🟠 Gratitude section — 3 lines
- [ ] 🟡 Tags (#travel #milestone)
- [ ] 🟡 Weekly journal prompts
- [ ] 🟡 Photo attachment (1–3)
- [ ] 🔵 Voice memo

### 🔔 Notifications & Alarms
*(Smart cadence — milestones + EOD + smart timing. Cap ~3–4/day.)*
- [x] 🔴 Android notification channels *(done 2026-08-17 — was silently breaking everything here)*
- [ ] 🟠 Exact-alarm strategy on Android *(§4 — decide before building more on this tab)*
- [ ] 🟠 End-of-day summary @ 9 PM ("X/Y tasks, X/Y habits")
- [ ] 🟠 Streak milestone notifications (7 / 30 / 100 days)
- [ ] 🟠 Smart timing — skip the gym reminder if the sleep log shows you're still in bed
- [ ] 🟠 Better alarm music picker — device playlists vs URI paste *(also fixes Android parity)*
- [ ] 🟡 Home-screen / lock-screen widget (water / habits / streak)
- [ ] 🟡 App-icon badge — pending habits
- [-] Dynamic Island Pomodoro *(dropped)*

### ☁️ Data & Backup
- [x] 🔴 Android auto-backup *(done — `plugins/withAndroidAutoBackup.js`; needs the §2.1 restore test)*
- [x] 🟡 Versioned schema / migration runner *(done — `schemaVersion` in `src/utils/migrate.ts`)*
- [ ] 🟠 iOS iCloud auto-backup *(§2.3)*
- [ ] 🟠 Better import UI — file picker vs share-sheet
- [ ] 🟡 Versioned snapshots — keep last N backups
- [ ] 🟡 Selective restore (habits only, finance only…)
- [ ] 🔵 Multi-device sync

### 🎨 UI / UX
- [x] 🔵 Full design pass *(done — the "redesign v1" commit `aac82a3`: SVG charts, rebuilt Today,
      single-hue monochrome across all screens)*
- [ ] 🟠 Light mode toggle
- [ ] 🟠 App lock — `expo-local-authentication` (fingerprint/face on both platforms)
- [ ] 🟠 Onboarding wizard
- [ ] 🟠 Empty states — illustrations + actions
- [ ] 🟡 Haptic feedback (habit toggle, task complete) — `expo-haptics` is already a dependency
- [ ] 🟡 Tab customisation — reorder/hide
- [ ] 🟡 App-icon variants
- [ ] 🔵 Tablet / landscape layout

### ⚙️ Performance & code health
- [ ] 🟠 Loading skeletons (vs blank screens)
- [ ] 🟠 Batched startup — single AsyncStorage `multiGet`
- [ ] 🟡 Error boundaries — friendly crash screen
- [ ] 🟡 Offline state detection (banner)
- [ ] 🟡 Memory-leak audit — `useFocusEffect` cleanup
- [ ] 🟡 There are no tests. Nothing here needs full coverage, but `helpers.ts` (timezone-safe
      dates), `migrate.ts` and `aggregates.ts` are pure functions that have already caused one
      dated bug (`e043e70`, UTC/local mismatch skipping days).

### 🪦 Kill list
- [x] 🟠 Pomodoro — entry points removed, and `app/timer.tsx` deleted 2026-08-21. Fully gone.
- [-] Focus mode
- [-] Dynamic Island Pomodoro

---

## 7. Architecture & code map

```
app/
  _layout.tsx         migrations, notification channels, alarm deep-link handler
  timer.tsx           Pomodoro — DEAD, route registered but unreachable (§3)
  (tabs)/
    _layout.tsx       tab bar (9 tabs)
    index.tsx         Dashboard — hero, rings, mood, shortcuts
    tasks.tsx         Schedule + habits + manual tasks + backlog/catchup
    fitness.tsx       Weight, sleep, meals, diet, cigs
    growth.tsx        Learning + Skills (merged) — panels in src/components/growth/
    journal.tsx       Notes + mood
    finance.tsx       Expenses + budget + net worth
    analytics.tsx     Charts + insights
    alarms.tsx        Alarm setup
    settings.tsx      Reminders + goals + data export
src/
  components/         AreaChart, Button, Card, DayTimeline, DonutChart, FormField,
                      ModalSheet, ProgressBar, RingStack, TimeField, TodayHero,
                      growth/{LearningPanel,SkillsPanel}
  constants/theme.ts  Colors, tab palettes, defaults, habits, rotation, skills
  hooks/useStorage.ts
  utils/              aggregates.ts · helpers.ts (timezone-safe dates) · migrate.ts
                      notifications.ts (channels + scheduling) · storage.ts
plugins/              withAndroidAutoBackup.js  (config plugin)
scripts/              dev · run · doctor · lan-ip · env · expo · setup-hooks  (all Node ESM)
.githooks/            commit-msg  (no co-author trailers; author must be kevinpatildxd)
```

**Storage keys** (verified 2026-08-17)

- Per-date: `habitData_{date}` · `water_{date}` · `cigLog_{date}` · `scheduleCompletion_{date}` ·
  `journal_{date}` · `expenses_{date}` · `budget_{date}` · `manualTasks_{date}` ·
  `activityLog_{date}` · `scheduleOverride_{date}` · `pomodoro_{date}` *(orphaned with the timer)*
- Schedule templates: `schedule_mon`…`schedule_sun`, with `schedule_weekday` / `schedule_saturday` /
  `schedule_sunday` still read as a legacy fallback
- Collections: `weightLog` · `sleepLog` · `studyLogs` · `skillLogs` · `skillAssessments` ·
  `customSkillList` · `learningDomains` · `learningRotation` · `dietDeviations` · `meals` ·
  `waterHistory` · `alarms` · `goals` · `habits` · `netWorth`
- Singles: `schemaVersion` · `reminderSettings` · `notificationsEnabled` · `targetWeight` ·
  `targetSleep` · `currentStreak` · `lastActiveDate`
- Planned: `readingLog` · `podcastLog` · `meditationLog`

---

## 8. Out of scope

Conscious "not now" calls. Move them up if context changes.

- Public listings (App Store / Play Store)
- Cloud account, login, any backend
- Paid tiers / subscriptions
- AI / LLM-driven insights (the correlation engine is rule-based)
- Cross-platform desktop
- Wearables
- Server-side push (everything stays local-scheduled)

---

## 9. Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-05-08 | Audience = one person, no public listings | Avoids onboarding-debt, support burden, store fees. Can flip later. |
| 2026-05-08 | v1.2 = "fix daily friction + backup", not a big-bet release | ~30h of budget. Big bets don't fit. |
| 2026-05-08 | Time picker is v1.2 #1 | Named the worst daily pain. |
| 2026-05-08 | 7-day templates migration: copy weekday → Mon–Fri, keep Sat/Sun | Zero-effort migration. |
| 2026-05-08 | Auto-backup scope: silent, no UI | Smallest scope that eliminates data-loss risk. |
| 2026-05-08 | Pomodoro on the kill list | Standalone apps do it better. |
| 2026-05-08 | Merge Learning + Skills → Growth | Both are non-daily; one tab is honest. |
| 2026-05-08 | Notifications: smart cadence (~3–4/day) | EOD + milestones + smart timing. No per-habit nag. |
| 2026-05-08 | Tracking in this file, not GitHub Issues | Low ceremony; matches the commit-driven flow. |
| 2026-05-08 | Two-channel release model (daily OTA + monthly stable) | Fast loop, with a stable marker. |
| **2026-08-17** | **Ownership → Kevin (`kevinpatildxd`)** | Handover. The "Audience = Yaksi" framing is retired. |
| **2026-08-17** | **Android and iOS are equal targets — neither is "first"** | Retires the 2026-05-08 "iOS-first, Android best-effort" ranking. A feature is done when it works on both. |
| **2026-08-17** | Android is built and tested before iOS — sequencing, not priority | No iOS device on hand. iOS follows once the Android side works; it is not deprioritised. |
| **2026-08-17** | **No macOS-only tooling** | Dev scripts are plain Node ESM in `scripts/`; the three `.sh` files are gone. |
| **2026-08-17** | **iOS builds go through EAS cloud** | No Mac available. Not a reason to drop iOS support. |
| **2026-08-17** | **No `Co-Authored-By` trailers; commits authored as `kevinpatildxd`** | Enforced by `.githooks/commit-msg`. |
| **2026-08-17** | iCloud backup stays 🟠 rather than 🔴 | Not a demotion of iOS — the risk it guards against is simply not testable until there's an iOS device. It is owed, and §4 tracks it. |
| **2026-09-29** | **Keep both Reminders and Alarms — as separate features** | Reminders = daily nudges (notifications, a little late is fine). Alarms = real wake-up alarms. Originally the Settings copy called them "Wake-up alarms". |
| **2026-09-29** | **Reminders and Alarms never touch each other's schedules** | Toggling reminders used to cancel *every* notification and rebuild the alarms. Each side now only cancels its own (tagged `data.type`). |
| **2026-09-29** | **`ios/` is generated (CNG), not committed** — pending Yaksi's review | Committed `ios/` made EAS skip `app.json` plugins/icon/splash on iOS. Must keep building on iOS. |
| **2026-08-17** | Design pass marked done | The `aac82a3` redesign delivered what the 2026-05-08 "deferred" entry described. |

---

*Last updated: 2026-09-29*
