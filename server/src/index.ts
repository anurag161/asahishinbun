import { createApp } from './app';
import { config } from './config';
import type { Db } from './db/Db';
import { createMailer } from './services/emailService';
import { puppeteerRenderer } from './pdf/pdfRenderer';

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
    console.log(`     Demo logins:  admin@example.com / admin123   ·   ${config.demoStaffEmail} / staff123\n`);
  }

  const mailer = createMailer();
  const pdfEngine = await (
    puppeteerRenderer as typeof puppeteerRenderer & { describe(): Promise<string | null> }
  ).describe();

  const app = createApp(db, { mailer, pdf: puppeteerRenderer });
  app.listen(config.port, () => {
    console.log(`Asahi payroll app listening on http://localhost:${config.port}`);
    console.log(
      `  • PDF:   ${pdfEngine ? `server-side enabled via ${pdfEngine}` : 'browser Save-as-PDF only (no Chromium could be started)'}`,
    );
    const emailMode = config.brevoApiKey
      ? 'Brevo HTTPS API (works on Render — no SMTP ports needed)'
      : config.resendApiKey
        ? 'Resend HTTPS API (works on Render — no SMTP ports needed)'
        : mailer.live
          ? `SMTP (${config.smtp.host}) — blocked on Render free; set BREVO_API_KEY for HTTPS delivery`
          : 'Ethereal preview mode — set BREVO_API_KEY (or SMTP_*) for real delivery';
    console.log(`  • Email: ${emailMode}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
