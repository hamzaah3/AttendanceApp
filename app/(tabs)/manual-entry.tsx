import { useEffect, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import dayjs from 'dayjs';
import {
  getAttendanceByUser,
  createAttendance,
  updateAttendance,
  deleteAttendance,
} from '@/services/data';
import type { Attendance } from '@/types';

const THREE_MONTHS_AGO = dayjs().subtract(3, 'month').format('YYYY-MM-DD');
const TODAY = dayjs().format('YYYY-MM-DD');

export default function ManualEntryScreen() {
  const { dbUser } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [list, setList] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [checkIn, setCheckIn] = useState('09:00');
  const [checkOut, setCheckOut] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUser) return;
    getAttendanceByUser(dbUser._id).then((data) => {
      setList(data);
      setLoading(false);
    });
  }, [dbUser]);

  const editingSession = editingId ? list.find((a) => a._id === editingId) : null;
  const canEditPast = selectedDate >= THREE_MONTHS_AGO;
  const isToday = selectedDate === TODAY;
  const isNewEntry = !editingId;
  const canCheckInOnly = isToday && isNewEntry;
  const canCheckOutOnly = isToday && !!editingSession && !editingSession.checkOutTime;

  function openEdit(att: Attendance) {
    setSelectedDate(att.date);
    setCheckIn(att.checkInTime);
    setCheckOut(att.checkOutTime ?? '');
    setNotes(att.notes ?? '');
    setEditingId(att._id);
  }

  function clearForm() {
    setSelectedDate(TODAY);
    setCheckIn(dayjs().format('HH:mm'));
    setCheckOut('');
    setNotes('');
    setEditingId(null);
  }

  async function handleSave() {
    if (!dbUser) return;
    if (!canEditPast) {
      Alert.alert('Restriction', 'Cannot add or edit entries older than 3 months.');
      return;
    }
    const checkOutTrimmed = checkOut.trim();
    const hasCheckOut = checkOutTrimmed.length > 0;
    const ci = dayjs(`${selectedDate}T${checkIn}`);

    if (hasCheckOut) {
      const co = dayjs(`${selectedDate}T${checkOutTrimmed}`);
      if (co.isBefore(ci) || co.isSame(ci)) {
        Alert.alert('Invalid times', 'Check-out must be after check-in.');
        return;
      }
      if (co.diff(ci, 'minute') > 24 * 60) {
        Alert.alert('Invalid times', 'Worked time cannot exceed 24 hours.');
        return;
      }
    } else if (!canCheckInOnly && !canCheckOutOnly) {
      Alert.alert('Invalid', 'Check-out time is required for this entry.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateAttendance(editingId, {
          checkInTime: checkIn,
          checkOutTime: hasCheckOut ? checkOutTrimmed : undefined,
          notes: notes || undefined,
          isManual: true,
        });
        if (updated) {
          setList((prev) => prev.map((a) => (a._id === editingId ? updated : a)));
          clearForm();
          Alert.alert('Saved', hasCheckOut ? 'Entry updated.' : 'Check-out added.');
        }
      } else {
        const created = await createAttendance(
          dbUser._id,
          selectedDate,
          checkIn,
          hasCheckOut ? checkOutTrimmed : undefined,
          notes || undefined,
          true
        );
        setList((prev) => [created, ...prev]);
        clearForm();
        Alert.alert('Saved', hasCheckOut ? 'Manual entry added.' : 'Manual check-in added. Home timer will use this time. Add check-out here when you leave.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editingId) return;
    Alert.alert('Delete entry', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteAttendance(editingId);
          if (ok) {
            setList((prev) => prev.filter((a) => a._id !== editingId));
            setEditingId(null);
            setNotes('');
          }
        },
      },
    ]);
  }

  if (!dbUser) return null;
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const filteredList = list.filter((a) => a.date >= THREE_MONTHS_AGO).slice(0, 30);

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionLabel, { color: c.muted }]}>Select date</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={selectedDate}
        onChangeText={setSelectedDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={c.muted}
      />

      {isToday && (canCheckInOnly || canCheckOutOnly) && (
        <Text style={[styles.hint, { color: c.muted }]}>
          {canCheckInOnly
            ? 'Add only check-in now; the home timer will use this time. Add check-out here later when you leave.'
            : 'Add your check-out time. Home will show today as complete.'}
        </Text>
      )}

      <Text style={[styles.sectionLabel, { color: c.muted }]}>Check-in time</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={checkIn}
        onChangeText={setCheckIn}
        placeholder="HH:mm (e.g. 12:00)"
        placeholderTextColor={c.muted}
      />

      <Text style={[styles.sectionLabel, { color: c.muted }]}>
        Check-out time {canCheckInOnly || canCheckOutOnly ? '(optional for today)' : ''}
      </Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={checkOut}
        onChangeText={setCheckOut}
        placeholder={canCheckOutOnly ? 'HH:mm (e.g. 22:00 when you left)' : 'HH:mm or leave empty for check-in only'}
        placeholderTextColor={c.muted}
      />

      <Text style={[styles.sectionLabel, { color: c.muted }]}>Note (reason for manual entry)</Text>
      <TextInput
        style={[styles.input, styles.notesInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        placeholderTextColor={c.muted}
        multiline
      />

      {!canEditPast && <Text style={[styles.warn, { color: c.danger }]}>Entries older than 3 months cannot be edited.</Text>}

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: c.primary }]}
        onPress={handleSave}
        disabled={saving || !canEditPast}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{(editingId ? 'Update' : 'Add') + ' entry'}</Text>}
      </TouchableOpacity>

      {editingId && (
        <TouchableOpacity style={[styles.deleteBtn, { borderColor: c.danger }]} onPress={handleDelete}>
          <Text style={[styles.deleteBtnText, { color: c.danger }]}>Delete entry</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.sectionLabel, { color: c.muted, marginTop: 24 }]}>Recent entries</Text>
      {filteredList.map((a) => (
        <TouchableOpacity
          key={a._id}
          style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => openEdit(a)}>
          <Text style={[styles.cardDate, { color: c.text }]}>{a.date}</Text>
          <Text style={[styles.cardTime, { color: c.muted }]}>
            {a.checkInTime} – {a.checkOutTime ?? '—'} {a.isManual && '(manual)'}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 14, marginBottom: 8 },
  hint: { fontSize: 13, marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 16 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  warn: { fontSize: 12, marginBottom: 12 },
  saveBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { borderWidth: 2, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  deleteBtnText: { fontSize: 16, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardDate: { fontSize: 16, fontWeight: '600' },
  cardTime: { fontSize: 14, marginTop: 4 },
});
