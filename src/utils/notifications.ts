import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { getData } from './storage';
import { DEFAULT_REMINDER_SETTINGS } from '../constants/theme';

// ── Android notification channels ────────────────────────────────────────────
// Android 8+ routes every notification through a channel. Without one, expo falls
// back to a low-importance default channel: alarms would arrive silent and with no
// heads-up banner, which makes the Alarms tab useless. iOS ignores channelId.

export const CHANNEL_ALARMS = 'alarms';
export const CHANNEL_REMINDERS = 'reminders';

let channelsReady: Promise<void> | null = null;

/** Create the channels once per app launch. Safe to call from anywhere; no-op on iOS. */
export function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelsReady) {
    channelsReady = (async () => {
      await Notifications.setNotificationChannelAsync(CHANNEL_ALARMS, {
        name: 'Alarms',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 400, 200, 400],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        // Android only honours this once the user grants "Do Not Disturb access"
        // to the app in system settings. Verified on an emulator: without that
        // grant the channel reports mBypassDnd=false, so alarms are still muted
        // by DND. Requesting it is harmless; do not treat it as guaranteed.
        bypassDnd: true,
        enableVibrate: true,
        showBadge: false,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
        name: 'Daily reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
        showBadge: false,
      });
    })().catch(e => {
      channelsReady = null; // let a later call retry
      console.warn('Notification channel setup failed:', e);
    });
  }
  return channelsReady;
}

/** Spread into a trigger to route it to a channel. Empty on iOS, which has no channels. */
const androidChannel = (channelId: string) =>
  (Platform.OS === 'android' ? { channelId } : null);

// ── Alarm helpers ────────────────────────────────────────────────────────────

export async function scheduleAlarmNotif(alarm: {
  id: string; label: string; timeH: number; timeM: number;
  days: number[]; musicService: string; musicUri: string; musicLabel: string;
}): Promise<string[]> {
  await ensureAndroidChannels();
  const { timeH: hour, timeM: minute, days, label, musicService, musicUri, musicLabel } = alarm;
  const ids: string[] = [];
  const serviceName = musicService === 'spotify' ? 'Spotify'
    : musicService === 'apple_music' ? 'Apple Music'
    : 'music';
  const body = musicLabel
    ? `Tap to open ${serviceName} · ${musicLabel}`
    : 'Your alarm is ringing — tap to dismiss';

  const content = {
    title: label || 'Alarm',
    body,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
    data: { type: 'alarm', musicUri, musicService },
  };

  if (days.length === 0) {
    // One-time: fire at next occurrence of this HH:MM
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const seconds = Math.max(Math.floor((target.getTime() - now.getTime()) / 1000), 1);
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        ...androidChannel(CHANNEL_ALARMS),
      },
    });
    ids.push(id);
  } else {
    for (const weekday of days) {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday, hour, minute,
          ...androidChannel(CHANNEL_ALARMS),
        },
      });
      ids.push(id);
    }
  }
  return ids;
}

export async function cancelAlarmNotifs(notifIds: string[]): Promise<void> {
  for (const id of notifIds) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  // Local notifications work on Android emulators, so only bail out on iOS
  // simulators — those genuinely can't deliver them. Guarding on Device.isDevice
  // alone made every reminder unverifiable on an Android emulator, and reported
  // "Permission Denied" even when POST_NOTIFICATIONS was granted.
  if (!Device.isDevice && Platform.OS !== 'android') return false;
  // Channels must exist before the Android 13+ POST_NOTIFICATIONS prompt so the
  // system settings page shows real categories instead of an empty list.
  await ensureAndroidChannels();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Reminder helpers ─────────────────────────────────────────────────────────
// Reminders and alarms are independent: each side only ever cancels its own
// notifications. Reminders are tagged data.type 'reminder'; alarms 'alarm'.

/** Cancel every scheduled reminder, leaving alarms untouched. */
async function cancelReminderNotifs(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    // Anything not tagged as an alarm is a reminder — installs from before the
    // 'reminder' tag existed scheduled reminders with no data at all.
    if (n.content.data?.type === 'alarm') continue;
    await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
  }
}

async function daily(h: number, m: number, title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { type: 'reminder' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: h,
      minute: m,
      ...androidChannel(CHANNEL_REMINDERS),
    },
  });
}

function hm(timeStr: string): [number, number] {
  const [h, m] = (timeStr as string).split(':').map(Number);
  return [h, m];
}

export async function scheduleAllReminders(): Promise<boolean> {
  const granted = await requestPermissions();
  if (!granted) return false;
  await cancelReminderNotifs();

  const s = await getData('reminderSettings', DEFAULT_REMINDER_SETTINGS);

  // Gym — early morning push
  await daily(...hm(s.gymTime),
    'Time for the gym 💪',
    "Get up and go — you'll thank yourself later."
  );

  // Morning skincare
  await daily(...hm(s.skincareTime),
    'Morning skincare 🌿',
    'Cleanse, moisturize, SPF. Look good, feel good.'
  );

  // Breakfast check-in
  await daily(...hm(s.breakfastTime),
    'Had breakfast yet?',
    "Don't skip it — log what you had."
  );

  // Lunch check-in
  await daily(...hm(s.lunchTime),
    'Lunch break?',
    'What did you eat? Tap to log your meal.'
  );

  // Afternoon snack
  await daily(...hm(s.snackTime),
    'Snack time?',
    'Grab something healthy. Log it if you do.'
  );

  // Dinner check-in
  await daily(...hm(s.dinnerTime),
    "What's for dinner?",
    'Logging your meals helps track your diet. Tap to add.'
  );

  // Evening habits nudge
  await daily(...hm(s.habitsCheckTime),
    'Evening check-in',
    'A few habits left to tick off? Now is the time.'
  );

  // Daily log — what did you do today
  await daily(...hm(s.dailyLogTime),
    'What did you get done today?',
    'Log your progress before the day slips away.'
  );

  // Reading reminder — put the phone down
  await daily(...hm(s.readingTime),
    'Put your phone down 📚',
    "It's reading time. The scroll can wait."
  );

  // Journal
  await daily(...hm(s.journalTime),
    'How was your day?',
    'Write it down before you forget. Even a line counts.'
  );

  // Sleep wind-down
  await daily(...hm(s.sleepReminder),
    'Time for bed?',
    "Put the screens down. You did great today."
  );

  return true;
}

export async function cancelAllReminders(): Promise<void> {
  await cancelReminderNotifs();
}

export async function sendTestNotification(): Promise<void> {
  await requestPermissions();
  await Notifications.scheduleNotificationAsync({
    content: { title: '🔔 Notifications Active', body: 'Your LifeOS reminders are working!', sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      ...androidChannel(CHANNEL_REMINDERS),
    },
  });
}
