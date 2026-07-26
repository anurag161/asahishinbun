import { Router } from 'express';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { DOCUMENT_TYPES, type DocumentType } from '../documents/context';
import { renderDocument } from '../documents/documentService';
import { userRepo } from '../repositories/userRepo';
import type { PdfRenderer } from '../pdf/pdfRenderer';
import type { Mailer } from '../services/emailService';
import { str } from '../utils/parse';
import { settingsRepo, EMAIL_TEST_RECIPIENT } from '../repositories/settingsRepo';

export interface DocumentDeps {
  pdf: PdfRenderer;
  mailer: Mailer;
}

function parseType(raw: string): DocumentType {
  if (!DOCUMENT_TYPES.includes(raw as DocumentType)) {
    throw new AppError(404, `Unknown document type: ${raw}`);
  }
  return raw as DocumentType;
}

function assertCanAccess(req: AuthRequest, staffId: number): void {
  if (req.user!.role !== 'admin' && req.user!.id !== staffId) {
    throw new AppError(403, 'Forbidden');
  }
}

export function documentsRouter(db: Db, deps: DocumentDeps): Router {
  const router = Router();
  router.use(authMiddleware);

  // GET /api/documents/:type/:staffId?month=YYYY-MM&format=html|pdf
  router.get(
    '/:type/:staffId',
    asyncHandler(async (req: AuthRequest, res) => {
      const type = parseType(req.params.type!);
      const staffId = Number(req.params.staffId);
      assertCanAccess(req, staffId);
      const month = str(req.query as Record<string, unknown>, 'month');
      const format = (req.query.format as string) ?? 'html';

      const doc = await renderDocument(db, type, staffId, month);

      if (format === 'pdf') {
        if (!(await deps.pdf.available())) {
          throw new AppError(
            501,
            'Server-side PDF is not enabled. Open the HTML and use the browser\'s "Save as PDF", or install puppeteer (see README).',
          );
        }
        const pdf = await deps.pdf.render(doc.html);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${doc.filenameBase}.pdf"`,
        );
        res.send(pdf);
        return;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(doc.html);
    }),
  );

  // POST /api/documents/:type/:staffId/email?month=YYYY-MM
  router.post(
    '/:type/:staffId/email',
    asyncHandler(async (req: AuthRequest, res) => {
      const type = parseType(req.params.type!);
      const staffId = Number(req.params.staffId);
      assertCanAccess(req, staffId);
      const month = str(req.query as Record<string, unknown>, 'month');

      const staff = await userRepo.findById(db, staffId);
      if (!staff) throw new AppError(404, 'Staff not found');

      // メール設定: while an admin has a test recipient configured, every document
      // email is diverted there so delivery can be checked against an inbox they
      // can actually read. It is a redirect, not an edit — nobody's registered
      // address changes, and clearing the setting restores normal delivery.
      const override = await settingsRepo.get(db, EMAIL_TEST_RECIPIENT);
      const to = override ?? staff.email;
      const redirected = to !== staff.email;

      const doc = await renderDocument(db, type, staffId, month);

      // Attach a PDF when available; otherwise send the document inline as HTML.
      //
      // The attachment is a bonus, not the payload — the HTML body IS the
      // document. So a rendering failure must not sink the send: Chromium can
      // be present but unable to start, and letting that propagate turned "your
      // payslip email" into a 500 with nothing delivered.
      const attachments = [];
      let pdfAttached = false;
      if (await deps.pdf.available()) {
        try {
          const pdf = await deps.pdf.render(doc.html);
          attachments.push({
            filename: `${doc.filenameBase}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          });
          pdfAttached = true;
        } catch (err) {
          console.warn(
            `PDF attachment failed, sending HTML only: ${(err as Error).message.split('\n')[0]}`,
          );
        }
      }

      // Surface why delivery failed. Falling through to the generic handler gave
      // the UI "Internal server error", which says nothing about the mail server.
      let sendResult;
      try {
        sendResult = await deps.mailer.send({
          to,
          subject: `【朝日新聞】${doc.title}`,
          html: doc.html,
          attachments,
        });
      } catch (err) {
        throw new AppError(502, `Email delivery failed: ${(err as Error).message.split('\n')[0]}`);
      }
      const { messageId, mode, previewUrl } = sendResult;

      res.json({
        sent: true,
        to,
        // So the UI can say the mail went somewhere other than the staff member.
        redirected,
        intendedFor: staff.email,
        pdfAttached,
        delivery: mode,
        previewUrl,
        messageId,
      });
    }),
  );

  return router;
}
