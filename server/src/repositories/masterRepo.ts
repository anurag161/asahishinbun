import type { RateConfig } from '@asahi/shared';
import type { Db } from '../db/Db';
import type { RateConfigRow, RouteFareRow, StadiumRow } from '../db/types';

export const masterRepo = {
  // --- 球場マスタ ---
  async listStadiums(db: Db): Promise<StadiumRow[]> {
    const { rows } = await db.query<StadiumRow>(
      `SELECT * FROM stadiums ORDER BY id`,
    );
    return rows;
  },

  async getStadium(db: Db, id: number): Promise<StadiumRow | undefined> {
    const { rows } = await db.query<StadiumRow>(
      `SELECT * FROM stadiums WHERE id = $1`,
      [id],
    );
    return rows[0];
  },

  async createStadium(
    db: Db,
    s: { name: string; address?: string | null; nearestStation: string },
  ): Promise<StadiumRow> {
    const { rows } = await db.query<StadiumRow>(
      `INSERT INTO stadiums (name, address, nearest_station)
       VALUES ($1, $2, $3) RETURNING *`,
      [s.name, s.address ?? null, s.nearestStation],
    );
    return rows[0]!;
  },

  async updateStadium(
    db: Db,
    id: number,
    s: { name: string; address?: string | null; nearestStation: string },
  ): Promise<StadiumRow | undefined> {
    const { rows } = await db.query<StadiumRow>(
      `UPDATE stadiums SET name = $2, address = $3, nearest_station = $4
       WHERE id = $1 RETURNING *`,
      [id, s.name, s.address ?? null, s.nearestStation],
    );
    return rows[0];
  },

  async removeStadium(db: Db, id: number): Promise<void> {
    await db.query(`DELETE FROM stadiums WHERE id = $1`, [id]);
  },

  /**
   * Every station name auto transport can currently match on, split by where it
   * came from (球場マスタ vs アルバイトマスタ).
   *
   * findRouteFare matches the station strings EXACTLY, so a route typed as
   * 甲子園駅 against a stadium registered as 阪神甲子園駅 never resolves and the
   * day silently books ¥0. Offering these names as a choice on 区間マスタ is what
   * removes that failure mode.
   *
   * Deduped and sorted in JS rather than with DISTINCT/ORDER BY so the query
   * stays plain enough for both Postgres and the in-memory demo DB.
   */
  async listKnownStations(db: Db): Promise<{ stadiums: string[]; homes: string[] }> {
    const clean = (rows: { station: string | null }[]) =>
      [...new Set(rows.map((r) => r.station?.trim()).filter((s): s is string => !!s))].sort();

    const { rows: stadiumRows } = await db.query<{ station: string | null }>(
      `SELECT nearest_station AS station FROM stadiums`,
    );
    const { rows: homeRows } = await db.query<{ station: string | null }>(
      `SELECT home_nearest_station AS station FROM staff_profiles`,
    );
    return { stadiums: clean(stadiumRows), homes: clean(homeRows) };
  },

  // --- 区間別交通費マスタ ---
  async listRouteFares(db: Db): Promise<RouteFareRow[]> {
    const { rows } = await db.query<RouteFareRow>(
      `SELECT * FROM route_fares ORDER BY id`,
    );
    return rows;
  },

  async findRouteFare(
    db: Db,
    fromStation: string,
    toStation: string,
  ): Promise<RouteFareRow | undefined> {
    const { rows } = await db.query<RouteFareRow>(
      `SELECT * FROM route_fares WHERE from_station = $1 AND to_station = $2`,
      [fromStation, toStation],
    );
    return rows[0];
  },

  async getRouteFare(db: Db, id: number): Promise<RouteFareRow | undefined> {
    const { rows } = await db.query<RouteFareRow>(
      `SELECT * FROM route_fares WHERE id = $1`,
      [id],
    );
    return rows[0];
  },

  async updateRouteFare(
    db: Db,
    id: number,
    r: {
      fromStation: string;
      toStation: string;
      oneWayFare: number;
      mode?: string | null;
      routeNote?: string | null;
    },
  ): Promise<RouteFareRow | undefined> {
    const { rows } = await db.query<RouteFareRow>(
      `UPDATE route_fares
         SET from_station = $2, to_station = $3, one_way_fare = $4, mode = $5, route_note = $6
       WHERE id = $1 RETURNING *`,
      [id, r.fromStation, r.toStation, r.oneWayFare, r.mode ?? null, r.routeNote ?? null],
    );
    return rows[0];
  },

  async upsertRouteFare(
    db: Db,
    r: {
      fromStation: string;
      toStation: string;
      oneWayFare: number;
      mode?: string | null;
      routeNote?: string | null;
    },
  ): Promise<RouteFareRow> {
    const { rows } = await db.query<RouteFareRow>(
      `INSERT INTO route_fares (from_station, to_station, one_way_fare, mode, route_note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (from_station, to_station) DO UPDATE SET
         one_way_fare = EXCLUDED.one_way_fare,
         mode = EXCLUDED.mode,
         route_note = EXCLUDED.route_note
       RETURNING *`,
      [r.fromStation, r.toStation, r.oneWayFare, r.mode ?? null, r.routeNote ?? null],
    );
    return rows[0]!;
  },

  async removeRouteFare(db: Db, id: number): Promise<void> {
    await db.query(`DELETE FROM route_fares WHERE id = $1`, [id]);
  },

  // --- rate_config ---
  /** Most recent rate row, mapped to the engine's RateConfig; null if none. */
  async getLatestRates(db: Db): Promise<RateConfigRow | undefined> {
    const { rows } = await db.query<RateConfigRow>(
      `SELECT * FROM rate_config ORDER BY id DESC LIMIT 1`,
    );
    return rows[0];
  },

  async upsertRates(
    db: Db,
    year: string,
    r: RateConfig,
  ): Promise<RateConfigRow> {
    const { rows } = await db.query<RateConfigRow>(
      `INSERT INTO rate_config
         (effective_year, hourly_yen, overtime_under60_yen, overtime_over60_yen, night_yen, lunch_yen)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (effective_year) DO UPDATE SET
         hourly_yen = EXCLUDED.hourly_yen,
         overtime_under60_yen = EXCLUDED.overtime_under60_yen,
         overtime_over60_yen = EXCLUDED.overtime_over60_yen,
         night_yen = EXCLUDED.night_yen,
         lunch_yen = EXCLUDED.lunch_yen
       RETURNING *`,
      [
        year,
        r.hourlyYen,
        r.overtimeUnder60Yen,
        r.overtimeOver60Yen,
        r.nightYen,
        r.lunchYen,
      ],
    );
    return rows[0]!;
  },
};
