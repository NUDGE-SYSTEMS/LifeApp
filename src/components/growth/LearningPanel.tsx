import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Dimensions, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, LEARNING_ROTATION, TAB_COLORS, TAB_PALETTE, radius } from '../../constants/theme';
import { TODAY, addDays, getDayOfWeek, uid } from '../../utils/helpers';
import { getData, setData } from '../../utils/storage';
import { Card } from '../Card';
import { Button } from '../Button';
import { ProgressBar } from '../ProgressBar';
import { ModalSheet } from '../ModalSheet';
import { FormField } from '../FormField';
import { AreaChart } from '../AreaChart';

const C = TAB_COLORS.learning; // orange
const P = TAB_PALETTE.learning;
const chartW = Dimensions.get('window').width - 60; // window − container(28) − card(32)

// Smooth SVG weekly-trend, replacing the old chart-kit bars.
function WeeklyTrend({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const thisWk = data[data.length - 1] ?? 0;
  const prev = data[data.length - 2] ?? 0;
  const delta = thisWk - prev;
  const up = delta >= 0;
  return (
    <View>
      <View style={styles.trendHead}>
        <View>
          <Text style={[styles.trendValue, { color }]}>{thisWk.toFixed(1)}<Text style={styles.trendUnit}>h</Text></Text>
          <Text style={styles.trendCaption}>this week</Text>
        </View>
        {(thisWk > 0 || prev > 0) && (
          <View style={[styles.trendPill, { backgroundColor: color + '18' }]}>
            <Text style={[styles.trendPillTxt, { color }]}>{up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}h</Text>
          </View>
        )}
      </View>
      <AreaChart data={data} width={chartW} height={100} color={color} min={0} strokeWidth={2.6} />
      <View style={styles.trendLabels}>
        {labels.map((l, i) => (
          <Text key={i} style={[styles.trendLabel, i === labels.length - 1 && { color, fontWeight: '800' }]}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

type Domain = { id: string; name: string };
type StudyLog = { id: string; domainId: string; domainName: string; hours: number; topic: string; date: string; createdAt: string };

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function LearningPanel() {
  const [logDate, setLogDate] = useState(TODAY());
  const [refreshing, setRefreshing] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [rotation, setRotation] = useState<Record<number, string[]>>(LEARNING_ROTATION);
  const [modalOpen, setModalOpen] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [selDomain, setSelDomain] = useState('');
  const [hours, setHours] = useState('');
  const [topic, setTopic] = useState('');
  const [newDomain, setNewDomain] = useState('');
  // Rotation edit buffer: day -> [block1, block2]
  const [rotEdit, setRotEdit] = useState<Record<number, string[]>>({});

  const defaultDomains = [
    { id: 'ld1', name: 'Stock Market' }, { id: 'ld2', name: 'Forex' },
    { id: 'ld3', name: 'Quantitative Finance' }, { id: 'ld4', name: 'Artificial Intelligence' },
    { id: 'ld5', name: 'Research Work' },
  ];

  const loadData = useCallback(async () => {
    setDomains(await getData('learningDomains', defaultDomains));
    setLogs(await getData('studyLogs', []));
    setRotation(await getData('learningRotation', LEARNING_ROTATION));
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadData(); setRefreshing(false); }, [loadData]);

  const openManage = () => {
    // Deep copy rotation into edit buffer
    const buf: Record<number, string[]> = {};
    for (let d = 1; d <= 5; d++) buf[d] = [...(rotation[d] || ['', ''])];
    setRotEdit(buf);
    setManageModal(true);
  };

  const saveRotation = async () => {
    const cleaned: Record<number, string[]> = {};
    for (let d = 1; d <= 5; d++) cleaned[d] = (rotEdit[d] || ['', '']).map(s => s.trim()).filter(Boolean);
    setRotation(cleaned);
    await setData('learningRotation', cleaned);
    setManageModal(false);
  };

  const prevDay = () => setLogDate(d => addDays(d, -1));
  const nextDay = () => { if (logDate < TODAY()) setLogDate(d => addDays(d, 1)); };
  const dateLabel = logDate === TODAY() ? 'Today' : new Date(logDate + 'T12:00').toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });

  const dow = getDayOfWeek(TODAY());
  const todayRotation = dow >= 1 && dow <= 5 ? rotation[dow] : null;

  const adjustStudy = async (domainId: string, domainName: string, delta: number) => {
    const current = [...logs];
    const idx = current.findIndex(l => l.domainId === domainId && l.date === logDate);
    const currentHours = idx >= 0 ? current[idx].hours : 0;
    const newHours = Math.max(0, Math.round((currentHours + delta) * 2) / 2);
    if (idx >= 0) {
      if (newHours === 0) current.splice(idx, 1);
      else current[idx] = { ...current[idx], hours: newHours };
    } else if (newHours > 0) {
      current.push({ id: uid(), domainId, domainName, hours: newHours, topic: '', date: logDate, createdAt: new Date().toISOString() });
    }
    setLogs(current);
    await setData('studyLogs', current);
  };

  const saveLog = async () => {
    const h = parseFloat(hours);
    if (!selDomain) { Alert.alert('Select Course', 'Please select a course first.'); return; }
    if (!h || h <= 0) { Alert.alert('Invalid Hours', 'Enter a positive number of hours.'); return; }
    const domain = domains.find(d => d.id === selDomain);
    const updated = [...logs, { id: uid(), domainId: selDomain, domainName: domain?.name || '', hours: h, topic, date: TODAY(), createdAt: new Date().toISOString() }];
    setLogs(updated);
    await setData('studyLogs', updated);
    setModalOpen(false); setHours(''); setTopic('');
  };

  const addDomainFn = async () => {
    if (!newDomain.trim()) return;
    const updated = [...domains, { id: uid(), name: newDomain.trim() }];
    setDomains(updated); await setData('learningDomains', updated); setNewDomain('');
  };

  const deleteDomain = (id: string, name: string) => {
    Alert.alert('Remove Course', `Remove "${name}" from your course list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const updated = domains.filter(d => d.id !== id);
          setDomains(updated); await setData('learningDomains', updated);
        },
      },
    ]);
  };

  const weeklyData = (() => {
    const labels: string[] = [], values: number[] = [];
    for (let w = 3; w >= 0; w--) {
      let total = 0;
      for (let d = 0; d < 7; d++) total += logs.filter(l => l.date === addDays(TODAY(), -(w * 7 + d))).reduce((s, l) => s + l.hours, 0);
      labels.push(w === 0 ? 'This wk' : `${w}w ago`);
      values.push(total);
    }
    return { labels, values };
  })();

  const recentLogs = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C} />}>
      {/* Date Navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateNavBtn} onPress={prevDay}>
          <Text style={styles.dateNavArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateNavLabel}>{dateLabel}</Text>
        <TouchableOpacity style={[styles.dateNavBtn, logDate >= TODAY() && { opacity: 0.3 }]} onPress={nextDay} disabled={logDate >= TODAY()}>
          <Text style={styles.dateNavArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Today's Learning — Study Hours */}
      <Card
        title="Today's Learning"
        accentColor={C}
        headerRight={
          <Button title="+ Notes" size="sm" variant="outline" color={C}
            onPress={() => { setSelDomain(domains[0]?.id || ''); setModalOpen(true); }} />
        }
      >
        {domains.map(d => {
          const todayH = logs.filter(l => l.domainId === d.id && l.date === logDate).reduce((s, l) => s + l.hours, 0);
          return (
            <View key={d.id} style={styles.actRow}>
              <Text style={styles.actLabel}>{d.name}</Text>
              <View style={styles.actStepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustStudy(d.id, d.name, -0.5)}>
                  <Text style={styles.stepBtnTxt}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.actHours, { color: todayH > 0 ? C : Colors.textMuted }]}>
                  {todayH.toFixed(1)}h
                </Text>
                <TouchableOpacity style={[styles.stepBtn, { backgroundColor: C + '25' }]} onPress={() => adjustStudy(d.id, d.name, 0.5)}>
                  <Text style={[styles.stepBtnTxt, { color: C }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {domains.length === 0 && <Text style={styles.emptyText}>Add courses in Manage to start tracking.</Text>}
      </Card>

      {/* Today's Rotation */}
      <Card title="Today's Rotation" accentColor={C}>
        {todayRotation && todayRotation.length > 0 ? (
          <>
            <Text style={styles.dayLabel}>{dow >= 1 && dow <= 5 ? DAY_NAMES[dow] : ''}</Text>
            {todayRotation.map((name, i) => (
              <View key={i} style={[styles.rotCard, { borderLeftColor: i === 0 ? C : P.text }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rotTitle}>{name}</Text>
                  <Text style={styles.rotTime}>Block {i + 1}  ·  {i === 0 ? '9:00–9:40 PM' : '9:40–10:20 PM'}</Text>
                </View>
                <View style={[styles.blockBadge, { backgroundColor: i === 0 ? P.bgMid : P.bg }]}>
                  <Text style={[styles.blockBadgeTxt, { color: i === 0 ? C : P.text }]}>B{i + 1}</Text>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.weekendBanner}>
            <Text style={{ fontSize: 30 }}>{dow === 6 ? '🎯' : dow === 0 ? '🔬' : '📚'}</Text>
            <Text style={styles.weekendText}>
              {dow === 6
                ? 'Saturday: Focus on Skills!'
                : dow === 0
                  ? 'Sunday: Research Work (1:30–3:30 PM)'
                  : `No rotation set for ${DAY_NAMES[dow]} — add one in Manage.`}
            </Text>
          </View>
        )}
      </Card>

      {/* Study Progress */}
      <Card title="Study Progress" accentColor={C}>
        {domains.length === 0 ? (
          <Text style={styles.emptyText}>No courses yet. Add courses in Manage.</Text>
        ) : domains.map(d => {
          const th = logs.filter(l => l.domainId === d.id).reduce((s, l) => s + l.hours, 0);
          const pct = Math.min(100, (th / 50) * 100);
          return (
            <View key={d.id} style={styles.progressItem}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressName}>{d.name}</Text>
                <Text style={[styles.progressHours, { color: C }]}>{th.toFixed(1)} hrs</Text>
              </View>
              <ProgressBar progress={pct} color={C} height={5} />
            </View>
          );
        })}
      </Card>

      {/* Recent Study Log */}
      <Card title="Recent Study Log" accentColor={C}>
        {recentLogs.length === 0 ? (
          <Text style={styles.emptyText}>No logs yet. Start studying and log your hours!</Text>
        ) : recentLogs.map(l => (
          <View key={l.id} style={styles.logEntry}>
            <View style={[styles.logIconBox, { backgroundColor: C + '20' }]}>
              <Text style={{ fontSize: 16 }}>📖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logCourse}>{l.domainName}</Text>
              {l.topic ? <Text style={styles.logTopic}>{l.topic}</Text> : null}
              <Text style={styles.logDate}>{l.date}</Text>
            </View>
            <Text style={[styles.logHours, { color: C }]}>{l.hours}h</Text>
          </View>
        ))}
      </Card>

      {/* Weekly Chart */}
      <Card title="Weekly Study Hours" accentColor={C}>
        <WeeklyTrend data={weeklyData.values} labels={weeklyData.labels} color={C} />
      </Card>

      {/* Manage Button */}
      <TouchableOpacity style={styles.manageBtn} onPress={openManage}>
        <Text style={styles.manageBtnIcon}>⚙️</Text>
        <Text style={styles.manageBtnText}>Manage</Text>
      </TouchableOpacity>

      {/* Log Hours Modal */}
      <ModalSheet visible={modalOpen} onClose={() => setModalOpen(false)} title="Log Study Hours" accentColor={C}>
        <FormField label="Course">
          <View style={styles.catGrid}>
            {domains.map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.catBtn, selDomain === d.id && { borderColor: C, backgroundColor: C + '20' }]}
                onPress={() => setSelDomain(d.id)}
              >
                <Text style={[styles.catBtnText, selDomain === d.id && { color: C }]}>{d.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FormField>
        <FormField label="Hours" value={hours} onChangeText={setHours} placeholder="1.5" keyboardType="decimal-pad" />
        <FormField label="Topic / Notes" value={topic} onChangeText={setTopic} placeholder="What did you study?" />
        <View style={styles.modalActions}>
          <Button title="Cancel" variant="outline" onPress={() => setModalOpen(false)} />
          <Button title="Save" onPress={saveLog} color={C} />
        </View>
      </ModalSheet>

      {/* Manage Modal */}
      <ModalSheet visible={manageModal} onClose={() => setManageModal(false)} title="Manage Learning" accentColor={C}>
        {/* Manage Courses */}
        <Text style={styles.manageSection}>Courses</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newDomain}
            onChangeText={setNewDomain}
            placeholder="New course name..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={addDomainFn}
            returnKeyType="done"
          />
          <Button title="+ Add" size="sm" color={C} onPress={addDomainFn} />
        </View>
        {domains.map(d => (
          <View key={d.id} style={styles.courseItem}>
            <View style={[styles.courseDot, { backgroundColor: C }]} />
            <Text style={styles.courseName}>{d.name}</Text>
            <TouchableOpacity onPress={() => deleteDomain(d.id, d.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: Colors.red, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Rotation Editor */}
        <Text style={[styles.manageSection, { marginTop: 20 }]}>Weekly Rotation</Text>
        {[1, 2, 3, 4, 5].map(d => (
          <View key={d} style={styles.rotEditRow}>
            <Text style={styles.rotEditDay}>{DAY_NAMES[d].slice(0, 3)}</Text>
            <View style={{ flex: 1, gap: 6 }}>
              {[0, 1].map(b => (
                <TextInput
                  key={b}
                  style={styles.rotEditInput}
                  value={rotEdit[d]?.[b] ?? ''}
                  onChangeText={(val) => {
                    const copy = { ...rotEdit };
                    if (!copy[d]) copy[d] = ['', ''];
                    copy[d] = [...copy[d]];
                    copy[d][b] = val;
                    setRotEdit(copy);
                  }}
                  placeholder={`Block ${b + 1}...`}
                  placeholderTextColor={Colors.textMuted}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={styles.modalActions}>
          <Button title="Cancel" variant="outline" onPress={() => setManageModal(false)} />
          <Button title="Save" onPress={saveRotation} color={C} />
        </View>
      </ModalSheet>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 14, paddingTop: 8 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 12 },
  dateNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  dateNavArrow: { color: Colors.text, fontSize: 24, fontWeight: '300', lineHeight: 28 },
  dateNavLabel: { color: Colors.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  actRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  actLabel: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  actStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  stepBtnTxt: { color: Colors.textSecondary, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  actHours: { fontSize: 16, fontWeight: '800', minWidth: 42, textAlign: 'center', letterSpacing: -0.3 },
  dayLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  rotCard: { backgroundColor: Colors.surface, borderLeftWidth: 3, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  rotTitle: { color: Colors.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  rotTime: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 3 },
  blockBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  blockBadgeTxt: { fontSize: 13, fontWeight: '800' },
  weekendBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  weekendText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', flex: 1 },
  progressItem: { backgroundColor: Colors.surface, borderRadius: 14, padding: 12, marginBottom: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  progressHours: { fontSize: 13, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  logEntry: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 12, marginBottom: 6, gap: 10 },
  logIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logCourse: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  logTopic: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  logDate: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  logHours: { fontSize: 16, fontWeight: '800' },
  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 16, paddingVertical: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  manageBtnIcon: { fontSize: 18 },
  manageBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  manageSection: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addInput: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, color: Colors.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  courseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 6, gap: 10 },
  courseDot: { width: 8, height: 8, borderRadius: 4 },
  courseName: { color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  rotEditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  rotEditDay: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', width: 32, paddingTop: 10 },
  rotEditInput: { backgroundColor: Colors.surface, borderRadius: 10, color: Colors.text, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, borderWidth: 1, borderColor: Colors.border },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  catBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10, marginBottom: 20 },
  trendHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  trendValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  trendUnit: { fontSize: 15, fontWeight: '700', color: Colors.textMuted },
  trendCaption: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 },
  trendPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  trendPillTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  trendLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  trendLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
