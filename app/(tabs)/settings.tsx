import { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import dayjs from 'dayjs';
import { getItem, setItem } from '@/lib/storage';
import { getHolidays, addHoliday, deleteHoliday, addCommitment, createOrUpdateUser } from '@/services/data';
import { WEEKDAYS, type Weekday } from '@/types';

const SETTINGS_KEYS = {
  rounding: 'rounding',
  checkInReminder: 'checkInReminder',
  checkOutReminder: 'checkOutReminder',
  notifyEnabled: 'notifyEnabled',
};

export default function SettingsScreen() {
  const { dbUser, refreshUser, signOut } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [committedHours, setCommittedHours] = useState('8');
  const [offDays, setOffDays] = useState<Weekday[]>(['Saturday', 'Sunday']);
  const [holidays, setHolidays] = useState<Awaited<ReturnType<typeof getHolidays>>>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayTitle, setNewHolidayTitle] = useState('');
  const [rounding, setRounding] = useState<'none' | '5' | '10'>('none');
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [checkInReminder, setCheckInReminder] = useState('09:00');
  const [checkOutReminder, setCheckOutReminder] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser) return;
    (async () => {
      const [h, roundingVal, notify, inR, outR] = await Promise.all([
        getHolidays(dbUser._id),
        getItem<string>(SETTINGS_KEYS.rounding),
        getItem<boolean>(SETTINGS_KEYS.notifyEnabled),
        getItem<string>(SETTINGS_KEYS.checkInReminder),
        getItem<string>(SETTINGS_KEYS.checkOutReminder),
      ]);
      setHolidays(h);
      setOffDays(dbUser.weeklyOffDays);
      setCommittedHours(String(dbUser.committedHoursPerDay));
      setRounding((roundingVal as 'none' | '5' | '10') ?? 'none');
      setNotifyEnabled(notify ?? false);
      setCheckInReminder(inR ?? '09:00');
      setCheckOutReminder(outR ?? '18:00');
      setLoading(false);
    })();
  }, [dbUser]);

  async function saveCommittedHours() {
    if (!dbUser) return;
    const num = parseFloat(committedHours);
    if (isNaN(num) || num < 0 || num > 24) {
      Alert.alert('Invalid', 'Enter a value between 0 and 24.');
      return;
    }
    setSaving(true);
    try {
      const effectiveFrom = dayjs().format('YYYY-MM-DD');
      await addCommitment(dbUser._id, num, effectiveFrom);
      await createOrUpdateUser({ ...dbUser, committedHoursPerDay: num });
      await refreshUser();
      Alert.alert('Saved', 'Committed hours updated. Past dates will use previous values.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function toggleOffDay(day: Weekday) {
    const next = offDays.includes(day) ? offDays.filter((d) => d !== day) : [...offDays, day].slice(0, 2);
    setOffDays(next);
    if (!dbUser) return;
    createOrUpdateUser({ ...dbUser, weeklyOffDays: next }).then(() => refreshUser());
  }

  async function addHolidayPress() {
    if (!dbUser || !newHolidayDate.trim() || !newHolidayTitle.trim()) {
      Alert.alert('Error', 'Enter date and title.');
      return;
    }
    try {
      const h = await addHoliday(dbUser._id, newHolidayDate.trim(), newHolidayTitle.trim());
      setHolidays((prev) => [...prev, h]);
      setNewHolidayDate('');
      setNewHolidayTitle('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Add failed');
    }
  }

  function removeHoliday(id: string) {
    Alert.alert('Remove holiday', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteHoliday(id).then(() => setHolidays((prev) => prev.filter((h) => h._id !== id))),
      },
    ]);
  }

  async function saveRounding(value: 'none' | '5' | '10') {
    setRounding(value);
    await setItem(SETTINGS_KEYS.rounding, value);
  }

  async function saveNotify(enabled: boolean) {
    setNotifyEnabled(enabled);
    await setItem(SETTINGS_KEYS.notifyEnabled, enabled);
    if (enabled) {
      const { requestPermissions, scheduleReminders } = await import('@/lib/notifications');
      if (await requestPermissions()) await scheduleReminders();
    } else {
      const Notifications = await import('expo-notifications');
      await Notifications.default.cancelAllScheduledNotificationsAsync();
    }
  }

  async function saveReminders() {
    await setItem(SETTINGS_KEYS.checkInReminder, checkInReminder);
    await setItem(SETTINGS_KEYS.checkOutReminder, checkOutReminder);
  }

  if (!dbUser) return null;
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>Committed hours per day</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={committedHours}
        onChangeText={setCommittedHours}
        keyboardType="decimal-pad"
        placeholder="8"
      />
      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: c.primary }]} onPress={saveCommittedHours} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: c.text }]}>Weekly off days</Text>
      <View style={styles.offDaysRow}>
        {WEEKDAYS.map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.offDayChip, offDays.includes(day) && { backgroundColor: c.primary }]}
            onPress={() => toggleOffDay(day)}>
            <Text style={[styles.offDayText, { color: offDays.includes(day) ? '#fff' : c.text }]}>{day.slice(0, 3)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: c.text }]}>Holidays</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={newHolidayDate}
        onChangeText={setNewHolidayDate}
        placeholder="YYYY-MM-DD"
      />
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={newHolidayTitle}
        onChangeText={setNewHolidayTitle}
        placeholder="Title (e.g. Eid, National Day)"
      />
      <TouchableOpacity style={[styles.addBtn, { borderColor: c.primary }]} onPress={addHolidayPress}>
        <Text style={[styles.addBtnText, { color: c.primary }]}>Add holiday</Text>
      </TouchableOpacity>
      {holidays.map((h) => (
        <View key={h._id} style={[styles.holidayRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.holidayText, { color: c.text }]}>{h.date} – {h.title}</Text>
          <TouchableOpacity onPress={() => removeHoliday(h._id)}>
            <Text style={[styles.removeText, { color: c.danger }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: c.text }]}>Round worked time</Text>
      <View style={styles.row}>
        {(['none', '5', '10'] as const).map((v) => (
          <TouchableOpacity key={v} style={[styles.chip, rounding === v && { backgroundColor: c.primary }]} onPress={() => saveRounding(v)}>
            <Text style={[styles.chipText, { color: rounding === v ? '#fff' : c.text }]}>{v === 'none' ? 'None' : `${v} min`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: c.text }]}>Notifications</Text>
      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[styles.label, { color: c.text }]}>Reminders</Text>
        <Switch value={notifyEnabled} onValueChange={saveNotify} trackColor={{ false: c.border, true: c.primary }} />
      </View>
      {notifyEnabled && (
        <>
          <Text style={[styles.smallLabel, { color: c.muted }]}>Remind if not checked in by</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
            value={checkInReminder}
            onChangeText={setCheckInReminder}
            onBlur={saveReminders}
          />
          <Text style={[styles.smallLabel, { color: c.muted }]}>Remind if not checked out by</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
            value={checkOutReminder}
            onChangeText={setCheckOutReminder}
            onBlur={saveReminders}
          />
        </>
      )}

      <Text style={[styles.sectionTitle, { color: c.text }]}>Timezone</Text>
      <Text style={[styles.mutedText, { color: c.muted }]}>{dbUser.timezone}</Text>

      <TouchableOpacity
        style={[styles.signOutBtn, { borderColor: c.danger }]}
        onPress={() => Alert.alert('Sign out', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }])}>
        <Text style={[styles.signOutText, { color: c.danger }]}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16 },
  saveBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  offDaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  offDayChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  offDayText: { fontSize: 14 },
  addBtn: { borderWidth: 2, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
  addBtnText: { fontSize: 16, fontWeight: '600' },
  holidayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  holidayText: { fontSize: 14 },
  removeText: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  chipText: { fontSize: 14 },
  label: { fontSize: 16 },
  smallLabel: { fontSize: 12, marginBottom: 6 },
  mutedText: { fontSize: 14, marginBottom: 24 },
  signOutBtn: { borderWidth: 2, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  signOutText: { fontSize: 16, fontWeight: '600' },
});
