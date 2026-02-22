import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import dayjs from 'dayjs';
import {
  getAttendanceByUserAndDate,
  createAttendance,
  updateAttendance,
  getCommittedMinutesForDate,
  getHolidays,
  getCommitmentHistory,
} from '@/services/data';

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min}m`;
}

export default function HomeScreen() {
  const { dbUser } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [today] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [attendance, setAttendance] = useState<Awaited<ReturnType<typeof getAttendanceByUserAndDate>>>(null);
  const [committedMinutes, setCommittedMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isCheckedIn = !!attendance && !attendance.checkOutTime;

  useEffect(() => {
    if (!dbUser) return;
    let cancelled = false;
    (async () => {
      const [att, holidays, history] = await Promise.all([
        getAttendanceByUserAndDate(dbUser._id, today),
        getHolidays(dbUser._id),
        getCommitmentHistory(dbUser._id),
      ]);
      if (cancelled) return;
      setAttendance(att);
      setCommittedMinutes(getCommittedMinutesForDate(dbUser, today, holidays, history));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dbUser, today]);

  useEffect(() => {
    if (!isCheckedIn || !attendance) return;
    const checkIn = dayjs(`${today}T${attendance.checkInTime}`);
    const tick = () => setElapsed(dayjs().diff(checkIn, 'second'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isCheckedIn, attendance?.checkInTime, today]);

  async function handleCheckIn() {
    if (!dbUser) return;
    if (attendance) {
      Alert.alert('Already checked in', 'You have already checked in today.');
      return;
    }
    setActionLoading(true);
    try {
      const now = dayjs();
      const timeStr = now.format('HH:mm');
      const att = await createAttendance(dbUser._id, today, timeStr, undefined, undefined, false);
      setAttendance(att);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!dbUser || !attendance) return;
    if (attendance.checkOutTime) {
      Alert.alert('Already checked out', 'You have already checked out today.');
      return;
    }
    setActionLoading(true);
    try {
      const now = dayjs();
      const timeStr = now.format('HH:mm');
      const updated = await updateAttendance(attendance._id, { checkOutTime: timeStr });
      if (updated) setAttendance(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (!dbUser) return null;
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const workedMinutes = attendance?.totalWorkedMinutes ?? 0;
  const diff = workedMinutes - committedMinutes;
  const isOvertime = diff > 0;
  const isShort = committedMinutes > 0 && diff < 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.date, { color: c.muted }]}>{dayjs().format('dddd, MMM D, YYYY')}</Text>

      {isCheckedIn && (
        <View style={[styles.timerBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.timerLabel, { color: c.muted }]}>Time elapsed</Text>
          <Text style={[styles.timer, { color: c.primary }]}>
            {Math.floor(elapsed / 3600)}:{(Math.floor(elapsed / 60) % 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}
          </Text>
        </View>
      )}

      <View style={[styles.statsRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.muted }]}>Worked</Text>
          <Text style={[styles.statValue, { color: c.text }]}>{formatMinutes(workedMinutes)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.muted }]}>Committed</Text>
          <Text style={[styles.statValue, { color: c.text }]}>{formatMinutes(committedMinutes)}</Text>
        </View>
      </View>

      {committedMinutes > 0 && (
        <View style={styles.diffRow}>
          {isOvertime && <Text style={[styles.diffText, { color: Colors.status.overtime }]}>+{formatMinutes(diff)} overtime</Text>}
          {isShort && <Text style={[styles.diffText, { color: Colors.status.short }]}>−{formatMinutes(-diff)} short</Text>}
          {!isOvertime && !isShort && workedMinutes > 0 && <Text style={[styles.diffText, { color: Colors.status.complete }]}>Complete</Text>}
        </View>
      )}

      <View style={styles.actions}>
        {!attendance ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
            onPress={handleCheckIn}
            disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Check In</Text>}
          </TouchableOpacity>
        ) : attendance.checkOutTime ? (
          <Text style={[styles.doneText, { color: c.muted }]}>You're done for today</Text>
        ) : (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: c.primary }]}
            onPress={handleCheckOut}
            disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color={c.primary} /> : <Text style={[styles.secondaryBtnText, { color: c.primary }]}>Check Out</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  date: { fontSize: 16, marginBottom: 24 },
  timerBox: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  timerLabel: { fontSize: 14, marginBottom: 8 },
  timer: { fontSize: 42, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 20, marginBottom: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '600' },
  diffRow: { marginBottom: 24 },
  diffText: { fontSize: 16, fontWeight: '600' },
  actions: { marginTop: 'auto', paddingBottom: 24 },
  primaryBtn: { borderRadius: 12, padding: 18, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  secondaryBtn: { borderWidth: 2, borderRadius: 12, padding: 18, alignItems: 'center' },
  secondaryBtnText: { fontSize: 18, fontWeight: '600' },
  doneText: { textAlign: 'center', fontSize: 16 },
});
