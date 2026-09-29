import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
  Alert, RefreshControl, TextInput, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, TAB_COLORS, TAB_PALETTE, radius } from '../../src/constants/theme';
import { getData, setData } from '../../src/utils/storage';
import { uid } from '../../src/utils/helpers';
import { requestPermissions, scheduleAlarmNotif, cancelAlarmNotifs } from '../../src/utils/notifications';
import { Button } from '../../src/components/Button';
import { ModalSheet } from '../../src/components/ModalSheet';
import { FormField } from '../../src/components/FormField';

const C = TAB_COLORS.settings;
const P = TAB_PALETTE.settings;

// Expo weekday: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
const DAYS = [
  { label: 'Su', value: 1 },
  { label: 'Mo', value: 2 },
  { label: 'Tu', value: 3 },
  { label: 'We', value: 4 },
  { label: 'Th', value: 5 },
  { label: 'Fr', value: 6 },
  { label: 'Sa', value: 7 },
];

export type Alarm = {
  id: string;
  label: string;
  timeH: number;       // 0–23
  timeM: number;       // 0–59
  days: number[];      // Expo weekdays; empty = one-time
  enabled: boolean;
  musicService: 'spotify' | 'apple_music' | 'none';
  musicUri: string;    // spotify:track/playlist:ID  or  music://...
  musicLabel: string;
  notifIds: string[];
};

function to12(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')} ${ampm}`;
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseDaysSummary(days: number[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [2, 3, 4, 5, 6].every(d => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && [1, 7].every(d => days.includes(d))) return 'Weekends';
  return days.map(d => DAYS.find(x => x.value === d)?.label).filter(Boolean).join(' ');
}

function parseSpotifyUri(input: string): string {
  const t = input.trim();
  if (t.startsWith('spotify:')) return t;
  const m = t.match(/open\.spotify\.com\/(track|playlist|album|artist)\/([A-Za-z0-9]+)/);
  if (m) return `spotify:${m[1]}:${m[2]}`;
  return t;
}

function parseAppleMusicUri(input: string): string {
  const t = input.trim();
  if (t.startsWith('music://')) return t;
  return t.replace(/^https:\/\/music\.apple\.com/, 'music://music.apple.com');
}

const MUSIC_ICON = { spotify: '🟢', apple_music: '🎵', none: '🔕' } as const;
const musicName = (s: Alarm['musicService']) =>
  s === 'spotify' ? 'Spotify' : s === 'apple_music' ? 'Apple Music' : 'None';

// Apple Music `music://` deep links only resolve on iOS — offering them on Android
// would just produce alarms that open nothing. Alarms saved on iOS still display
// correctly here; only the picker is narrowed.
const MUSIC_SERVICES: readonly Alarm['musicService'][] =
  Platform.OS === 'ios'
    ? (['none', 'spotify', 'apple_music'] as const)
    : (['none', 'spotify'] as const);

// Uppercase section header with the signature 3px accent bar (redesign v1).
function SectionLabel({ children }: { children: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionLabel}>{children}</Text>
    </View>
  );
}

// A single alarm row — hero-card feel: big time, calm meta chips, quiet enable switch.
function AlarmRow({ alarm, onPress, onLongPress, onToggle }: {
  alarm: Alarm;
  onPress: () => void;
  onLongPress: () => void;
  onToggle: () => void;
}) {
  const on = alarm.enabled;
  const dim = { color: Colors.textMuted };
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
      <View style={[styles.alarmCard, !on && styles.alarmCardDisabled]}>
        <View style={styles.hairline} pointerEvents="none" />
        {on && <View style={styles.enabledRail} pointerEvents="none" />}
        <View style={styles.alarmLeft}>
          <View style={styles.alarmTimeRow}>
            <Text style={[styles.alarmTime, !on && dim]}>{formatTime(alarm.timeH, alarm.timeM)}</Text>
            <Text style={[styles.alarmAmPm, !on && dim]}>{to12(alarm.timeH).split(' ')[1]}</Text>
          </View>
          <Text style={[styles.alarmLabel, !on && dim]} numberOfLines={1}>{alarm.label}</Text>
          <View style={styles.metaRow}>
            <View style={styles.dayPill}>
              <Text style={styles.dayPillTxt}>{parseDaysSummary(alarm.days)}</Text>
            </View>
            {alarm.musicService !== 'none' && (
              <View style={styles.musicChip}>
                <Text style={styles.musicChipTxt} numberOfLines={1}>
                  {MUSIC_ICON[alarm.musicService]} {alarm.musicLabel || musicName(alarm.musicService)}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Switch
          value={on}
          onValueChange={onToggle}
          trackColor={{ false: Colors.surfaceHighest, true: C + '60' }}
          thumbColor={on ? C : Colors.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function AlarmsScreen() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Alarm | null>(null);

  // Form state
  const [fLabel, setFLabel] = useState('');
  const [fHour, setFHour] = useState('07');
  const [fMin, setFMin] = useState('00');
  const [fDays, setFDays] = useState<number[]>([2, 3, 4, 5, 6]);
  const [fService, setFService] = useState<Alarm['musicService']>('none');
  const [fUri, setFUri] = useState('');
  const [fMusicLabel, setFMusicLabel] = useState('');

  const loadData = useCallback(async () => {
    setAlarms(await getData<Alarm[]>('alarms', []));
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadData(); setRefreshing(false);
  }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setFLabel(''); setFHour('07'); setFMin('00');
    setFDays([2, 3, 4, 5, 6]); setFService('none');
    setFUri(''); setFMusicLabel('');
    setModal(true);
  };

  const openEdit = (alarm: Alarm) => {
    setEditing(alarm);
    setFLabel(alarm.label);
    setFHour(String(alarm.timeH).padStart(2, '0'));
    setFMin(String(alarm.timeM).padStart(2, '0'));
    setFDays([...alarm.days]);
    setFService(alarm.musicService);
    setFUri(alarm.musicUri);
    setFMusicLabel(alarm.musicLabel);
    setModal(true);
  };

  const toggleDay = (d: number) => {
    setFDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const applyMusicUri = (): string => {
    if (fService === 'spotify') return parseSpotifyUri(fUri);
    if (fService === 'apple_music') return parseAppleMusicUri(fUri);
    return '';
  };

  const saveAlarm = async () => {
    const h = parseInt(fHour, 10);
    const m = parseInt(fMin, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      Alert.alert('Invalid Time', 'Enter a valid 24h time (HH: 00-23, MM: 00-59).');
      return;
    }
    if (fService !== 'none' && !fUri.trim()) {
      Alert.alert('Missing Link', 'Paste a Spotify or Apple Music link.');
      return;
    }

    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert('Permission Required', 'Allow notifications so alarms can fire.');
      return;
    }

    const musicUri = applyMusicUri();
    const base: Omit<Alarm, 'id' | 'notifIds'> = {
      label: fLabel.trim() || 'Alarm',
      timeH: h, timeM: m,
      days: [...fDays].sort(),
      enabled: true,
      musicService: fService,
      musicUri,
      musicLabel: fMusicLabel.trim(),
    };

    const all = [...alarms];
    if (editing) {
      // Cancel old notifications
      await cancelAlarmNotifs(editing.notifIds);
      const idx = all.findIndex(a => a.id === editing.id);
      const updated: Alarm = { ...base, id: editing.id, notifIds: [] };
      const notifIds = await scheduleAlarmNotif(updated);
      updated.notifIds = notifIds;
      all[idx] = updated;
    } else {
      const alarm: Alarm = { ...base, id: uid(), notifIds: [] };
      const notifIds = await scheduleAlarmNotif(alarm);
      alarm.notifIds = notifIds;
      all.push(alarm);
    }

    await setData('alarms', all);
    setAlarms(all);
    setModal(false);
  };

  const toggleEnabled = async (alarm: Alarm) => {
    const all = [...alarms];
    const idx = all.findIndex(a => a.id === alarm.id);
    if (alarm.enabled) {
      await cancelAlarmNotifs(alarm.notifIds);
      all[idx] = { ...alarm, enabled: false, notifIds: [] };
    } else {
      const granted = await requestPermissions();
      if (!granted) { Alert.alert('Permission Required', 'Allow notifications so alarms can fire.'); return; }
      const notifIds = await scheduleAlarmNotif(alarm);
      all[idx] = { ...alarm, enabled: true, notifIds };
    }
    await setData('alarms', all);
    setAlarms(all);
  };

  const deleteAlarm = (alarm: Alarm) => {
    Alert.alert('Delete Alarm?', `"${alarm.label}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await cancelAlarmNotifs(alarm.notifIds);
          const updated = alarms.filter(a => a.id !== alarm.id);
          await setData('alarms', updated);
          setAlarms(updated);
        },
      },
    ]);
  };

  const spinHour = (d: number) => setFHour(h => String(((parseInt(h) || 0) + d + 24) % 24).padStart(2, '0'));
  const spinMin = (d: number) => setFMin(m => String(((parseInt(m) || 0) + d + 60) % 60).padStart(2, '0'));

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C} />}
    >
      {/* Info banner */}
      <View style={styles.infoBanner}>
        <View style={styles.hairline} pointerEvents="none" />
        <View style={styles.infoIconWrap}>
          <Text style={styles.infoIcon}>⏰</Text>
        </View>
        <Text style={styles.infoText}>
          {Platform.OS === 'ios'
            ? 'Alarms ring as a notification. Tap it to instantly open your chosen Spotify or Apple Music track.'
            : 'Alarms ring as a notification. Tap it to instantly open your chosen Spotify track.'}
        </Text>
      </View>

      {/* Section header + add */}
      <View style={styles.listHead}>
        <SectionLabel>Your Alarms</SectionLabel>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.75}>
          <Text style={styles.addBtnTxt}>+  Add</Text>
        </TouchableOpacity>
      </View>

      {alarms.length === 0 && (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>⏰</Text>
          </View>
          <Text style={styles.emptyTitle}>No alarms yet</Text>
          <Text style={styles.emptyDesc}>Tap “+ Add” to create your first alarm</Text>
        </View>
      )}

      {alarms.map(alarm => (
        <AlarmRow
          key={alarm.id}
          alarm={alarm}
          onPress={() => openEdit(alarm)}
          onLongPress={() => deleteAlarm(alarm)}
          onToggle={() => toggleEnabled(alarm)}
        />
      ))}

      {alarms.length > 0 && (
        <Text style={styles.hint}>Long-press an alarm to delete it</Text>
      )}

      <View style={{ height: 30 }} />

      {/* Add / Edit Modal */}
      <ModalSheet
        visible={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Alarm' : 'New Alarm'}
        accentColor={C}
      >
        <FormField label="Label" value={fLabel} onChangeText={setFLabel} placeholder="Wake Up, Nap, Wind Down…" />

        {/* Time */}
        <SectionLabel>Time</SectionLabel>
        <View style={styles.timeRow}>
          <View style={styles.timeBox}>
            <TouchableOpacity onPress={() => spinHour(1)} style={styles.timeArrow}>
              <Text style={styles.timeArrowTxt}>▲</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.timeInput}
              value={fHour}
              onChangeText={v => setFHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <TouchableOpacity onPress={() => spinHour(-1)} style={styles.timeArrow}>
              <Text style={styles.timeArrowTxt}>▼</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.timeSep}>:</Text>
          <View style={styles.timeBox}>
            <TouchableOpacity onPress={() => spinMin(1)} style={styles.timeArrow}>
              <Text style={styles.timeArrowTxt}>▲</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.timeInput}
              value={fMin}
              onChangeText={v => setFMin(v.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <TouchableOpacity onPress={() => spinMin(-1)} style={styles.timeArrow}>
              <Text style={styles.timeArrowTxt}>▼</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.ampmPill}>
            <Text style={styles.ampmPillTxt}>{parseInt(fHour, 10) < 12 ? 'AM' : 'PM'}</Text>
          </View>
        </View>

        {/* Days */}
        <SectionLabel>Repeat</SectionLabel>
        <View style={styles.daysRow}>
          {DAYS.map(d => {
            const sel = fDays.includes(d.value);
            return (
              <TouchableOpacity
                key={d.value}
                style={[styles.dayChip, sel && { backgroundColor: P.bgMid, borderColor: P.border }]}
                onPress={() => toggleDay(d.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayChipTxt, sel && { color: P.text }]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.dayShortcuts}>
          <TouchableOpacity style={styles.shortcut} onPress={() => setFDays([1, 2, 3, 4, 5, 6, 7])}>
            <Text style={styles.shortcutTxt}>Every day</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcut} onPress={() => setFDays([2, 3, 4, 5, 6])}>
            <Text style={styles.shortcutTxt}>Weekdays</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcut} onPress={() => setFDays([1, 7])}>
            <Text style={styles.shortcutTxt}>Weekends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcut} onPress={() => setFDays([])}>
            <Text style={styles.shortcutTxt}>Once</Text>
          </TouchableOpacity>
        </View>

        {/* Music Service */}
        <SectionLabel>Music · optional</SectionLabel>
        <View style={styles.serviceRow}>
          {MUSIC_SERVICES.map(s => {
            const sel = fService === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.serviceBtn, sel && { borderColor: P.border, backgroundColor: P.bgMid }]}
                onPress={() => setFService(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.serviceBtnIcon}>{MUSIC_ICON[s]}</Text>
                <Text style={[styles.serviceBtnTxt, sel && { color: P.text }]}>{musicName(s)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {fService !== 'none' && (
          <>
            <FormField
              label={fService === 'spotify' ? 'Spotify link or URI' : 'Apple Music link'}
              value={fUri}
              onChangeText={setFUri}
              placeholder={fService === 'spotify'
                ? 'https://open.spotify.com/playlist/…'
                : 'https://music.apple.com/…'}
            />
            <Text style={styles.uriHint}>
              {fService === 'spotify'
                ? 'Paste any Spotify link — it converts automatically to a URI'
                : 'Paste any Apple Music link'}
            </Text>
            <FormField
              label="Track / Playlist name (shown on alarm)"
              value={fMusicLabel}
              onChangeText={setFMusicLabel}
              placeholder="Morning Vibes"
            />
          </>
        )}

        <View style={styles.modalBtns}>
          <Button title="Cancel" variant="outline" onPress={() => setModal(false)} />
          <Button title={editing ? 'Update Alarm' : 'Save Alarm'} onPress={saveAlarm} color={C} />
        </View>
      </ModalSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 14, paddingTop: 8 },

  // Shared 1px inner top-highlight hairline (redesign v1 — quiet depth, no drop shadows)
  hairline: { position: 'absolute', top: 0, left: 14, right: 14, height: 1, backgroundColor: Colors.innerHighlight },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16, overflow: 'hidden',
  },
  infoIconWrap: {
    width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: P.bg, borderWidth: 1, borderColor: P.border,
  },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, color: Colors.textSecondary, fontSize: 12.5, lineHeight: 18, fontWeight: '500' },

  // Section header (accent-bar + uppercase label) — matches redesign section style
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 12 },
  sectionBar: { width: 3, height: 13, borderRadius: 2, backgroundColor: C, opacity: 0.9 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },

  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: P.bgMid, borderWidth: 1, borderColor: P.border,
  },
  addBtnTxt: { color: P.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  empty: { alignItems: 'center', paddingVertical: 54 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '800', marginBottom: 6, letterSpacing: -0.3 },
  emptyDesc: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },

  alarmCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: radius.lg, padding: 18,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: 'hidden',
  },
  alarmCardDisabled: { opacity: 0.55 },
  enabledRail: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: 2, backgroundColor: C, opacity: 0.85 },
  alarmLeft: { flex: 1, marginRight: 12 },
  alarmTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  alarmTime: { color: Colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1.5 },
  alarmAmPm: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  alarmLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dayPill: {
    backgroundColor: Colors.surfaceHigh, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border,
  },
  dayPillTxt: { color: Colors.textSecondary, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 },
  musicChip: {
    backgroundColor: P.bg, borderRadius: radius.pill, maxWidth: 190,
    paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: P.border,
  },
  musicChipTxt: { color: P.text, fontSize: 10.5, fontWeight: '700' },

  hint: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, fontWeight: '500', marginTop: 6 },

  // Time picker — tidy stat-tile boxes
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  timeBox: { alignItems: 'center', gap: 4 },
  timeArrow: { paddingHorizontal: 20, paddingVertical: 5 },
  timeArrowTxt: { color: Colors.textMuted, fontSize: 13 },
  timeInput: {
    width: 78, height: 62, borderRadius: radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    textAlign: 'center', color: Colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5,
  },
  timeSep: { color: Colors.textSecondary, fontSize: 30, fontWeight: '800', marginBottom: 2 },
  ampmPill: {
    marginLeft: 4, backgroundColor: P.bgMid, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: P.border,
  },
  ampmPillTxt: { color: P.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },

  daysRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dayChip: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center',
  },
  dayChipTxt: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  dayShortcuts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 18 },
  shortcut: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
  },
  shortcutTxt: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },

  serviceRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  serviceBtn: {
    flex: 1, paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', gap: 5,
  },
  serviceBtnIcon: { fontSize: 20 },
  serviceBtnTxt: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },

  uriHint: { color: Colors.textMuted, fontSize: 10.5, marginTop: -8, marginBottom: 12, lineHeight: 15 },

  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, marginBottom: 20 },
});
