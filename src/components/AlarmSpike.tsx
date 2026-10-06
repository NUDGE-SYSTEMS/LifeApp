// SPIKE (spike/alarm-scheduler branch) — dev-only harness for trying
// react-native-alarm-scheduler before the Alarms tab is rebuilt on it.
// Not for release: rendered only under __DEV__, logs with a [spike] prefix.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AlarmScheduler from 'react-native-alarm-scheduler';

const log = (...a: unknown[]) => console.log('[spike]', ...a);

export function AlarmSpike() {
  const [status, setStatus] = useState('idle');

  const run = async (fn: () => Promise<unknown>, label: string) => {
    try {
      const r = await fn();
      log(label, JSON.stringify(r));
      setStatus(`${label}: ${JSON.stringify(r)}`);
    } catch (e: any) {
      log(label, 'ERROR', e?.message ?? String(e));
      setStatus(`${label} failed: ${e?.message ?? e}`);
    }
  };

  const scheduleIn = (seconds: number, soundUri?: string) => run(async () => {
    const perm = await AlarmScheduler.requestPermissionsAsync();
    log('permissions', JSON.stringify(perm));
    const at = new Date(Date.now() + seconds * 1000);
    return AlarmScheduler.scheduleAlarmAsync({
      id: 'spike-alarm',
      hour: at.getHours(),
      minute: at.getMinutes(),
      timestamp: at.getTime(),
      title: 'Spike alarm',
      soundUri,
      android: { alertBody: `Scheduled for ${at.toLocaleTimeString()}`, maxRingDurationSeconds: 120 },
    });
  }, `schedule+${seconds}s${soundUri ? ' snd' : ''}`);

  return (
    <View style={s.box}>
      <Text style={s.title}>SPIKE · react-native-alarm-scheduler</Text>
      <View style={s.row}>
        <Btn label="Perms" onPress={() => run(() => AlarmScheduler.getPermissionsAsync(), 'perms')} />
        <Btn label="+60s" onPress={() => scheduleIn(60)} />
        {/* Emulator's Cesium tone by its direct MediaStore URI — bypasses content://settings/system/alarm_alert */}
        <Btn label="snd" onPress={() => scheduleIn(60, 'content://media/internal/audio/media/9')} />
        <Btn label="List" onPress={() => run(() => AlarmScheduler.getScheduledAlarmsAsync(), 'list')} />
        <Btn label="Cancel" onPress={() => run(() => AlarmScheduler.cancelAlarmAsync('spike-alarm'), 'cancel')} />
      </View>
      <Text style={s.status} numberOfLines={4}>{status}</Text>
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.btn} onPress={onPress} accessibilityLabel={`spike-${label}`}>
      <Text style={s.btnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  box: { margin: 16, padding: 12, borderWidth: 1, borderColor: '#f59e0b', borderRadius: 10 },
  title: { color: '#f59e0b', fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#27272a', borderRadius: 8 },
  btnTxt: { color: '#fafafa' },
  status: { color: '#a1a1aa', marginTop: 8, fontSize: 12 },
});
