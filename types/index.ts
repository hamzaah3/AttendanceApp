export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type AttendanceStatus = 'complete' | 'incomplete' | 'manual';

export interface User {
  _id: string;
  firebaseUid: string;
  name: string;
  email: string;
  committedHoursPerDay: number;
  weeklyOffDays: Weekday[];
  timezone: string;
  createdAt: string;
}

export interface Attendance {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO or HH:mm
  checkOutTime?: string;
  totalWorkedMinutes: number;
  status: AttendanceStatus;
  notes?: string;
  isManual?: boolean;
  createdAt?: string;
}

export interface Holiday {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
}

export interface CommitmentHistory {
  _id: string;
  userId: string;
  hoursPerDay: number;
  effectiveFromDate: string; // YYYY-MM-DD
}

export interface ReportFilters {
  view: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface DayStats {
  date: string;
  workedMinutes: number;
  committedMinutes: number;
  isOffDay: boolean;
  isHoliday: boolean;
  status: 'complete' | 'short' | 'overtime' | 'off' | 'holiday';
  overtimeMinutes: number;
  shortMinutes: number;
}

export type RoundingRule = 'none' | '5' | '10';
