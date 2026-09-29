# LifeOS — Android test guide

A checklist to work through on the emulator (or a phone). Written 2026-08-21, after the first
Android build and the bug-fix pass. Pair it with [AUDIT.md](./AUDIT.md), which records what has
already been verified and what hasn't.

**How to use it:** work top to bottom. §1 and §2 matter most — §2 is code I changed that you
haven't seen yet. Anything that fails, note the section number and what you saw; that's enough
for me to find it.

---

## 0. Launch

```sh
C:/Android/Sdk/emulator/emulator.exe -avd gami_pixel7
npm run android
```

~90 seconds — the native build is cached, so no repeat of the 31-minute cold build.

- Want a **clean first-run** (empty data, no permission granted)? Wipe the AVD's data first, via
  Android Studio's Device Manager → *Wipe Data*. Otherwise the previous session's state persists,
  including granted notifications and the 11 scheduled reminders.
- The app is `LifeOS`. Metro must stay running — this is a debug build.

**Layout reminder:** the tab bar holds 5 tabs — **Dashboard · Tasks · Fitness · Growth ·
Settings**. Journal, Finance, Analytics and Alarms live in the **"Jump To"** row at the bottom of
the Dashboard (scroll down).

---

## 1. 🔴 The one real blocker left — alarms

This is the last ROADMAP §2.1 item that can be moved on an emulator. Do it first.

- [ ] Dashboard → scroll down → **Jump To → Alarms**
- [ ] Banner should read *"…open your chosen **Spotify** track."* — **no mention of Apple Music**
      (that's a fix; see §2.4)
- [ ] **+ Add** → set a time **2–3 minutes from now** → pick **None** for music first → Save
- [ ] Alarm appears in the list, toggle showing enabled
- [ ] **Lock the screen** and wait for it
  - [ ] It fires
  - [ ] It makes a **sound**
  - [ ] It shows as a **heads-up banner**, not a silent tray entry
- [ ] Now repeat with **Spotify** selected and a real Spotify link
  - [ ] Tapping the notification opens Spotify at that track
- [ ] Delete the test alarms afterwards

> ⚠️ Expect it to be **late** — see §5. Judge whether it *fires with sound*, not whether it's punctual.

---

## 2. 🟠 Regression check — the five things I changed

You haven't seen any of these. I verified each renders correctly, but not that the surrounding
behaviour still works.

### 2.1 Notifications actually work now
Previously the app said *"Permission Denied"* even with the OS permission granted, and reminders
could never be scheduled.

- [ ] Settings → **Daily Reminders** toggle → ON
- [ ] Android's permission prompt appears (on a clean install) → **Allow**
- [ ] You get a **"Reminders Active"** dialog — *not* "Permission Denied"
- [ ] Toggle stays ON after leaving and returning to Settings
- [ ] **Send Test** → a test notification arrives within a couple of seconds
- [ ] Toggle OFF, then ON again — no error either way

### 2.2 Growth shows the correct day
Previously, every weekday on a fresh install claimed *"Sunday: Research Work (1:30–3:30 PM)"*.

- [ ] Growth → Learning → **Today's Rotation**
- [ ] With no rotation set, it reads **"No rotation set for {today} — add one in Manage."** with
      today's actual weekday
- [ ] Scroll to **Manage → Weekly Rotation** → set two blocks for today → Save
- [ ] Today's Rotation now shows those blocks with the correct day name and B1/B2 badges
- [ ] Clear them again → back to the "No rotation set for…" message

### 2.3 Screen titles
Three headers used to render as lowercase route names.

- [ ] Jump To → **Journal** → header reads **"Journal"** (not "journal")
- [ ] Jump To → **Finance** → header reads **"Finance"**
- [ ] Jump To → **Analytics** → header reads **"Analytics"**

### 2.4 Apple Music no longer offered on Android
`music://` links resolve to nothing on Android, so it was advertising something broken.

- [ ] Settings → Alarms row subtitle reads **"Wake-up alarms · Spotify"**
- [ ] Alarms banner mentions **Spotify only**
- [ ] Alarms → + Add → music picker offers **None** and **Spotify** only — no Apple Music

### 2.5 Pomodoro screen is gone
`app/timer.tsx` was deleted — it was unreachable dead code.

- [ ] Nothing anywhere navigates to a timer/Pomodoro screen
- [ ] No crash or blank modal from any header button or shortcut

---

## 3. Real data — the part never exercised on Android

Every screen has only ever been seen **empty** on Android. Charts, aggregates and the heatmap have
never rendered with actual numbers. This is where new bugs are most likely.

### 3.1 Tasks
- [ ] Add a manual task → appears under **Today's Tasks**, counter goes `0/1`
- [ ] Complete it → counter updates, **DONE** badge at top updates
- [ ] **Fixed Schedule → + Add** → add a task with a time → appears in the schedule list
- [ ] Tick a **Daily Habit** → `0/5` becomes `1/5`
- [ ] Habits and tasks survive leaving the tab and coming back

### 3.2 Fitness
- [ ] Log **Gym / Walking / Swimming** hours with the ± buttons — `0.5h` steps
- [ ] Tick **Journalling** and **Mindfulness**
- [ ] Enter **weight** and **sleep hours** → Body Stats tiles populate
- [ ] Use the **‹ ›** date arrows → yesterday shows its own (empty) data, not today's
- [ ] `›` is disabled on today — you can't log the future

### 3.3 Growth
- [ ] Log hours against a Learning domain → **Study Progress** updates
- [ ] **+ Notes** → add a session note → it persists
- [ ] Switch to the **Skills** panel → log skill time, set an assessment level
- [ ] Weekly trend chart draws with real data (this is SVG — watch for clipping or blank areas)

### 3.4 Journal
- [ ] Pick a **mood** → it highlights
- [ ] Write a **reflection** → navigate away and back → text is still there
- [ ] Date arrows load the correct day's entry
- [ ] Mood set here shows on the **Dashboard**'s Today's Mood too

### 3.5 Finance
- [ ] **+ Add** an expense → **Spent Today** updates, entry appears
- [ ] **Last 7 Days** week total and daily average look right
- [ ] **Net Worth → Edit** → set assets and liabilities → total computes correctly
- [ ] Currency shows **₹** throughout

### 3.6 Analytics — highest-risk screen
Nothing here has ever been seen with data.

- [ ] **Monthly Overview** ring and the Gym / Sleep / Study / Skills bars reflect what you logged
- [ ] **Monthly Summary** — all six tiles show real numbers
- [ ] **Habit Heatmap** — today's cell is filled; the grid aligns to the right weekday columns
- [ ] Month **‹ ›** navigation works, including stepping back into an empty month
- [ ] Scroll the whole screen — no clipped charts or overlapping cards

### 3.7 Settings
- [ ] **Configure Times** → change a reminder time → save → reopen → it stuck
- [ ] **Weekly Goals → Edit** → change a goal → Dashboard's **This Week** rings reflect it
- [ ] **Export** → JSON comes out via the share sheet and contains your data

---

## 4. Cross-cutting

- [ ] **Rotate** the device on a few screens — no crash, no cut-off content
- [ ] **Back button** from Journal / Finance / Analytics / Alarms returns to the Dashboard
- [ ] Kill the app from recents and reopen — **all data survives**
- [ ] Scroll every screen to the very bottom — nothing hidden behind the tab bar
- [ ] Date rollover: the app reads dates in **local time** — if you test near midnight, check the
      Dashboard's date header flips correctly (this has caused a dated bug before)

---

## 5. Known — please don't re-report these

Already found, recorded in AUDIT.md, and awaiting a decision rather than a fix:

| | What you'll see | Why |
|---|---|---|
| **F2** | Reminders and alarms fire **late — up to an hour** | Android schedules them inexactly; measured `window=+1h`. Needs the reminder-vs-alarm decision. |
| **F3** | Alarms **do not** pierce Do Not Disturb | Android ignores `bypassDnd` until you grant the app DND access in system settings. |
| — | Nothing iOS is testable | No device, no Mac. |
| — | `expo-doctor` warns about `ios/` | The CNG decision, still open. |

**Do report:** an alarm that never fires at all, one that fires **silently**, or one that fires at
completely the wrong time (hours off, or the wrong day).

---

## 6. Reporting back

Per item, this is plenty:

```
3.6 Analytics — heatmap: logged habits on 3 days, only 1 cell filled. Screenshot attached.
```

Screenshot from the emulator with `Ctrl+S`, or:

```sh
C:/Android/Sdk/platform-tools/adb.exe exec-out screencap -p > shot.png
```

If something crashes, grab the log immediately — it's the most useful thing you can send:

```sh
C:/Android/Sdk/platform-tools/adb.exe logcat -d | Select-String -Pattern "ReactNativeJS|FATAL|AndroidRuntime"
```

---

*Written 2026-08-21. Sections 1 and 2 are the priority; §3 is where undiscovered bugs most likely are.*
