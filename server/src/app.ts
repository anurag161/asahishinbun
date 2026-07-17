import fs from 'node:fs';
import path from 'node:path';
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
import { documentsRouter, type DocumentDeps } from './routes/documents';
import { puppeteerRenderer } from './pdf/pdfRenderer';
import { createMailer } from './services/emailService';

export type AppDeps = Partial<DocumentDeps>;

/** Build the Express app around a database. `db` and `deps` are injectable for testing. */
export function createApp(db: Db, deps: AppDeps = {}) {
  const documentDeps: DocumentDeps = {
    pdf: deps.pdf ?? puppeteerRenderer,
    mailer: deps.mailer ?? createMailer(),
  };

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
  app.use('/api/documents', documentsRouter(db, documentDeps));

  // Serve the built client (single-origin) when it exists, with SPA fallback.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  const indexHtml = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(indexHtml);
        return;
      }
      next();
    });
  }

  app.use(errorHandler);
  return app;
}
