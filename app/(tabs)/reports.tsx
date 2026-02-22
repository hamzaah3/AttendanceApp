import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import dayjs from 'dayjs';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import '@/lib/xlsxBufferShim';
import * as XLSX from 'xlsx';
import { getAttendanceByUser, getHolidays, getCommitmentHistory } from '@/services/data';
import { getItem } from '@/lib/storage';
import { buildReportSummary, buildDayStats } from '@/services/reports';
import type { ReportSummary } from '@/services/reports';
import type { Attendance } from '@/types';

function uint8ArrayToBase64(u8: Uint8Array): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i];
    const b = u8[i + 1];
    const c = u8[i + 2];
    out += CHARS[a >> 2];
    out += CHARS[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b !== undefined ? CHARS[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=';
    out += c !== undefined ? CHARS[c & 63] : '=';
  }
  return out;
}

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'custom';

const SEGMENTS = 5;
const WEEK_DAYS = 7;

/** Group days into weeks and sum worked/committed hours per week for monthly grouped bar chart. */
function groupDaysByWeeks(days: { workedMinutes: number; committedMinutes: number }[]) {
  const labels: string[] = [];
  const actualHours: number[] = [];
  const targetHours: number[] = [];
  for (let w = 0; w * WEEK_DAYS < days.length; w++) {
    const chunk = days.slice(w * WEEK_DAYS, (w + 1) * WEEK_DAYS);
    labels.push(`Week ${w + 1}`);
    actualHours.push(Math.round((chunk.reduce((s, d) => s + d.workedMinutes, 0) / 60) * 10) / 10);
    targetHours.push(Math.round((chunk.reduce((s, d) => s + d.committedMinutes, 0) / 60) * 10) / 10);
  }
  return { labels, actualHours, targetHours };
}

export default function ReportsScreen() {
  const { dbUser } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const chartConfig = {
    backgroundColor: c.card,
    backgroundGradientFrom: c.card,
    backgroundGradientTo: c.card,
    decimalPlaces: 1,
    color: (opacity: number) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity: number) => (scheme === 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(15, 23, 42, ${opacity})`),
  };
  const [view, setView] = useState<ViewMode>('monthly');
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  /** Same source as Home: attendances (totalWorkedMinutes) + getCommittedMinutesForDate. Refreshes on focus so Reports stay in sync after check-in/out on Home. */
  const fetchReport = useCallback(
    async (showLoader = true) => {
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
      if (showLoader) setLoading(true);
      const [attendances, holidays, history, rounding] = await Promise.all([
        getAttendanceByUser(dbUser._id),
        getHolidays(dbUser._id),
        getCommitmentHistory(dbUser._id),
        getItem<'none' | '5' | '10'>('rounding'),
      ]);
      let sum = buildReportSummary(dbUser._id, s, e, attendances, dbUser, holidays, history, rounding ?? 'none');
      const today = dayjs().format('YYYY-MM-DD');
      if (today >= s && today <= e) {
        const userToday = attendances.filter((a) => a.userId === dbUser._id && a.date === today);
        const completedToday = userToday.filter((a) => a.checkOutTime).reduce((acc, a) => acc + (a.totalWorkedMinutes ?? 0), 0);
        const openSessions = userToday.filter((a) => !a.checkOutTime);
        const liveMinutes = openSessions.reduce(
          (acc, sess) => acc + Math.max(0, dayjs().diff(dayjs(`${sess.date}T${sess.checkInTime}`), 'minute')),
          0
        );
        if (liveMinutes > 0) {
          const totalToday = completedToday + liveMinutes;
          const todayIdx = sum.days.findIndex((d) => d.date === today);
          if (todayIdx >= 0) {
            const oldDay = sum.days[todayIdx];
            const newDay = buildDayStats(
              today,
              { totalWorkedMinutes: totalToday } as Attendance,
              oldDay.committedMinutes,
              rounding ?? 'none'
            );
            sum = {
              ...sum,
              totalWorkedMinutes: sum.totalWorkedMinutes - oldDay.workedMinutes + newDay.workedMinutes,
              overtimeMinutes: sum.overtimeMinutes - oldDay.overtimeMinutes + newDay.overtimeMinutes,
              shortMinutes: sum.shortMinutes - oldDay.shortMinutes + newDay.shortMinutes,
              days: sum.days.map((d, i) => (i === todayIdx ? newDay : d)),
            };
          }
        }
      }
      setSummary(sum);
      setLoading(false);
    },
    [dbUser, view, startDate, endDate]
  );

  useEffect(() => {
    if (!dbUser) return;
    fetchReport(true);
  }, [dbUser, fetchReport]);

  useFocusEffect(
    useCallback(() => {
      if (dbUser) fetchReport(false);
    }, [dbUser, fetchReport])
  );

  async function exportExcel() {
    if (!dbUser || !summary) return;
    setExporting(true);
    try {
      const attendances = await getAttendanceByUser(dbUser._id);
      const rows = summary.days.map((d) => {
        const sessions = attendances.filter((a) => a.date === d.date).sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
        const first = sessions[0];
        const last = sessions[sessions.length - 1];
        return {
          Date: d.date,
          Sessions: sessions.length,
          'First check-in': first?.checkInTime ?? '—',
          'Last check-out': last?.checkOutTime ?? '—',
          'Worked hours': (d.workedMinutes / 60).toFixed(2),
          Status: d.status,
          Notes: first?.notes ?? '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const u8 = out instanceof Uint8Array ? out : new Uint8Array(out as number[]);
      const base64 = uint8ArrayToBase64(u8);
      const filename = (FileSystemLegacy.documentDirectory ?? '') + `attendance_${startDate}_${endDate}.xlsx`;
      await FileSystemLegacy.writeAsStringAsync(filename, base64, { encoding: 'base64' });
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
            <Text style={[styles.summaryPeriod, { color: c.muted }]}>
              {view === 'daily'
                ? dayjs().format('dddd, MMM D, YYYY')
                : view === 'weekly'
                  ? `${dayjs(summary.days[0]?.date).format('MMM D')} – ${dayjs(summary.days[summary.days.length - 1]?.date).format('MMM D, YYYY')}`
                  : dayjs(summary.days[0]?.date).format('MMMM YYYY')}
            </Text>
            <Text style={[styles.summaryRow, { color: c.text }]}>Worked: {(summary.totalWorkedMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: c.text }]}>Committed: {(summary.totalCommittedMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: Colors.status.overtime }]}>Overtime: {(summary.overtimeMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: Colors.status.short }]}>Short: {(summary.shortMinutes / 60).toFixed(1)} h</Text>
            <Text style={[styles.summaryRow, { color: c.muted }]}>Working days: {summary.workingDays} · Holidays: {summary.holidays} · Off: {summary.offDays}</Text>
          </View>

          {summary.days.length > 0 && view === 'monthly' && (() => {
            const { labels, actualHours, targetHours } = groupDaysByWeeks(summary.days);
            const monthlyChartConfig = {
              backgroundColor: c.card,
              backgroundGradientFrom: c.card,
              backgroundGradientTo: c.card,
              decimalPlaces: 1,
              barPercentage: 0.5,
              color: (opacity: number) => (scheme === 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(15, 23, 42, ${opacity})`),
              labelColor: (opacity: number) => (scheme === 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(15, 23, 42, ${opacity})`),
            };
            return (
              <>
                <Text style={[styles.chartTitle, { color: c.text }]}>Actual vs Target (hours per week)</Text>
                <BarChart
                  data={{
                    labels,
                    datasets: [
                      { data: actualHours, colors: [(opacity = 1) => Colors.status.complete] },
                      { data: targetHours, colors: [(opacity = 1) => (scheme === 'dark' ? '#94a3b8' : '#64748b')] },
                    ],
                  }}
                  width={screenWidth}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix="h"
                  chartConfig={monthlyChartConfig}
                  style={styles.chart}
                  fromZero
                  segments={SEGMENTS}
                  withCustomBarColorFromData
                  flatColor
                />
              </>
            );
          })()}

          {summary.days.length > 0 && view !== 'monthly' && (
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
                segments={5}
                formatYLabel={(y) => `${Number(y).toFixed(1)}h`}
                fromZero
              />
            </>
          )}

          {summary.days.length > 1 && view === 'weekly' && (
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
                segments={5}
                formatYLabel={(y) => `${Number(y).toFixed(1)}h`}
                fromZero
              />
            </>
          )}

          {summary.totalWorkedMinutes > 0 && (
            <>
              <Text style={[styles.chartTitle, { color: c.text }]}>Worked vs Short vs Overtime</Text>
              <PieChart
                data={[
                  { name: 'Worked', population: summary.totalWorkedMinutes, color: Colors.status.complete, legendFontColor: c.text },
                  { name: 'Short', population: summary.shortMinutes, color: Colors.status.short, legendFontColor: c.text },
                  { name: 'Overtime', population: summary.overtimeMinutes, color: Colors.status.overtime, legendFontColor: c.text },
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
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  summaryPeriod: { fontSize: 12, marginBottom: 10 },
  summaryRow: { fontSize: 14, marginBottom: 6 },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chart: { borderRadius: 12, marginBottom: 24 },
  exportBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  exportBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
