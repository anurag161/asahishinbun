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

  it('交通費 (別紙) lists one row per one-way leg and totals ¥54,040', async () => {
    const res = await request(ctx.app)
      .get(`/api/documents/transport/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.text).toContain('交通費');
    expect(res.text).toContain('区間明細（片道）');
    // 14 work days × 2 legs, each ¥1,930 → 28 rows summing to ¥54,040.
    expect(res.text.match(/⇒/g)).toHaveLength(28);
    expect(res.text.match(/1,930/g)).toHaveLength(28);
    expect(res.text).toContain('54,040');
    // The auto description 円山 → 大阪（バス・電車）splits into 区間 + 交通手段.
    expect(res.text).toContain('円山');
    expect(res.text).toContain('バス・電車');
  });

  it('出張日当/私有携帯/その他 (別紙) renders all three sections', async () => {
    const res = await request(ctx.app)
      .get(`/api/documents/allowances/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.text).toContain('出張日当');
    expect(res.text).toContain('私有携帯電話使用料');
    expect(res.text).toContain('その他（宿泊実費etc.）');
    // The June sample has no such lines — each section prints 該当なし, not a wrong figure.
    expect(res.text.match(/該当なし/g)).toHaveLength(3);
  });

  it('timesheet shows the 101:00 total', async () => {
    const res = await request(ctx.app)
      .get(`/api/documents/timesheet/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.text).toContain('勤務表');
    expect(res.text).toContain('101:00');
  });

  /**
   * The duration-format rule, pinned end to end.
   *
   * MORABU's paper 勤務表 writes durations as h:mm, so every per-day 休憩/実働 cell
   * must too — 7.83 both looks like a different document and is one glance away
   * from being read as 7:83. The exception is the figure a rate is multiplied by
   * (時給換算用勤務時間, and the 時給 note on the 請求明細書): that one is decimal,
   * because 101 × ¥1,300 = ¥131,300 is where the wage comes from.
   *
   * This holds for the PDF as well without a second assertion: documents.ts
   * renders the PDF from this exact HTML (deps.pdf.render(doc.html)).
   */
  it('writes per-day 休憩/実働 as h:mm and the rate-multiplied hours as decimal', async () => {
    const timesheet = await request(ctx.app)
      .get(`/api/documents/timesheet/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));

    // 6/3 is 10:10–19:00 less a 1:00 break = 7:50. It must never render as 7.83.
    expect(timesheet.text).toContain('>7:50<');
    expect(timesheet.text).toContain('>1:00<');
    expect(timesheet.text).not.toMatch(/>7\.83</);
    // No duration cell anywhere on the sheet is written in decimal hours.
    expect(timesheet.text).not.toMatch(/<td class="num">\d+\.\d+<\/td>/);
    // ...except 時給換算用勤務時間, which is a bare decimal count, not a clock value.
    expect(timesheet.text).toMatch(/時給換算用勤務時間<\/td>\s*<td class="num">101</);

    const invoice = await request(ctx.app)
      .get(`/api/documents/invoice/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));

    // The multiplicand behind ¥131,300 — decimal, and NOT the 101:00 clock value.
    expect(invoice.text).toContain('@1,300円 × 101');
    expect(invoice.text).not.toContain('@1,300円 × 101:00');
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

  // Regression: on Render, Chromium is installed but cannot launch. available()
  // only checked the import, so the route tried to render an attachment and the
  // throw took the whole send down — a 500 and no email at all.
  it('still sends the email when PDF rendering throws', async () => {
    const mailer = stubMailer();
    const brokenPdf: PdfRenderer = {
      available: async () => true,
      render: async () => {
        throw new Error('Failed to launch the browser process: libnss3.so: cannot open shared object file');
      },
    };
    const ctx = await makeTestContext({ pdf: brokenPdf, mailer });

    const res = await request(ctx.app)
      .post(`/api/documents/payslip/${ctx.staffId}/email?month=2026-06`)
      .set(auth(ctx.staffToken));

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(true);
    expect(res.body.pdfAttached).toBe(false);

    // The HTML body is the document, so it must still carry the figures.
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.attachments ?? []).toHaveLength(0);
    expect(mailer.sent[0]!.html).toContain('185,152');
  });

  it('reports why delivery failed instead of a bare 500', async () => {
    const failing: Mailer = {
      live: true,
      async send() {
        throw new Error('connect ECONNREFUSED 10.0.0.1:587');
      },
    };
    const ctx = await makeTestContext({ pdf: stubPdf(false), mailer: failing });

    const res = await request(ctx.app)
      .post(`/api/documents/payslip/${ctx.staffId}/email?month=2026-06`)
      .set(auth(ctx.staffToken));

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('Email delivery failed');
    expect(res.body.error).toContain('ECONNREFUSED');
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
