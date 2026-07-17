-- 001_initial_schema.sql
-- Asahi part-time attendance & expense system — initial data model.
--
-- Notes:
--  * Enums are modelled as TEXT + CHECK (portable, easy to extend, migration-friendly).
--  * Money is integer yen. Time-of-day is "minutes from midnight" (0..1440).
--  * The 丙 withholding-tax table is NOT stored here — it lives in @asahi/shared as the
--    engine's single source of truth (verified against the client scans). Only the
--    admin-editable pay rates live in the DB (rate_config).

-- Accounts (staff + admin). Single login; role decides routing.
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extra master data for staff accounts (アルバイトマスタ).
CREATE TABLE staff_profiles (
  user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  address              TEXT,
  home_nearest_station TEXT,
  phone                TEXT
);

-- 球場マスタ.
CREATE TABLE stadiums (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  address         TEXT,
  nearest_station TEXT NOT NULL
);

-- 区間別交通費マスタ (home nearest station ⇔ stadium nearest station).
-- One-way fare; the engine emits a round trip (×2) per work day.
CREATE TABLE route_fares (
  id           SERIAL PRIMARY KEY,
  from_station TEXT NOT NULL,
  to_station   TEXT NOT NULL,
  one_way_fare INTEGER NOT NULL CHECK (one_way_fare >= 0),
  mode         TEXT,
  route_note   TEXT,
  UNIQUE (from_station, to_station)
);

-- 勤怠 (attendance). Staff enter date/start/end/stadium/break; the rest is computed or admin-set.
CREATE TABLE attendance (
  id               SERIAL PRIMARY KEY,
  staff_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date        DATE NOT NULL,
  stadium_id       INTEGER NOT NULL REFERENCES stadiums(id),
  start_minutes    INTEGER NOT NULL CHECK (start_minutes >= 0 AND start_minutes <= 1440),
  end_minutes      INTEGER NOT NULL CHECK (end_minutes >= 0 AND end_minutes <= 1440),
  break_taken      BOOLEAN NOT NULL DEFAULT FALSE,
  break_minutes    INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  bucket           TEXT NOT NULL DEFAULT 'henshu' CHECK (bucket IN ('daikai', 'henshu')),
  overtime_minutes INTEGER NOT NULL DEFAULT 0 CHECK (overtime_minutes >= 0),
  night_minutes    INTEGER NOT NULL DEFAULT 0 CHECK (night_minutes >= 0),
  tournament       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, work_date),
  CHECK (end_minutes - start_minutes - break_minutes >= 0)
);

-- Expense lines. Transport rows are auto-generated from route_fares (source='auto');
-- per-diem / phone / lodging / other are manual.
CREATE TABLE expense_lines (
  id           SERIAL PRIMARY KEY,
  staff_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('transport', 'perdiem', 'phone', 'lodging', 'other')),
  bucket       TEXT NOT NULL DEFAULT 'henshu' CHECK (bucket IN ('daikai', 'henshu')),
  amount_yen   INTEGER NOT NULL CHECK (amount_yen >= 0),
  description  TEXT,
  source       TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin-editable pay rates (no redeploy). Seeded from the 請求明細書.
CREATE TABLE rate_config (
  id                   SERIAL PRIMARY KEY,
  effective_year       TEXT NOT NULL UNIQUE,
  hourly_yen           INTEGER NOT NULL,
  overtime_under60_yen INTEGER NOT NULL,
  overtime_over60_yen  INTEGER NOT NULL,
  night_yen            INTEGER NOT NULL,
  lunch_yen            INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_staff_date ON attendance (staff_id, work_date);
CREATE INDEX idx_expense_staff_date ON expense_lines (staff_id, expense_date);
CREATE INDEX idx_route_fares_pair ON route_fares (from_station, to_station);
