import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert, Share, RefreshControl, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, DEFAULT_REMINDER_SETTINGS, DEFAULT_GOALS, DEFAULT_HABITS, radius } from '../../src/constants/theme';
import { getData, setData, exportAllData, getAllKeys, removeData } from '../../src/utils/storage';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { FormField } from '../../src/components/FormField';
import { TimeField } from '../../src/components/TimeField';
import { ModalSheet } from '../../src/components/ModalSheet';
import { scheduleAllReminders, cancelAllReminders, sendTestNotification, requestPermissions } from '../../src/utils/notifications';

const REMINDER_FIELDS: { key: string; icon: string; label: string; fallback: string }[] = [
  { key: 'gymTime', icon: '💪', label: 'Gym', fallback: '06:30' },
  { key: 'skincareTime', icon: '🌿', label: 'Morning skincare', fallback: '07:00' },
  { key: 'breakfastTime', icon: '🍳', label: 'Breakfast', fallback: '09:00' },
  { key: 'lunchTime', icon: '🥗', label: 'Lunch', fallback: '13:00' },
  { key: 'snackTime', icon: '🍎', label: 'Snack', fallback: '16:30' },
  { key: 'dinnerTime', icon: '🍽️', label: 'Dinner', fallback: '19:30' },
  { key: 'habitsCheckTime', icon: '✅', label: 'Habits nudge', fallback: '20:00' },
  { key: 'dailyLogTime', icon: '📋', label: 'Daily log', fallback: '21:00' },
  { key: 'readingTime', icon: '📚', label: 'Reading / phone down', fallback: '22:00' },
  { key: 'journalTime', icon: '📓', label: 'Journal', fallback: '22:45' },
  { key: 'sleepReminder', icon: '😴', label: 'Sleep wind-down', fallback: '23:00' },
];

const GOAL_FIELDS = [
  { key: 'weeklyGymHours', icon: '💪', label: 'Gym hours / week', color: Colors.green, placeholder: '5' },
  { key: 'weeklyWalkHours', icon: '🚶', label: 'Walking hours / week', color: Colors.teal, placeholder: '7' },
  { key: 'weeklySwimHours', icon: '🏊', label: 'Swimming hours / week', color: Colors.cyan, placeholder: '3' },
  { key: 'weeklyJournalDays', icon: '📓', label: 'Journalling days / week', color: Colors.pink, placeholder: '7' },
  { key: 'weeklyMindfulDays', icon: '🧘', label: 'Mindfulness days / week', color: Colors.purple, placeholder: '7' },
  { key: 'weeklyStudyHours', icon: '📚', label: 'Study hours / week', color: Colors.orange, placeholder: '10' },
  { key: 'weeklyCigLimit', icon: '🚬', label: 'Cigarette limit / week', color: Colors.red, placeholder: '5' },
  { key: 'weeklyWater', icon: '💧', label: 'Water glasses / week', color: Colors.cyan, placeholder: '56' },
  { key: 'weeklySleepAvg', icon: '😴', label: 'Average sleep (hours)', color: Colors.purple, placeholder: '7.25' },
  { key: 'weeklySkillHours', icon: '🎸', label: 'Skill hours / week', color: Colors.yellow, placeholder: '8' },
];

// Leading tinted icon square — the recurring visual anchor for every setting row.
function IconTile({ emoji, color }: { emoji: string; color: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: color + '18', borderColor: color + '2e' }]}>
      <Text style={styles.tileEmoji}>{emoji}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<any>(DEFAULT_REMINDER_SETTINGS);
  const [goals, setGoals] = useState<any>(DEFAULT_GOALS);
  const [habits, setHabits] = useState<string[]>(DEFAULT_HABITS);
  const [newHabit, setNewHabit] = useState('');

  const [goalModal, setGoalModal] = useState(false);
  const [habitModal, setHabitModal] = useState(false);
  const [notifModal, setNotifModal] = useState(false);
  const [goalEdits, setGoalEdits] = useState<Record<string, string>>({});
  const [notifEdits, setNotifEdits] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setNotifEnabled(await getData<boolean>('notificationsEnabled', false));
    setReminderSettings(await getData('reminderSettings', DEFAULT_REMINDER_SETTINGS));
    setGoals(await getData('goals', DEFAULT_GOALS));
    setHabits(await getData<string[]>('habits', DEFAULT_HABITS));
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadData(); setRefreshing(false); }, [loadData]);

  const toggleNotifications = async (val: boolean) => {
    setNotifEnabled(val);
    await setData('notificationsEnabled', val);
    if (val) {
      const ok = await scheduleAllReminders();
      if (!ok) {
        setNotifEnabled(false);
        await setData('notificationsEnabled', false);
        Alert.alert('Permission Denied', 'Please enable notifications in Settings → LifeOS → Notifications.');
      } else {
        Alert.alert('Reminders Active', 'Water, journal, sleep & skincare reminders are scheduled!');
      }
    } else {
      await cancelAllReminders();
    }
  };

  const handleTestNotification = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert('Permission Required', 'Enable notifications first to send a test.');
      return;
    }
    await sendTestNotification();
  };

  const saveGoals = async () => {
    const updated: Record<string, number> = { ...goals };
    Object.entries(goalEdits).forEach(([k, v]) => {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0) updated[k] = n;
    });
    await setData('goals', updated);
    setGoals(updated);
    setGoalModal(false);
  };

  const saveNotifSettings = async () => {
    const updated: Record<string, any> = { ...reminderSettings };
    Object.entries(notifEdits).forEach(([k, v]) => {
      const n = Number(v);
      updated[k] = isNaN(n) || v.includes(':') ? v : n;
    });
    await setData('reminderSettings', updated);
    setReminderSettings(updated);
    if (notifEnabled) { await cancelAllReminders(); await scheduleAllReminders(); }
    setNotifModal(false);
    Alert.alert('Saved', notifEnabled ? 'Reminders rescheduled.' : 'Settings saved.');
  };

  const addHabit = async () => {
    const h = newHabit.trim();
    if (!h || habits.includes(h)) return;
    const updated = [...habits, h];
    setHabits(updated);
    await setData('habits', updated);
    setNewHabit('');
  };

  const removeHabit = (h: string) => {
    Alert.alert('Remove Habit', `Remove "${h}" from your daily habits?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const updated = habits.filter(x => x !== h);
          setHabits(updated);
          await setData('habits', updated);
        },
      },
    ]);
  };

  const exportData = async () => {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      await Share.share({ message: json, title: 'LifeOS Data Export' });
    } catch {
      Alert.alert('Error', 'Could not export data.');
    }
  };

  const importData = () => {
    Alert.alert(
      'Import Data',
      'Paste your exported JSON data. This will merge with existing data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Share / Files',
          onPress: () => Alert.alert(
            'How to Import',
            '1. Export your data first (creates a JSON file)\n2. Open the JSON in a text editor\n3. Copy the content\n4. Use a data restoration app or contact support.\n\nNote: Full import UI is coming in a future update.',
          ),
        },
      ],
    );
  };

  const clearAllData = () => {
    Alert.alert(
      '⚠️ Delete All Data',
      'This permanently deletes ALL your LifeOS data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything', style: 'destructive', onPress: () => {
            Alert.alert('Are you absolutely sure?', 'There is no recovery from this action.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Delete All', style: 'destructive', onPress: async () => {
                  const keys = await getAllKeys();
                  for (const k of keys) await removeData(k);
                  Alert.alert('Cleared', 'All data has been deleted.');
                  loadData();
                },
              },
            ]);
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentLight} />}>
      {/* ── HEADER ───────────────────────────────────────────── */}
      <View style={styles.greet}>
        <Text style={styles.greetDay}>Preferences</Text>
        <Text style={styles.greetHi}>Settings</Text>
      </View>

      {/* ── NOTIFICATIONS ────────────────────────────────────── */}
      <Card title="Notifications" accentColor={Colors.accentLight}>
        <View style={[styles.row, styles.rowFirst]}>
          <IconTile emoji="🔔" color={Colors.accentLight} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Daily Reminders</Text>
            <Text style={styles.rowDesc}>Meals · Gym · Habits · Journal · Sleep</Text>
          </View>
          <Switch
            value={notifEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: Colors.surfaceHighest, true: Colors.accentGlow }}
            thumbColor={notifEnabled ? Colors.accent : Colors.textMuted}
          />
        </View>

        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => router.push('/(tabs)/alarms')}>
          <IconTile emoji="⏰" color={Colors.accentLight} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Alarms</Text>
            <Text style={styles.rowDesc}>
              {Platform.OS === 'ios' ? 'Wake-up alarms · Spotify & Apple Music' : 'Wake-up alarms · Spotify'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.btnRow}>
          <Button
            title="Configure Times"
            size="sm"
            variant="outline"
            color={Colors.accentLight}
            style={{ flex: 1 }}
            onPress={() => {
              setNotifEdits(Object.fromEntries(Object.entries(reminderSettings).map(([k, v]) => [k, String(v)])));
              setNotifModal(true);
            }}
          />
          <Button
            title="Send Test"
            size="sm"
            variant="ghost"
            color={Colors.accentLight}
            style={{ flex: 1 }}
            onPress={handleTestNotification}
          />
        </View>
      </Card>

      {/* ── WEEKLY GOALS ─────────────────────────────────────── */}
      <Card
        title="Weekly Goals"
        accentColor={Colors.green}
        headerRight={
          <Button
            title="Edit"
            size="sm"
            variant="outline"
            color={Colors.green}
            onPress={() => {
              setGoalEdits(Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, String(v)])));
              setGoalModal(true);
            }}
          />
        }
      >
        {GOAL_FIELDS.map((g, i) => (
          <View key={g.key} style={[styles.row, i === 0 && styles.rowFirst]}>
            <IconTile emoji={g.icon} color={g.color} />
            <Text style={[styles.rowLabel, styles.rowLabelFlex]}>{g.label}</Text>
            <View style={[styles.valPill, { backgroundColor: g.color + '14', borderColor: g.color + '2e' }]}>
              <Text style={[styles.valTxt, { color: g.color }]}>{goals[g.key]}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* ── DAILY HABITS ─────────────────────────────────────── */}
      <Card
        title="Daily Habits"
        accentColor={Colors.cyan}
        headerRight={
          <Button
            title="+ Add"
            size="sm"
            color={Colors.cyan}
            onPress={() => { setNewHabit(''); setHabitModal(true); }}
          />
        }
      >
        {habits.length === 0 ? (
          <Text style={styles.emptyText}>No habits yet. Add one to track it daily.</Text>
        ) : habits.map((h, i) => (
          <View key={h} style={[styles.row, i === 0 && styles.rowFirst]}>
            <View style={[styles.habitDotWrap, { backgroundColor: Colors.cyan + '18', borderColor: Colors.cyan + '2e' }]}>
              <View style={[styles.habitDot, { backgroundColor: Colors.cyan }]} />
            </View>
            <Text style={[styles.rowLabel, styles.rowLabelFlex]}>{h}</Text>
            <TouchableOpacity onPress={() => removeHabit(h)} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.6}>
              <Text style={styles.removeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>

      {/* ── DATA MANAGEMENT ──────────────────────────────────── */}
      <Card title="Data Management" accentColor={Colors.orange}>
        <Text style={styles.dataHint}>
          Export your data as JSON for backup. Keep this safe — it's the only copy.
        </Text>
        <View style={styles.btnRow}>
          <Button title="📤  Export" variant="outline" color={Colors.orange} style={{ flex: 1 }} onPress={exportData} />
          <Button title="📥  Import" variant="outline" color={Colors.accentLight} style={{ flex: 1 }} onPress={importData} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Button title="🗑️  Clear All Data" variant="danger" onPress={clearAllData} />
        </View>
      </Card>

      {/* ── ABOUT ────────────────────────────────────────────── */}
      <Card title="About LifeOS" accentColor={Colors.purple}>
        <View style={styles.aboutRow}>
          <IconTile emoji="⚡" color={Colors.purple} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aboutVersion}>LifeOS  ·  v1.2 (redesign)</Text>
            <Text style={styles.aboutDesc}>
              Your personal life operating system. All data is stored locally on your device — nothing leaves your phone.
            </Text>
            <Text style={styles.aboutTech}>React Native · Expo · AsyncStorage</Text>
          </View>
        </View>
      </Card>

      {/* ── MODALS ───────────────────────────────────────────── */}
      <ModalSheet visible={goalModal} onClose={() => setGoalModal(false)} title="Edit Weekly Goals" accentColor={Colors.green}>
        {GOAL_FIELDS.map(g => (
          <FormField
            key={g.key}
            label={`${g.icon}  ${g.label}`}
            value={goalEdits[g.key] || ''}
            onChangeText={v => setGoalEdits(p => ({ ...p, [g.key]: v }))}
            keyboardType="decimal-pad"
            placeholder={g.placeholder}
          />
        ))}
        <View style={styles.modalBtns}>
          <Button title="Cancel" variant="outline" onPress={() => setGoalModal(false)} />
          <Button title="Save Goals" onPress={saveGoals} color={Colors.green} />
        </View>
      </ModalSheet>

      <ModalSheet visible={habitModal} onClose={() => setHabitModal(false)} title="Add Habit" accentColor={Colors.cyan}>
        <FormField label="Habit Name" value={newHabit} onChangeText={setNewHabit} placeholder="e.g. Meditation, Cold Shower..." />
        <View style={styles.modalBtns}>
          <Button title="Cancel" variant="outline" onPress={() => setHabitModal(false)} />
          <Button title="Add Habit" onPress={() => { addHabit(); setHabitModal(false); }} color={Colors.cyan} />
        </View>
      </ModalSheet>

      <ModalSheet visible={notifModal} onClose={() => setNotifModal(false)} title="Reminder Times" accentColor={Colors.accentLight}>
        {REMINDER_FIELDS.map(f => (
          <TimeField
            key={f.key}
            label={`${f.icon}  ${f.label}`}
            value={notifEdits[f.key] || f.fallback}
            onChange={v => setNotifEdits(p => ({ ...p, [f.key]: v }))}
            accentColor={Colors.accentLight}
          />
        ))}
        <View style={styles.modalBtns}>
          <Button title="Cancel" variant="outline" onPress={() => setNotifModal(false)} />
          <Button title="Save" onPress={saveNotifSettings} color={Colors.accentLight} />
        </View>
      </ModalSheet>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 14, paddingTop: 8 },

  greet: { paddingHorizontal: 2, paddingTop: 6, paddingBottom: 14 },
  greetDay: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  greetHi: { color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 5 },

  // Shared setting row — tinted top hairline for quiet inner-highlight depth.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopColor: Colors.innerHighlight,
  },
  rowFirst: { marginTop: 0 },
  rowText: { flex: 1 },
  rowLabel: { color: Colors.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  rowLabelFlex: { flex: 1 },
  rowDesc: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3, letterSpacing: 0.2 },
  chevron: { color: Colors.textMuted, fontSize: 20, fontWeight: '600' },

  tile: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  tileEmoji: { fontSize: 17 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },

  valPill: {
    minWidth: 48, alignItems: 'center',
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1,
  },
  valTxt: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },

  habitDotWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  habitDot: { width: 9, height: 9, borderRadius: 5 },
  removeBtn: {
    width: 28, height: 28, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
  },
  removeTxt: { color: Colors.red, fontSize: 12, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500', paddingVertical: 6 },

  dataHint: { color: Colors.textSecondary, fontSize: 12, marginBottom: 14, lineHeight: 18 },

  aboutRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  aboutVersion: { color: Colors.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  aboutDesc: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  aboutTech: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, marginBottom: 20 },
});
