/**
 * Admin cost-bucket re-tagging: moving a day to 大会経費（直接費）also moves
 * that day's auto transport lines to the same bucket.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';

let ctx: TestContext;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => {
  ctx = await makeTestContext();
});

describe('admin per-day bucket re-tag', () => {
  async function firstJuneDay() {
    const res = await request(ctx.app)
      .get(`/api/admin/staff/${ctx.staffId}/attendance?month=2026-06`)
      .set(auth(ctx.adminToken));
    return res.body.find((d: any) => d.work_date === '2026-06-01');
  }

  it('re-tags a day to direct cost and moves its transport with it', async () => {
    const day = await firstJuneDay();
    expect(day.bucket).toBe('henshu');

    const upd = await request(ctx.app)
      .put(`/api/admin/attendance/${day.id}/bucket`)
      .set(auth(ctx.adminToken))
      .send({ bucket: 'daikai' });
    expect(upd.status).toBe(200);
    expect(upd.body.bucket).toBe('daikai');

    // the day now reads daikai
    const again = await firstJuneDay();
    expect(again.bucket).toBe('daikai');

    // its auto transport lines moved to daikai too
    const expenses = await request(ctx.app)
      .get('/api/expenses?month=2026-06')
      .set(auth(ctx.staffToken));
    const forDay = expenses.body.filter(
      (e: any) => e.expense_date === '2026-06-01' && e.category === 'transport',
    );
    expect(forDay).toHaveLength(2);
    expect(forDay.every((e: any) => e.bucket === 'daikai')).toBe(true);
  });

  it('rejects an invalid bucket', async () => {
    const day = await firstJuneDay();
    const res = await request(ctx.app)
      .put(`/api/admin/attendance/${day.id}/bucket`)
      .set(auth(ctx.adminToken))
      .send({ bucket: 'nonsense' });
    expect(res.status).toBe(400);
  });

  it('forbids a staff member from re-tagging', async () => {
    const day = await firstJuneDay();
    const res = await request(ctx.app)
      .put(`/api/admin/attendance/${day.id}/bucket`)
      .set(auth(ctx.staffToken))
      .send({ bucket: 'daikai' });
    expect(res.status).toBe(403);
  });
});
