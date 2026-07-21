import type { Db } from '../db/Db';
import type { Role, StaffProfileRow, UserRow } from '../db/types';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export type StaffWithProfile = PublicUser & {
  address: string | null;
  home_nearest_station: string | null;
  phone: string | null;
};

export const userRepo = {
  async findByEmail(db: Db, email: string): Promise<UserRow | undefined> {
    const { rows } = await db.query<UserRow>(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );
    return rows[0];
  },

  async findById(db: Db, id: number): Promise<UserRow | undefined> {
    const { rows } = await db.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [
      id,
    ]);
    return rows[0];
  },

  async create(
    db: Db,
    u: { name: string; email: string; passwordHash: string; role: Role },
  ): Promise<PublicUser> {
    const { rows } = await db.query<PublicUser>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [u.name, u.email, u.passwordHash, u.role],
    );
    return rows[0]!;
  },

  /** List staff accounts joined with their profile (アルバイトマスタ). */
  async listStaff(db: Db): Promise<StaffWithProfile[]> {
    const { rows } = await db.query<StaffWithProfile>(
      `SELECT u.id, u.name, u.email, u.role,
              p.address, p.home_nearest_station, p.phone
       FROM users u
       LEFT JOIN staff_profiles p ON p.user_id = u.id
       WHERE u.role = 'staff'
       ORDER BY u.id`,
    );
    return rows;
  },

  async getProfile(db: Db, userId: number): Promise<StaffProfileRow | undefined> {
    const { rows } = await db.query<StaffProfileRow>(
      `SELECT * FROM staff_profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0];
  },

  async upsertProfile(
    db: Db,
    p: {
      userId: number;
      address?: string | null;
      homeNearestStation?: string | null;
      phone?: string | null;
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO staff_profiles (user_id, address, home_nearest_station, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         address = EXCLUDED.address,
         home_nearest_station = EXCLUDED.home_nearest_station,
         phone = EXCLUDED.phone`,
      [p.userId, p.address ?? null, p.homeNearestStation ?? null, p.phone ?? null],
    );
  },

  /** All accounts (both roles) for the account-management screen. */
  async listAll(db: Db): Promise<PublicUser[]> {
    const { rows } = await db.query<PublicUser>(
      `SELECT id, name, email, role FROM users ORDER BY id`,
    );
    return rows;
  },

  async updateName(db: Db, id: number, name: string): Promise<void> {
    await db.query(`UPDATE users SET name = $2 WHERE id = $1`, [id, name]);
  },

  async updateAccount(
    db: Db,
    id: number,
    f: { name: string; email: string; role: Role },
  ): Promise<PublicUser | undefined> {
    const { rows } = await db.query<PublicUser>(
      `UPDATE users SET name = $2, email = $3, role = $4
       WHERE id = $1 RETURNING id, name, email, role`,
      [id, f.name, f.email, f.role],
    );
    return rows[0];
  },

  async setPassword(db: Db, id: number, passwordHash: string): Promise<void> {
    await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
  },

  async adminCount(db: Db): Promise<number> {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users WHERE role = 'admin'`,
    );
    return rows[0]?.n ?? 0;
  },

  async remove(db: Db, id: number): Promise<void> {
    await db.query(`DELETE FROM users WHERE id = $1`, [id]);
  },
};
