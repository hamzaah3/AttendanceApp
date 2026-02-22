import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import dayjs from 'dayjs';
import Svg, { Circle } from 'react-native-svg';
import {
  getAttendancesByUserAndDate,
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

const RING_SIZE = 160;
const STROKE = 12;
const R = (RING_SIZE - STROKE) / 2;
const CX = RING_SIZE / 2;
const CY = RING_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

function ProgressRing({
  progress,
  color,
  trackColor,
}: {
  progress: number;
  color: string;
  trackColor: string;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const strokeDashoffset = CIRCUMFERENCE - clamped * CIRCUMFERENCE;
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
      <Circle
        cx={CX}
        cy={CY}
        r={R}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />
      <Circle
        cx={CX}
        cy={CY}
        r={R}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${CX} ${CY})`}
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const { dbUser } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const today = dayjs().format('YYYY-MM-DD');
  const [sessionsToday, setSessionsToday] = useState<Awaited<ReturnType<typeof getAttendancesByUserAndDate>>>([]);
  const [committedMinutes, setCommittedMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const currentSession = sessionsToday.find((s) => !s.checkOutTime) ?? null;
  const isCheckedIn = !!currentSession;

  const fetchToday = useCallback(async () => {
    if (!dbUser) return;
    const [sessions, holidays, history] = await Promise.all([
      getAttendancesByUserAndDate(dbUser._id, today),
      getHolidays(dbUser._id),
      getCommitmentHistory(dbUser._id),
    ]);
    setSessionsToday(sessions);
    setCommittedMinutes(getCommittedMinutesForDate(dbUser, today, holidays, history));
    setLoading(false);
  }, [dbUser, today]);

  useEffect(() => {
    if (!dbUser) return;
    setLoading(true);
    fetchToday();
  }, [dbUser, today]);

  useFocusEffect(
    useCallback(() => {
      if (dbUser) fetchToday();
    }, [dbUser, fetchToday])
  );

  useEffect(() => {
    if (!isCheckedIn || !currentSession) return;
    const checkIn = dayjs(`${currentSession.date}T${currentSession.checkInTime}`);
    const tick = () => setElapsed(Math.max(0, dayjs().diff(checkIn, 'second')));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isCheckedIn, currentSession?.date, currentSession?.checkInTime]);

  async function handleCheckIn() {
    if (!dbUser) return;
    if (currentSession) {
      Alert.alert('Already checked in', 'Check out first, then you can check in again.');
      return;
    }
    setActionLoading(true);
    try {
      const now = dayjs();
      const timeStr = now.format('HH:mm');
      const att = await createAttendance(dbUser._id, today, timeStr, undefined, undefined, false);
      setSessionsToday((prev) => [...prev, att].sort((a, b) => a.checkInTime.localeCompare(b.checkInTime)));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!dbUser || !currentSession) return;
    if (currentSession.checkOutTime) {
      Alert.alert('Already checked out', 'You can check in again to start a new session.');
      return;
    }
    setActionLoading(true);
    try {
      const now = dayjs();
      const timeStr = now.format('HH:mm');
      const updated = await updateAttendance(currentSession._id, { checkOutTime: timeStr });
      if (updated) {
        setSessionsToday((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
      }
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

  const workedMinutes = isCheckedIn && currentSession
    ? Math.floor(elapsed / 60) + sessionsToday.filter((s) => s.checkOutTime).reduce((sum, s) => sum + (s.totalWorkedMinutes ?? 0), 0)
    : sessionsToday.reduce((sum, s) => sum + (s.totalWorkedMinutes ?? 0), 0);
  const diff = workedMinutes - committedMinutes;
  const isOvertime = diff > 0;
  const isShort = committedMinutes > 0 && diff < 0;
  const progress = committedMinutes > 0 ? workedMinutes / committedMinutes : 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.date, { color: c.muted }]}>{dayjs().format('dddd, MMM D, YYYY')}</Text>

      <View style={styles.ringWrapper}>
        <ProgressRing
          progress={progress}
          color={c.primary}
          trackColor={scheme === 'dark' ? c.border : '#e2e8f0'}
        />
        <View style={[styles.ringCenter, { backgroundColor: c.background }]}>
          {isCheckedIn ? (
            <>
              <Text style={[styles.timerLabel, { color: c.muted }]}>Time elapsed</Text>
              <Text style={[styles.timer, { color: c.primary }]}>
                {Math.floor(elapsed / 3600)}:{(Math.floor(elapsed / 60) % 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}
              </Text>
            </>
          ) : committedMinutes > 0 ? (
            <>
              <Text style={[styles.ringCenterLabel, { color: c.muted }]}>Today’s progress</Text>
              <Text style={[styles.ringCenterValue, { color: c.text }]}>
                {formatMinutes(workedMinutes)}
              </Text>
              <Text style={[styles.ringCenterSub, { color: c.muted }]}>of {formatMinutes(committedMinutes)}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.ringCenterLabel, { color: c.muted }]}>Worked today</Text>
              <Text style={[styles.ringCenterValue, { color: c.text }]}>{formatMinutes(workedMinutes)}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.statsInline}>
        <View style={styles.statPill}>
          <Text style={[styles.statPillLabel, { color: c.muted }]}>Worked</Text>
          <Text style={[styles.statPillValue, { color: c.text }]}>{formatMinutes(workedMinutes)}</Text>
        </View>
        <View style={[styles.statDot, { backgroundColor: c.border }]} />
        <View style={styles.statPill}>
          <Text style={[styles.statPillLabel, { color: c.muted }]}>Committed</Text>
          <Text style={[styles.statPillValue, { color: c.text }]}>{formatMinutes(committedMinutes)}</Text>
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
        {!currentSession ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
            onPress={handleCheckIn}
            disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Check In</Text>}
          </TouchableOpacity>
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
  container: { flex: 1, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  date: { fontSize: 15, marginBottom: 20, textAlign: 'center' },
  ringSvg: { position: 'absolute' },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignSelf: 'center',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringCenter: {
    position: 'absolute',
    width: RING_SIZE - STROKE * 3,
    height: RING_SIZE - STROKE * 3,
    borderRadius: (RING_SIZE - STROKE * 3) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerLabel: { fontSize: 11, marginBottom: 2 },
  timer: { fontSize: 22, fontWeight: '700' },
  ringCenterLabel: { fontSize: 11, marginBottom: 2 },
  ringCenterValue: { fontSize: 20, fontWeight: '700' },
  ringCenterSub: { fontSize: 11 },
  statsInline: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 24,
  },
  statPill: {
    alignItems: 'center',
    minWidth: 90,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statPillLabel: { fontSize: 12, marginBottom: 4 },
  statPillValue: { fontSize: 18, fontWeight: '600' },
  diffRow: { marginBottom: 24, alignItems: 'center' },
  diffText: { fontSize: 15, fontWeight: '600' },
  actions: { marginTop: 'auto', paddingBottom: 24 },
  primaryBtn: { borderRadius: 16, padding: 18, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  secondaryBtn: { borderWidth: 2, borderRadius: 16, padding: 18, alignItems: 'center' },
  secondaryBtnText: { fontSize: 18, fontWeight: '600' },
  doneText: { textAlign: 'center', fontSize: 16 },
});
