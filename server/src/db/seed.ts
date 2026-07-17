import { pool } from './pool';
import { config } from '../config';
import { runMigrations } from './migrate';
import { seedSampleMonth } from './sampleData';

/**
 * Dev/demo seed: applies migrations, resets domain tables, and loads the June
 * 2026 sample month. Refuses to run in production so it can never wipe real data.
 */
async function seed() {
  if (config.nodeEnv === 'production') {
    throw new Error('Refusing to seed in production.');
  }

  await runMigrations(pool);

  await pool.query(
    `TRUNCATE users, stadiums, route_fares, rate_config,
              staff_profiles, attendance, expense_lines
     RESTART IDENTITY CASCADE`,
  );

  const { staffId } = await seedSampleMonth(pool);
  console.log(`Seeded June 2026 sample month (staff_id=${staffId}).`);
}

seed()
  .then(() => pool.end())
  .then(() => console.log('Seed complete'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
