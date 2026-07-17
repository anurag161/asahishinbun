import { createApp } from './app';
import { config } from './config';
import type { Db } from './db/Db';

async function bootstrap() {
  let db: Db;

  if (config.databaseUrl) {
    // Real Postgres (Neon). Migrations/seed are run separately (npm run migrate/seed).
    const { pool } = await import('./db/pool');
    db = pool;
    console.log('Using Postgres from DATABASE_URL.');
  } else {
    // Zero-setup demo: in-memory Postgres, migrated + seeded on boot.
    const { createMemoryDb } = await import('./db/memoryDb');
    db = await createMemoryDb();
    console.log('\n  ⚠  No DATABASE_URL set — running with an IN-MEMORY database.');
    console.log('     Data resets on restart. For a persistent DB, set DATABASE_URL (Neon).');
    console.log('     Demo logins:  admin@example.com / admin123   ·   staff@example.com / staff123\n');
  }

  const app = createApp(db);
  app.listen(config.port, () => {
    console.log(`Asahi payroll app listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
