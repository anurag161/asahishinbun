import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Db } from './db/Db';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { attendanceRouter } from './routes/attendance';
import { expensesRouter } from './routes/expenses';
import { mypageRouter } from './routes/mypage';
import { stadiumsRouter } from './routes/stadiums';
import { adminRouter } from './routes/admin';
import { payrollRouter } from './routes/payroll';

/** Build the Express app around a database. `db` is injectable for testing. */
export function createApp(db: Db) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter(db));
  app.use('/api/attendance', attendanceRouter(db));
  app.use('/api/expenses', expensesRouter(db));
  app.use('/api/mypage', mypageRouter(db));
  app.use('/api/stadiums', stadiumsRouter(db));
  app.use('/api/admin', adminRouter(db));
  app.use('/api/payroll', payrollRouter(db));

  app.use(errorHandler);
  return app;
}
