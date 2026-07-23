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
  /** Email for the sample staff member. Defaults to the demo address; set to a
   *  real inbox (via DEMO_STAFF_EMAIL) so emailed documents actually arrive. */
  staffEmail?: string;
}

export async function seedSampleMonth(
  db: Queryable,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const adminHash = opts.adminPasswordHash ?? PLACEHOLDER_HASH;
  const staffHash = opts.staffPasswordHash ?? PLACEHOLDER_HASH;
  const staffEmail = opts.staffEmail ?? 'staff@example.com';
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
    ['サンプル 太郎', staffEmail, staffHash],
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

// ---------------------------------------------------------------------------
// Demo roster — additional staff/stadiums so the admin 全体実績 view looks like a
// real operation (not a single sample row). Called ONLY from the live-demo seed
// paths (memoryDb / seed), never from the test harness, so tests stay pinned to
// the golden single-staff month. Every shift is kept under the 丙 table's
// transcribed ceiling (~11h/day), so no provisional tax ever shows in the demo.
// ---------------------------------------------------------------------------

interface RosterShift {
  /** June-2026 day numbers this person worked. */
  days: number[];
  start: string; // 'HH:MM'
  end: string;
  breakMin: number;
}

interface RosterStaff {
  name: string;
  email: string;
  homeStation: string;
  address: string;
  phone: string;
  /** Index into DEMO_STADIUMS. */
  stadium: number;
  /** One-way fare home ⇄ stadium (¥). */
  fareYen: number;
  bucket: 'daikai' | 'henshu';
  tournament: boolean;
  shift: RosterShift;
}

const DEMO_STADIUMS = [
  { name: '阪神甲子園球場', address: '兵庫県西宮市甲子園町1-82', station: '甲子園' },
  { name: '明治神宮野球場', address: '東京都新宿区霞ヶ丘町3-1', station: '千駄ケ谷' },
];

const DEMO_ROSTER: RosterStaff[] = [
  {
    name: '田中 花子', email: 'tanaka.hanako@example.com', homeStation: '西宮',
    address: '兵庫県西宮市今津', phone: '090-1111-0001', stadium: 0, fareYen: 320,
    bucket: 'daikai', tournament: true,
    shift: { days: [1, 2, 4, 5, 8, 9, 11, 12, 15, 16, 18, 19], start: '09:00', end: '18:00', breakMin: 60 },
  },
  {
    name: '佐藤 健', email: 'sato.ken@example.com', homeStation: '三宮',
    address: '兵庫県神戸市中央区', phone: '090-1111-0002', stadium: 0, fareYen: 280,
    bucket: 'henshu', tournament: false,
    shift: { days: [3, 5, 9, 10, 12, 17, 19, 24, 26], start: '10:00', end: '19:00', breakMin: 60 },
  },
  {
    name: '鈴木 一郎', email: 'suzuki.ichiro@example.com', homeStation: '尼崎',
    address: '兵庫県尼崎市', phone: '090-1111-0003', stadium: 0, fareYen: 180,
    bucket: 'daikai', tournament: true,
    shift: { days: [1, 4, 8, 10, 15, 17, 22, 24, 29, 30], start: '12:00', end: '21:00', breakMin: 60 },
  },
  {
    name: '高橋 美咲', email: 'takahashi.misaki@example.com', homeStation: '新宿',
    address: '東京都新宿区', phone: '090-2222-0004', stadium: 1, fareYen: 200,
    bucket: 'henshu', tournament: false,
    shift: { days: [2, 5, 9, 12, 16, 23, 25, 30], start: '09:30', end: '18:30', breakMin: 60 },
  },
  {
    name: '伊藤 大輔', email: 'ito.daisuke@example.com', homeStation: '渋谷',
    address: '東京都渋谷区', phone: '090-2222-0005', stadium: 1, fareYen: 170,
    bucket: 'daikai', tournament: true,
    shift: { days: [1, 3, 8, 10, 15, 18, 22, 24, 26, 29, 30], start: '08:00', end: '17:00', breakMin: 60 },
  },
  {
    name: '渡辺 さやか', email: 'watanabe.sayaka@example.com', homeStation: '四ツ谷',
    address: '東京都新宿区四谷', phone: '090-2222-0006', stadium: 1, fareYen: 160,
    bucket: 'henshu', tournament: false,
    shift: { days: [4, 11, 18, 19, 25, 26, 29], start: '10:00', end: '18:00', breakMin: 60 },
  },
];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

export interface DemoRosterOptions {
  /** Password hash so the roster accounts can also be logged into (optional). */
  staffPasswordHash?: string;
}

/** Adds the demo stadiums, staff, fares, attendance and transport lines. */
export async function seedDemoRoster(
  db: Queryable,
  opts: DemoRosterOptions = {},
): Promise<void> {
  const staffHash = opts.staffPasswordHash ?? PLACEHOLDER_HASH;

  // Stadiums.
  const stadiumIds: number[] = [];
  for (const s of DEMO_STADIUMS) {
    const row = await db.query(
      `INSERT INTO stadiums (name, address, nearest_station)
       VALUES ($1, $2, $3) RETURNING id`,
      [s.name, s.address, s.station],
    );
    stadiumIds.push(row.rows[0].id as number);
  }

  for (const person of DEMO_ROSTER) {
    const stadium = DEMO_STADIUMS[person.stadium]!;
    const stadiumId = stadiumIds[person.stadium]!;

    const user = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'staff') RETURNING id`,
      [person.name, person.email, staffHash],
    );
    const userId = user.rows[0].id as number;

    await db.query(
      `INSERT INTO staff_profiles (user_id, address, home_nearest_station, phone)
       VALUES ($1, $2, $3, $4)`,
      [userId, person.address, person.homeStation, person.phone],
    );

    // Route fare, both directions: home ⇄ stadium station.
    await db.query(
      `INSERT INTO route_fares (from_station, to_station, one_way_fare, mode, route_note)
       VALUES ($1, $2, $3, $4, $5), ($2, $1, $3, $4, $6)`,
      [
        person.homeStation, stadium.station, person.fareYen, 'バス・電車',
        `${person.homeStation}→${stadium.station}`, `${stadium.station}→${person.homeStation}`,
      ],
    );

    const startMin = toMinutes(person.shift.start);
    const endMin = toMinutes(person.shift.end);

    for (const day of person.shift.days) {
      const date = `2026-06-${String(day).padStart(2, '0')}`;

      await db.query(
        `INSERT INTO attendance
           (staff_id, work_date, stadium_id, start_minutes, end_minutes,
            break_taken, break_minutes, bucket, overtime_minutes, night_minutes, tournament)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9)`,
        [userId, date, stadiumId, startMin, endMin, person.shift.breakMin > 0,
          person.shift.breakMin, person.bucket, person.tournament],
      );

      // Round-trip transport: one-way fare × 2 (to + from), matching the fixture style.
      await db.query(
        `INSERT INTO expense_lines
           (staff_id, expense_date, category, bucket, amount_yen, description, source)
         VALUES ($1, $2, 'transport', $3, $4, $5, 'auto'), ($1, $2, 'transport', $3, $4, $6, 'auto')`,
        [
          userId, date, person.bucket, person.fareYen,
          `${person.homeStation} → ${stadium.station}（バス・電車）`,
          `${stadium.station} → ${person.homeStation}（バス・電車）`,
        ],
      );
    }
  }
}
