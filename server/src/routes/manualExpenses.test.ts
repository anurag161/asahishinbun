/**
 * Manual expenses (私有携帯電話使用料 / 出張日当 / 宿泊実費 / その他).
 *
 * The API always accepted these, but nothing in the UI posted them, so the
 * 出張日当・私有携帯・その他（別紙） sheet printed 該当なし for everyone. These pin the
 * path end to end: entered → priced correctly (phone is the one taxable
 * category) → printed on the 別紙.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';
import type { PdfRenderer } from '../pdf/pdfRenderer';

let ctx: TestContext;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const pdf: PdfRenderer = {
  available: vi.fn(async () => true),
  render: vi.fn(async () => Buffer.from('%PDF-1.4 stub')),
};

beforeEach(async () => {
  ctx = await makeTestContext({ pdf });
});

const add = (body: Record<string, unknown>) =>
  request(ctx.app).post('/api/expenses').set(auth(ctx.staffToken)).send(body);

const allowancesSheet = () =>
  request(ctx.app)
    .get(`/api/documents/allowances/${ctx.staffId}?month=2026-06`)
    .set(auth(ctx.adminToken));

describe('entering a manual expense', () => {
  it('accepts each of the four types the form offers', async () => {
    for (const category of ['perdiem', 'phone', 'lodging', 'other']) {
      const res = await add({
        date: '2026-06-05',
        category,
        amountYen: 1_000,
        description: `${category} line`,
      });
      expect(res.status, category).toBe(201);
      expect(res.body.source).toBe('manual');
      expect(res.body.category).toBe(category);
    }
  });

  it('rejects a negative amount', async () => {
    await add({ date: '2026-06-05', category: 'other', amountYen: -1 }).expect(400);
  });

  it('rejects a category the form does not offer', async () => {
    await add({ date: '2026-06-05', category: 'nonsense', amountYen: 100 }).expect(400);
  });
});

describe('how a manual expense reaches the money', () => {
  it('puts 私有携帯電話使用料 into 給料 (課税分), not 交通費', async () => {
    const before = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));

    await add({ date: '2026-06-05', category: 'phone', amountYen: 3_000 }).expect(201);

    const after = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));

    // Taxable: it lands in salary and lifts the gross by the same amount.
    expect(after.body.salaryYen).toBe(before.body.salaryYen + 3_000);
    expect(after.body.transportTotalYen).toBe(before.body.transportTotalYen);
    expect(after.body.grossYen).toBe(before.body.grossYen + 3_000);
  });

  it('puts 出張日当 into 交通費 and 宿泊実費 into その他 — both non-taxable', async () => {
    const before = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));

    await add({ date: '2026-06-05', category: 'perdiem', amountYen: 2_000 }).expect(201);
    await add({ date: '2026-06-05', category: 'lodging', amountYen: 8_000 }).expect(201);

    const after = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));

    expect(after.body.transportTotalYen).toBe(before.body.transportTotalYen + 2_000);
    expect(after.body.salaryYen).toBe(before.body.salaryYen);
    // Non-taxable, so the withholding must not move.
    expect(after.body.taxYen).toBe(before.body.taxYen);
    expect(after.body.grossYen).toBe(before.body.grossYen + 10_000);
  });
});

describe('the 別紙 sheet that used to be empty', () => {
  /** The sheet has three sections; an unused one prints 該当なし on its own. */
  const emptySections = (html: string) => (html.match(/該当なし/g) ?? []).length;

  it('prints 該当なし in all three sections while nothing has been entered', async () => {
    const res = await allowancesSheet();
    expect(res.status).toBe(200);
    expect(emptySections(res.text)).toBe(3);
  });

  it('lists the entered lines, leaving only the unused section empty', async () => {
    await add({
      date: '2026-06-05',
      category: 'perdiem',
      amountYen: 2_500,
      description: '甲子園 出張日当',
    }).expect(201);
    await add({
      date: '2026-06-08',
      category: 'phone',
      amountYen: 1_200,
      description: '6月分 通話料',
    }).expect(201);

    const res = await allowancesSheet();
    // 出張日当 and 私有携帯 now have rows; その他 legitimately stays empty.
    expect(emptySections(res.text)).toBe(1);
    expect(res.text).toContain('甲子園 出張日当');
    expect(res.text).toContain('6月分 通話料');
    expect(res.text).toContain('2,500');
    expect(res.text).toContain('1,200');
  });
});

describe('deleting', () => {
  it('removes your own manual line', async () => {
    const created = await add({ date: '2026-06-05', category: 'other', amountYen: 500 }).expect(201);

    await request(ctx.app)
      .delete(`/api/expenses/${created.body.id}`)
      .set(auth(ctx.staffToken))
      .expect(204);

    const list = await request(ctx.app)
      .get('/api/expenses?month=2026-06')
      .set(auth(ctx.staffToken));
    expect(list.body.some((e: { id: number }) => e.id === created.body.id)).toBe(false);
  });

  it('refuses to delete auto transport — that belongs to the work day', async () => {
    const list = await request(ctx.app)
      .get('/api/expenses?month=2026-06')
      .set(auth(ctx.staffToken));
    const auto = list.body.find((e: { source: string }) => e.source === 'auto');
    expect(auto).toBeDefined();

    await request(ctx.app)
      .delete(`/api/expenses/${auto.id}`)
      .set(auth(ctx.staffToken))
      .expect(400);
  });

  it('will not let one staff member delete another\'s line', async () => {
    const created = await add({ date: '2026-06-05', category: 'other', amountYen: 500 }).expect(201);

    await request(ctx.app)
      .delete(`/api/expenses/${created.body.id}`)
      .set(auth(ctx.adminToken))
      .expect(403);
  });
});
