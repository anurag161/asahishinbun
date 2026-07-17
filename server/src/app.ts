import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Db } from './db/Db';
import { config } from './config';
import { AppError, asyncHandler, errorHandler } from './middleware/errorHandler';
import { authMiddleware, type AuthRequest } from './middleware/authMiddleware';
import { requireRole } from './middleware/roleMiddleware';
import { userRepo } from './repositories/userRepo';
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

  // What the running server can actually do — the client uses this to guide the UI.
  app.get('/api/capabilities', async (_req, res) => {
    res.json({
      pdf: await documentDeps.pdf.available(),
      email: documentDeps.mailer.live,
    });
  });

  // Admin: send a test email to verify SMTP configuration (goes to the admin's own address).
  app.post(
    '/api/admin/test-email',
    authMiddleware,
    requireRole('admin'),
    asyncHandler(async (req: AuthRequest, res) => {
      const user = await userRepo.findById(db, req.user!.id);
      const to = (req.body?.to as string) || user?.email;
      if (!to) throw new AppError(400, 'No recipient address');
      const { messageId } = await documentDeps.mailer.send({
        to,
        subject: '【テスト】朝日新聞 勤怠・交通費システム',
        html: '<p>SMTP テストメールです。これが届いていれば送信設定は正常です。</p>',
      });
      res.json({
        sent: true,
        to,
        delivery: documentDeps.mailer.live ? 'smtp' : 'captured',
        messageId,
      });
    }),
  );

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
