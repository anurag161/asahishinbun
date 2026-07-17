import { pool } from './pool';
import { config } from '../config';
import { runMigrations } from './migrate';
import { seedSampleMonth } from './sampleData';
import { hashPassword } from '../auth/password';

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

  // Demo credentials: admin@example.com / admin123, staff@example.com / staff123
  const [adminPasswordHash, staffPasswordHash] = await Promise.all([
    hashPassword('admin123'),
    hashPassword('staff123'),
  ]);
  const { staffId } = await seedSampleMonth(pool, {
    adminPasswordHash,
    staffPasswordHash,
  });
  console.log(`Seeded June 2026 sample month (staff_id=${staffId}).`);
  console.log('Demo login — admin@example.com / admin123 · staff@example.com / staff123');
}

seed()
  .then(() => pool.end())
  .then(() => console.log('Seed complete'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
