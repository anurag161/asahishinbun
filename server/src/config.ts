import dotenv from 'dotenv';

dotenv.config();

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
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Asahi Payroll Demo <noreply@example.com>',
  },
};
