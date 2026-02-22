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

export default function ManualEntryScreen() {
  const { dbUser } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [list, setList] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [checkIn, setCheckIn] = useState('09:00');
  const [checkOut, setCheckOut] = useState('17:00');
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

  const existing = list.find((a) => a.date === selectedDate);
  const canEditPast = selectedDate >= THREE_MONTHS_AGO;

  function openEdit(att: Attendance) {
    setSelectedDate(att.date);
    setCheckIn(att.checkInTime);
    setCheckOut(att.checkOutTime ?? '17:00');
    setNotes(att.notes ?? '');
    setEditingId(att._id);
  }

  async function handleSave() {
    if (!dbUser) return;
    if (!canEditPast) {
      Alert.alert('Restriction', 'Cannot add or edit entries older than 3 months.');
      return;
    }
    const ci = dayjs(`${selectedDate}T${checkIn}`);
    const co = dayjs(`${selectedDate}T${checkOut}`);
    if (co.isBefore(ci) || co.isSame(ci)) {
      Alert.alert('Invalid times', 'Check-out must be after check-in.');
      return;
    }
    const minutes = co.diff(ci, 'minute');
    if (minutes > 24 * 60) {
      Alert.alert('Invalid times', 'Worked time cannot exceed 24 hours.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateAttendance(editingId, {
          checkInTime: checkIn,
          checkOutTime: checkOut,
          notes: notes || undefined,
        });
        if (updated) {
          setList((prev) => prev.map((a) => (a._id === editingId ? updated : a)));
          setEditingId(null);
          Alert.alert('Saved', 'Entry updated.');
        }
      } else {
        if (existing) {
          Alert.alert('Conflict', 'An entry already exists for this date. Edit it instead.');
          setSaving(false);
          return;
        }
        const created = await createAttendance(dbUser._id, selectedDate, checkIn, checkOut, notes || undefined, true);
        setList((prev) => [created, ...prev]);
        Alert.alert('Saved', 'Manual entry added.');
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

      <Text style={[styles.sectionLabel, { color: c.muted }]}>Check-in time</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={checkIn}
        onChangeText={setCheckIn}
        placeholder="HH:mm"
        placeholderTextColor={c.muted}
      />

      <Text style={[styles.sectionLabel, { color: c.muted }]}>Check-out time</Text>
      <TextInput
        style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        value={checkOut}
        onChangeText={setCheckOut}
        placeholder="HH:mm"
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
