/** Row shapes as stored in Postgres (snake_case columns). */

import type { CostBucket, ExpenseCategory } from '@asahi/shared';

export type Role = 'staff' | 'admin';
export type ExpenseSource = 'auto' | 'manual';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

export interface StaffProfileRow {
  user_id: number;
  postal_code: string | null;
  address: string | null;
  home_nearest_station: string | null;
  phone: string | null;
}

export interface StadiumRow {
  id: number;
  name: string;
  address: string | null;
  nearest_station: string;
}

export interface RouteFareRow {
  id: number;
  from_station: string;
  to_station: string;
  one_way_fare: number;
  mode: string | null;
  route_note: string | null;
}

export interface AttendanceRow {
  id: number;
  staff_id: number;
  work_date: string; // 'YYYY-MM-DD'
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
  created_at: string;
}

export interface ExpenseLineRow {
  id: number;
  staff_id: number;
  expense_date: string; // 'YYYY-MM-DD'
  category: ExpenseCategory;
  bucket: CostBucket;
  amount_yen: number;
  description: string | null;
  source: ExpenseSource;
  created_at: string;
}

export interface RateConfigRow {
  id: number;
  effective_year: string;
  hourly_yen: number;
  overtime_under60_yen: number;
  overtime_over60_yen: number;
  night_yen: number;
  lunch_yen: number;
  created_at: string;
}
