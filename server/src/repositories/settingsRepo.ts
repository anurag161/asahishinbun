import type { Db } from '../db/Db';

/**
 * Admin-editable application settings (app_settings), keyed by name.
 *
 * Deliberately tiny: one place to read and write single-value settings without
 * a migration per setting. Pay rates keep their own typed table (rate_config) —
 * they are a versioned record, not a switch.
 */

/** Where document email is sent while an admin is checking delivery. */
export const EMAIL_TEST_RECIPIENT = 'email.test_recipient';

export const settingsRepo = {
  async get(db: Db, key: string): Promise<string | null> {
    const { rows } = await db.query<{ value: string | null }>(
      `SELECT value FROM app_settings WHERE key = $1`,
      [key],
    );
    // No row and a cleared row mean the same thing to callers.
    return rows[0]?.value ?? null;
  },

  async set(db: Db, key: string, value: string | null): Promise<void> {
    await db.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value],
    );
  },
};
