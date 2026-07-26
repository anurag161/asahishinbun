import { Router } from 'express';
import type { Db } from '../db/Db';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, type AuthRequest } from '../middleware/authMiddleware';
import { DOCUMENT_TYPES, type DocumentType } from '../documents/context';
import { renderDocument } from '../documents/documentService';
import { userRepo } from '../repositories/userRepo';
import type { PdfRenderer } from '../pdf/pdfRenderer';
import type { Mailer } from '../services/emailService';
import { optStr, str } from '../utils/parse';

export interface DocumentDeps {
  pdf: PdfRenderer;
  mailer: Mailer;
}

// Deliberately permissive — the mail server is the real authority on which
// addresses exist. This only rejects input that could not be an address at all.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

      // Optional custom recipient. Lets the client send a document to an address
      // of their choosing to confirm mail delivery works, without editing (or
      // temporarily corrupting) the staff member's registered email.
      const requested = optStr(req.body, 'to')?.trim();
      const to = requested || staff.email;
      if (!EMAIL_RE.test(to)) {
        throw new AppError(400, `Invalid recipient email: ${to}`);
      }

      const doc = await renderDocument(db, type, staffId, month);

      // Attach a PDF when available; otherwise send the document inline as HTML.
      const attachments = [];
      let pdfAttached = false;
      if (await deps.pdf.available()) {
        const pdf = await deps.pdf.render(doc.html);
        attachments.push({
          filename: `${doc.filenameBase}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        });
        pdfAttached = true;
      }

      const { messageId, mode, previewUrl } = await deps.mailer.send({
        to,
        subject: `【朝日新聞】${doc.title}`,
        html: doc.html,
        attachments,
      });

      res.json({
        sent: true,
        to,
        pdfAttached,
        delivery: mode,
        previewUrl,
        messageId,
      });
    }),
  );

  return router;
}
