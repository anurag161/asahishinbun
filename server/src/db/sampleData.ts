/**
 * Seeds the client's June 2026 sample month so the demo opens on a filled,
 * correct-to-the-yen month. Attendance and expenses are taken straight from
 * @asahi/shared's golden-master fixture, so the DB and the engine can never drift.
 *
 * The same function is used by the real seed (Postgres) and the schema test
 * (pg-mem), which is why it takes a minimal Queryable instead of a concrete pool.
 */

import {
  DEFAULT_RATES,
  JUNE_2026_ATTENDANCE,
  JUNE_2026_EXPENSES,
} from '@asahi/shared';

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

// Placeholder used only when a caller doesn't supply real password hashes.
const PLACEHOLDER_HASH = 'PLACEHOLDER_NO_LOGIN';

export interface SeedResult {
  adminId: number;
  staffId: number;
  stadiumId: number;
}

export interface SeedOptions {
  adminPasswordHash?: string;
  staffPasswordHash?: string;
}

export async function seedSampleMonth(
  db: Queryable,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const adminHash = opts.adminPasswordHash ?? PLACEHOLDER_HASH;
  const staffHash = opts.staffPasswordHash ?? PLACEHOLDER_HASH;
  // Pay rates (令和8年).
  await db.query(
    `INSERT INTO rate_config
       (effective_year, hourly_yen, overtime_under60_yen, overtime_over60_yen, night_yen, lunch_yen)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      '令和8年',
      DEFAULT_RATES.hourlyYen,
      DEFAULT_RATES.overtimeUnder60Yen,
      DEFAULT_RATES.overtimeOver60Yen,
      DEFAULT_RATES.nightYen,
      DEFAULT_RATES.lunchYen,
    ],
  );

  const admin = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin') RETURNING id`,
    ['管理者', 'admin@example.com', adminHash],
  );
  const adminId = admin.rows[0].id as number;

  const staff = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'staff') RETURNING id`,
    ['サンプル 太郎', 'staff@example.com', staffHash],
  );
  const staffId = staff.rows[0].id as number;

  await db.query(
    `INSERT INTO staff_profiles (user_id, address, home_nearest_station, phone)
     VALUES ($1, $2, $3, $4)`,
    [staffId, '北海道札幌市中央区', '円山', '090-0000-0000'],
  );

  const stadium = await db.query(
    `INSERT INTO stadiums (name, address, nearest_station)
     VALUES ($1, $2, $3) RETURNING id`,
    ['大阪球場（サンプル）', '大阪市', '大阪'],
  );
  const stadiumId = stadium.rows[0].id as number;

  // Route fares, both directions: 円山 ⇄ 大阪, ¥1,930 one-way.
  await db.query(
    `INSERT INTO route_fares (from_station, to_station, one_way_fare, mode, route_note)
     VALUES ($1, $2, $3, $4, $5), ($2, $1, $3, $4, $6)`,
    ['円山', '大阪', 1_930, 'バス・電車', '円山→大阪', '大阪→円山'],
  );

  // Attendance — from the shared golden-master fixture.
  for (const d of JUNE_2026_ATTENDANCE) {
    await db.query(
      `INSERT INTO attendance
         (staff_id, work_date, stadium_id, start_minutes, end_minutes,
          break_taken, break_minutes, bucket, overtime_minutes, night_minutes, tournament)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        staffId,
        d.date,
        stadiumId,
        d.startMinutes,
        d.endMinutes,
        d.breakMinutes > 0,
        d.breakMinutes,
        d.bucket,
        d.overtimeMinutes ?? 0,
        d.nightMinutes ?? 0,
        d.tournament ?? false,
      ],
    );
  }

  // Expenses — auto-generated transport lines from the shared fixture.
  for (const e of JUNE_2026_EXPENSES) {
    await db.query(
      `INSERT INTO expense_lines
         (staff_id, expense_date, category, bucket, amount_yen, description, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'auto')`,
      [staffId, e.date, e.category, e.bucket, e.amountYen, e.description ?? null],
    );
  }

  return { adminId, staffId, stadiumId };
}
