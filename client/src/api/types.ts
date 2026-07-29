import type { CostBucket, ExpenseCategory, PayrollResult } from '@asahi/shared';

export type Role = 'staff' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

/**
 * What GET /api/auth/me returns: the user, plus the month the app should open on.
 * The month travels with the session so the client knows it before any page
 * mounts, instead of every screen painting on today's (often empty) month first.
 */
export interface SessionUser extends User {
  defaultMonth?: string;
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

/**
 * What auto transport would book for a stadium, shown on the entry form before
 * the day is saved. Produced by the same resolver the save path runs, so the
 * previewed fare is the fare that lands on the day.
 */
export interface TransportPreview {
  homeStation: string | null;
  stadiumStation: string;
  mode: string | null;
  outboundFare: number;
  inboundFare: number;
  totalYen: number;
  applied: boolean;
  /** Why the fare is ¥0: the two causes have different fixes. */
  reason: 'noHomeStation' | 'noRoute' | null;
}

/** Station names 区間マスタ may be keyed on, grouped by where they came from. */
export interface KnownStations {
  stadiums: string[];
  homes: string[];
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
  /** True when a day passed the 丙 table's ¥14,800 ceiling — tax and net are estimates. */
  taxProvisional: boolean;
  provisionalTaxDays: string[];
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
    taxProvisional: boolean;
    provisionalTaxDays: string[];
    grossYen: number;
    netYen: number;
    lunchYen: number;
  }[];
}
