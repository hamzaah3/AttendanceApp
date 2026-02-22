import dayjs from 'dayjs';
import type { User, Attendance, Holiday, CommitmentHistory, DayStats } from '@/types';
import { getCommittedMinutesForDate } from './data';

export function roundMinutes(minutes: number, rule: 'none' | '5' | '10'): number {
  if (rule === 'none') return minutes;
  const step = rule === '5' ? 5 : 10;
  return Math.round(minutes / step) * step;
}

export function buildDayStats(
  date: string,
  attendance: Attendance | null,
  committedMinutes: number,
  roundRule: 'none' | '5' | '10' = 'none'
): DayStats {
  const worked = attendance ? roundMinutes(attendance.totalWorkedMinutes, roundRule) : 0;
  let status: DayStats['status'] = 'off';
  if (committedMinutes === 0) status = attendance ? 'overtime' : 'holiday';
  else if (worked === 0) status = 'short';
  else if (worked >= committedMinutes) status = worked > committedMinutes ? 'overtime' : 'complete';
  else status = 'short';

  const overtimeMinutes = committedMinutes > 0 && worked > committedMinutes ? worked - committedMinutes : 0;
  const shortMinutes = committedMinutes > 0 && worked < committedMinutes ? committedMinutes - worked : 0;

  return {
    date,
    workedMinutes: worked,
    committedMinutes,
    isOffDay: committedMinutes === 0 && !attendance,
    isHoliday: committedMinutes === 0 && !attendance,
    status,
    overtimeMinutes,
    shortMinutes,
  };
}

export function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let d = dayjs(start);
  const e = dayjs(end);
  while (!d.isAfter(e)) {
    dates.push(d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
  return dates;
}

export interface ReportSummary {
  totalWorkedMinutes: number;
  totalCommittedMinutes: number;
  overtimeMinutes: number;
  shortMinutes: number;
  workingDays: number;
  holidays: number;
  offDays: number;
  days: DayStats[];
}

export function buildReportSummary(
  userId: string,
  startDate: string,
  endDate: string,
  attendances: Attendance[],
  user: User,
  holidays: Holiday[],
  commitmentHistory: CommitmentHistory[],
  roundRule: 'none' | '5' | '10' = 'none'
): ReportSummary {
  const dates = getDatesInRange(startDate, endDate);
  const userAttendances = attendances.filter((a) => a.userId === userId);
  const workedByDate = new Map<string, number>();
  for (const a of userAttendances) {
    const prev = workedByDate.get(a.date) ?? 0;
    workedByDate.set(a.date, prev + (a.totalWorkedMinutes ?? 0));
  }
  let totalWorked = 0;
  let totalCommitted = 0;
  let overtime = 0;
  let short = 0;
  let workingDays = 0;
  let holidaysCount = 0;
  let offDaysCount = 0;
  const days: DayStats[] = [];

  for (const date of dates) {
    const committed = getCommittedMinutesForDate(user, date, holidays, commitmentHistory);
    const worked = workedByDate.get(date) ?? 0;
    const att = worked > 0 ? { totalWorkedMinutes: worked } : null;
    const stats = buildDayStats(date, att as Attendance | null, committed, roundRule);
    days.push(stats);
    totalWorked += stats.workedMinutes;
    totalCommitted += stats.committedMinutes;
    overtime += stats.overtimeMinutes;
    short += stats.shortMinutes;
    if (committed > 0) workingDays++;
    else if (holidays.some((h) => h.date === date)) holidaysCount++;
    else offDaysCount++;
  }

  return {
    totalWorkedMinutes: totalWorked,
    totalCommittedMinutes: totalCommitted,
    overtimeMinutes: overtime,
    shortMinutes: short,
    workingDays,
    holidays: holidaysCount,
    offDays: offDaysCount,
    days,
  };
}
