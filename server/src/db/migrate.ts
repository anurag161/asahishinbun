import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import { pool } from './pool';

/**
 * Applies every pending .sql file in migrations/ in filename order, tracking
 * applied files in schema_migrations. Idempotent: already-applied files are skipped.
 * Each migration runs in its own transaction.
 */
export async function runMigrations(db: Pool = pool): Promise<string[]> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied: string[] = [];
  for (const file of files) {
    const { rows } = await db.query(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [file],
    );
    if (rows.length > 0) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await db.query('COMMIT');
      console.log(`Applied ${file}`);
      applied.push(file);
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  }

  return applied;
}

// Run directly (npm run migrate).
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .then(() => console.log('Migrations complete'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
