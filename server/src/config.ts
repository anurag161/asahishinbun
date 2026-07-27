import path from 'node:path';
import dotenv from 'dotenv';

// Load .env from the current dir, the repo root, and the server dir (first wins),
// so both `npm run demo` (root cwd) and `npm run dev -w server` (server cwd) find it.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

function requiredInProd(key: string, devFallback: string): string {
  const val = process.env[key];
  if (val) return val;
  if (isProd) throw new Error(`Missing required env var in production: ${key}`);
  return devFallback;
}

export const config = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseTestUrl: process.env.DATABASE_TEST_URL ?? '',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  // Dev fallback keeps local/test runs frictionless; production must set a real secret.
  jwtSecret: requiredInProd('JWT_SECRET', 'dev-insecure-jwt-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  // Resend's HTTP API. Preferred over SMTP_* because it uses port 443, which
  // hosts do not block — Render's free instances block 25/465/587 outright.
  //
  // Read on access rather than captured at import: this decides which delivery
  // path is taken, and the rest of the config is frozen before a test (or a
  // process that loads .env late) can set it.
  get resendApiKey(): string {
    return process.env.RESEND_API_KEY ?? '';
  },
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Asahi Payroll Demo <noreply@example.com>',
  },
  // Email for the seeded sample staff member. Set to a real inbox so emailed
  // documents actually arrive; defaults to the throwaway demo address.
  demoStaffEmail: process.env.DEMO_STAFF_EMAIL ?? 'staff@example.com',
};
