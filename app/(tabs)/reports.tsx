import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import dayjs from 'dayjs';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { getAttendanceByUser, getHolidays, getCommitmentHistory } from '@/services/data';
import { getItem } from '@/lib/storage';
import { buildReportSummary } from '@/services/reports';
import type { ReportSummary } from '@/services/reports';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'custom';

const chartConfig = {
  backgroundColor: '#f8fafc',
  backgroundGradientFrom: '#f8fafc',
  backgroundGradientTo: '#f8fafc',
  decimalPlaces: 0,
  color: (opacity: number) => `rgba(37, 99, 235, ${opacity})`,
  labelColor: (opacity: number) => `rgba(15, 23, 42, ${opacity})`,
};

export default function ReportsScreen() {
  const { dbUser } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [view, setView] = useState<ViewMode>('monthly');
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!dbUser) return;
    let s = startDate;
    let e = endDate;
    if (view === 'daily') {
      s = e = dayjs().format('YYYY-MM-DD');
    } else if (view === 'weekly') {
      s = dayjs().startOf('week').format('YYYY-MM-DD');
      e = dayjs().endOf('week').format('YYYY-MM-DD');
    } else if (view === 'monthly') {
      s = dayjs().startOf('month').format('YYYY-MM-DD');
      e = dayjs().endOf('month').format('YYYY-MM-DD');
    }
    (async () => {
      const [attendances, holidays, history, rounding] = await Promise.all([
        getAttendanceByUser(dbUser._id),
        getHolidays(dbUser._id),
        getCommitmentHistory(dbUser._id),
        getItem<'none' | '5' | '10'>('rounding'),
      ]);
      const sum = buildReportSummary(dbUser._id, s, e, attendances, dbUser, holidays, history, rounding ?? 'none');
      setSummary(sum);
      setLoading(false);
    })();
  }, [dbUser, view, startDate, endDate]);

  async function exportExcel() {
    if (!dbUser || !summary) return;
    setExporting(true);
    try {
      const attendances = await getAttendanceByUser(dbUser._id);
      const byDate = new Map(summary.days.map((d) => [d.date, d]));
      const rows = summary.days.map((d) => {
        const att = attendances.find((a) => a.date === d.date);
        return {
          Date: d.date,
          'Check-in': att?.checkInTime ?? '—',
          'Check-out': att?.checkOutTime ?? '—',
          'Worked hours': (d.workedMinutes / 60).toFixed(2),
          Status: d.status,
          Notes: att?.notes ?? '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = FileSystem.documentDirectory + `attendance_${startDate}_${endDate}.xlsx`;
      await FileSystem.writeAsStringAsync(filename, wbout, { encoding: FileSystem.EncodingType.Base64 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filename, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Export report' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  if (!dbUser) return null;

  const screenWidth = Dimensions.get('window').width - 40;

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
      <View style={styles.filterRow}>
        {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.filterBtn, view === v && { backgroundColor: c.primary }]}
            onPress={() => setView(v)}>
            <Text style={[styles.filterBtnText, view === v && { color: '#fff' }, { color: view === v ? '#fff' : c.text }]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.primary} style={styles.loader} />
      ) : summary ? (
        <>
          <View style={[styles.summaryCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.summaryTitle, { color: c.text }]}>Summary</Text>
            <Text style={[styles.summaryRow, { color: c.text }]}>Worked: {(summary.totalWorkedMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: c.text }]}>Committed: {(summary.totalCommittedMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: Colors.status.overtime }]}>Overtime: {(summary.overtimeMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: Colors.status.short }]}>Short: {(summary.shortMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: c.muted }]}>Working days: {summary.workingDays} · Holidays: {summary.holidays} · Off: {summary.offDays}</Text>
          </View>

          {summary.days.length > 0 && (
            <>
              <Text style={[styles.chartTitle, { color: c.text }]}>Hours per day</Text>
              <BarChart
                data={{
                  labels: summary.days.slice(0, 14).map((d) => dayjs(d.date).format('D')),
                  datasets: [{ data: summary.days.slice(0, 14).map((d) => Math.round((d.workedMinutes / 60) * 10) / 10) }],
                }}
                width={screenWidth}
                height={200}
                chartConfig={chartConfig}
                style={styles.chart}
              />
            </>
          )}

          {summary.days.length > 1 && (
            <>
              <Text style={[styles.chartTitle, { color: c.text }]}>Weekly trend</Text>
              <LineChart
                data={{
                  labels: summary.days.map((d) => dayjs(d.date).format('D')),
                  datasets: [{ data: summary.days.map((d) => d.workedMinutes / 60) }],
                }}
                width={screenWidth}
                height={200}
                chartConfig={chartConfig}
                style={styles.chart}
              />
            </>
          )}

          {summary.totalWorkedMinutes > 0 && (
            <>
              <Text style={[styles.chartTitle, { color: c.text }]}>Worked vs Short vs Overtime</Text>
              <PieChart
                data={[
                  { name: 'Worked', population: summary.totalWorkedMinutes, color: Colors.status.complete },
                  { name: 'Short', population: summary.shortMinutes, color: Colors.status.short },
                  { name: 'Overtime', population: summary.overtimeMinutes, color: Colors.status.overtime },
                ].filter((s) => s.population > 0)}
                width={screenWidth}
                height={180}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                style={styles.chart}
              />
            </>
          )}

          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: c.primary }]} onPress={exportExcel} disabled={exporting}>
            {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.exportBtnText}>Export monthly report (Excel)</Text>}
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  filterBtnText: { fontSize: 14, fontWeight: '600' },
  loader: { marginVertical: 40 },
  summaryCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  summaryRow: { fontSize: 14, marginBottom: 6 },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chart: { borderRadius: 12, marginBottom: 24 },
  exportBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  exportBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
