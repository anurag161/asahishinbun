import type { CostBucket, ExpenseCategory, PayrollResult } from '@asahi/shared';

export type Role = 'staff' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface Stadium {
  id: number;
  name: string;
  address: string | null;
  nearest_station: string;
}

export interface RouteFare {
  id: number;
  from_station: string;
  to_station: string;
  one_way_fare: number;
  mode: string | null;
  route_note: string | null;
}

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: Role;
  postal_code: string | null;
  address: string | null;
  home_nearest_station: string | null;
  phone: string | null;
}

export interface AttendanceRow {
  id: number;
  staff_id: number;
  work_date: string;
  stadium_id: number;
  start_minutes: number;
  end_minutes: number;
  break_taken: boolean;
  break_minutes: number;
  lunch_allowance: boolean;
  bucket: CostBucket;
  overtime_minutes: number;
  night_minutes: number;
  tournament: boolean;
}

export interface ExpenseRow {
  id: number;
  staff_id: number;
  expense_date: string;
  category: ExpenseCategory;
  bucket: CostBucket;
  amount_yen: number;
  description: string | null;
  source: 'auto' | 'manual';
}

export interface MyPageSummary {
  month: string;
  workDays: number;
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  transportTotalYen: number;
  salaryYen: number;
  taxYen: number;
  grossYen: number;
  netYen: number;
  days: PayrollResult['days'];
}

export interface TransportResult {
  applied: boolean;
  totalYen: number;
}

export interface RecordsResponse {
  month: string;
  records: {
    staffId: number;
    name: string;
    email: string;
    workDays: number;
    totalWorkedMinutes: number;
    totalOvertimeMinutes: number;
    overtimeYen: number;
    salaryYen: number;
    transportYen: number;
    taxYen: number;
    grossYen: number;
    netYen: number;
    lunchYen: number;
  }[];
}
