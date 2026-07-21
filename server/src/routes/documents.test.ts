/**
 * Phase 4 document tests — HTML generation, PDF endpoint, and email flow.
 * Uses injected stubs for the PDF renderer and mailer, so the full flow is
 * verified WITHOUT Chromium or SMTP.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';
import type { PdfRenderer } from '../pdf/pdfRenderer';
import type { EmailMessage, Mailer } from '../services/emailService';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

function stubPdf(available: boolean): PdfRenderer {
  return {
    available: vi.fn(async () => available),
    render: vi.fn(async () => Buffer.from('%PDF-1.4 stub-pdf-bytes')),
  };
}

function stubMailer(): Mailer & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    live: false,
    sent,
    async send(message: EmailMessage) {
      sent.push(message);
      return { messageId: 'stub-1', mode: 'capture' as const };
    },
  };
}

describe('document HTML reproduces the client figures', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await makeTestContext({ pdf: stubPdf(true) });
  });

  it('payslip shows ¥185,152 net and ¥188 tax', async () => {
    const res = await request(ctx.app)
      .get(`/api/documents/payslip/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('給料計算書');
    expect(res.text).toContain('¥185,152');
    expect(res.text).toContain('¥188');
  });

  it('invoice shows ¥131,300 salary and ¥185,340 total', async () => {
    const res = await request(ctx.app)
      .get(`/api/documents/invoice/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.text).toContain('アルバイト料請求明細書');
    expect(res.text).toContain('¥131,300');
    expect(res.text).toContain('¥185,340');
  });

  it('timesheet shows the 101:00 total', async () => {
    const res = await request(ctx.app)
      .get(`/api/documents/timesheet/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.text).toContain('勤務表');
    expect(res.text).toContain('101:00');
  });
});

describe('PDF endpoint', () => {
  it('returns application/pdf when the renderer is available', async () => {
    const ctx = await makeTestContext({ pdf: stubPdf(true) });
    const res = await request(ctx.app)
      .get(`/api/documents/payslip/${ctx.staffId}?month=2026-06&format=pdf`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.toString('utf8').startsWith('%PDF')).toBe(true);
  });

  it('returns 501 when PDF rendering is unavailable', async () => {
    const ctx = await makeTestContext({ pdf: stubPdf(false) });
    const res = await request(ctx.app)
      .get(`/api/documents/payslip/${ctx.staffId}?month=2026-06&format=pdf`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(501);
  });
});

describe('email flow', () => {
  it('emails the document to the staff member with a PDF attachment', async () => {
    const mailer = stubMailer();
    const ctx = await makeTestContext({ pdf: stubPdf(true), mailer });

    const res = await request(ctx.app)
      .post(`/api/documents/payslip/${ctx.staffId}/email?month=2026-06`)
      .set(auth(ctx.staffToken));

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(true);
    expect(res.body.to).toBe('staff@example.com');
    expect(res.body.pdfAttached).toBe(true);

    expect(mailer.sent).toHaveLength(1);
    const msg = mailer.sent[0]!;
    expect(msg.to).toBe('staff@example.com');
    expect(msg.subject).toContain('給料計算書');
    expect(msg.attachments?.[0]?.contentType).toBe('application/pdf');
  });

  it('passes the delivery mode and Ethereal preview URL back to the client', async () => {
    const mailer: Mailer = {
      live: false,
      async send() {
        return { messageId: 'eth-1', mode: 'ethereal', previewUrl: 'https://ethereal.email/message/abc' };
      },
    };
    const ctx = await makeTestContext({ pdf: stubPdf(true), mailer });

    const res = await request(ctx.app)
      .post(`/api/documents/payslip/${ctx.staffId}/email?month=2026-06`)
      .set(auth(ctx.staffToken));

    expect(res.status).toBe(200);
    expect(res.body.delivery).toBe('ethereal');
    expect(res.body.previewUrl).toBe('https://ethereal.email/message/abc');
  });

  it('still emails (HTML only) when PDF is unavailable', async () => {
    const mailer = stubMailer();
    const ctx = await makeTestContext({ pdf: stubPdf(false), mailer });

    const res = await request(ctx.app)
      .post(`/api/documents/invoice/${ctx.staffId}/email?month=2026-06`)
      .set(auth(ctx.staffToken));

    expect(res.status).toBe(200);
    expect(res.body.pdfAttached).toBe(false);
    expect(mailer.sent[0]?.attachments ?? []).toHaveLength(0);
  });
});

describe('document access control', () => {
  it('forbids a staff member from another staff\'s documents', async () => {
    const ctx = await makeTestContext({ pdf: stubPdf(true) });
    const res = await request(ctx.app)
      .get(`/api/documents/payslip/${ctx.staffId + 999}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(403);
  });

  it('allows admin to fetch any staff document', async () => {
    const ctx = await makeTestContext({ pdf: stubPdf(true) });
    const res = await request(ctx.app)
      .get(`/api/documents/payslip/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.adminToken));
    expect(res.status).toBe(200);
  });
});
