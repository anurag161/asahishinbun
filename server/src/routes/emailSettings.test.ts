/**
 * メール設定 — the admin-set address that document email is diverted to while
 * delivery is being checked.
 *
 * The important property is that it is a redirect and not an edit: the staff
 * member's registered address must be untouched, and clearing the setting must
 * put delivery back to normal.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';
import type { Mailer } from '../services/emailService';

let ctx: TestContext;
let sent: { to: string; subject: string }[];
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const mailer: Mailer = {
  live: true,
  async send(m) {
    sent.push({ to: m.to, subject: m.subject });
    return { messageId: 'test', mode: 'smtp' as const };
  },
};

beforeEach(async () => {
  sent = [];
  ctx = await makeTestContext({ mailer });
});

const emailPayslip = () =>
  request(ctx.app)
    .post(`/api/documents/payslip/${ctx.staffId}/email?month=2026-06`)
    .set(auth(ctx.staffToken));

describe('admin email settings', () => {
  it('defaults to off — mail goes to the staff member', async () => {
    const res = await request(ctx.app).get('/api/admin/email-settings').set(auth(ctx.adminToken));
    expect(res.body.testRecipient).toBeNull();

    const sendRes = await emailPayslip().expect(200);
    expect(sendRes.body.to).toBe('staff@example.com');
    expect(sendRes.body.redirected).toBe(false);
    expect(sent[0]!.to).toBe('staff@example.com');
  });

  it('diverts document mail once an address is set', async () => {
    await request(ctx.app)
      .put('/api/admin/email-settings')
      .set(auth(ctx.adminToken))
      .send({ testRecipient: 'kakunin@asahi.example.jp' })
      .expect(200);

    const res = await emailPayslip().expect(200);
    expect(res.body.to).toBe('kakunin@asahi.example.jp');
    expect(res.body.redirected).toBe(true);
    // The UI needs to be able to say who it was actually for.
    expect(res.body.intendedFor).toBe('staff@example.com');
    expect(sent[0]!.to).toBe('kakunin@asahi.example.jp');
  });

  it('never changes the staff member\'s registered address', async () => {
    await request(ctx.app)
      .put('/api/admin/email-settings')
      .set(auth(ctx.adminToken))
      .send({ testRecipient: 'kakunin@asahi.example.jp' })
      .expect(200);
    await emailPayslip().expect(200);

    const me = await request(ctx.app).get('/api/auth/me').set(auth(ctx.staffToken));
    expect(me.body.email).toBe('staff@example.com');
  });

  it('restores normal delivery when cleared', async () => {
    const put = (testRecipient: string) =>
      request(ctx.app).put('/api/admin/email-settings').set(auth(ctx.adminToken)).send({ testRecipient });

    await put('kakunin@asahi.example.jp').expect(200);
    await put('').expect(200);

    const res = await emailPayslip().expect(200);
    expect(res.body.to).toBe('staff@example.com');
    expect(res.body.redirected).toBe(false);
  });

  it('rejects a malformed address', async () => {
    await request(ctx.app)
      .put('/api/admin/email-settings')
      .set(auth(ctx.adminToken))
      .send({ testRecipient: 'not-an-email' })
      .expect(400);
  });

  it('sends a test message to the configured address', async () => {
    await request(ctx.app)
      .put('/api/admin/email-settings')
      .set(auth(ctx.adminToken))
      .send({ testRecipient: 'kakunin@asahi.example.jp' })
      .expect(200);

    const res = await request(ctx.app)
      .post('/api/admin/email-settings/test')
      .set(auth(ctx.adminToken))
      .expect(200);

    expect(res.body.to).toBe('kakunin@asahi.example.jp');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain('テスト');
  });

  it('will not test-send with nothing configured', async () => {
    await request(ctx.app).post('/api/admin/email-settings/test').set(auth(ctx.adminToken)).expect(400);
    expect(sent).toHaveLength(0);
  });

  it('is admin-only', async () => {
    await request(ctx.app).get('/api/admin/email-settings').set(auth(ctx.staffToken)).expect(403);
    await request(ctx.app)
      .put('/api/admin/email-settings')
      .set(auth(ctx.staffToken))
      .send({ testRecipient: 'x@y.jp' })
      .expect(403);
  });
});
