/**
 * Overtime end-to-end: a staff member enters a long day and the premium reaches
 * My Page, the admin 全体実績 and the 請求明細書 without anyone typing an OT figure.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';

let ctx: TestContext;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** 10:00–21:00 with a 1h break = 10h worked → 2h overtime. */
const LONG_DAY = {
  date: '2026-06-30',
  startMinutes: 10 * 60,
  endMinutes: 21 * 60,
  breakTaken: true,
  breakMinutes: 60,
};

beforeEach(async () => {
  ctx = await makeTestContext();
});

describe('a 10h day earns the 時間外 premium end-to-end', () => {
  async function addLongDay() {
    const stadiums = await request(ctx.app).get('/api/stadiums').set(auth(ctx.staffToken));
    const res = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({ ...LONG_DAY, stadiumId: stadiums.body[0].id });
    expect(res.status).toBe(201);
  }

  it('shows the derived overtime and the 1.25× wage on My Page', async () => {
    const before = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));
    const baseSalary = before.body.salaryYen;

    await addLongDay();

    const after = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));
    const day = after.body.days.find((d: any) => d.date === LONG_DAY.date);

    expect(day.workedMinutes).toBe(10 * 60);
    expect(day.overtimeMinutes).toBe(2 * 60); // never entered — derived from the clock
    // ¥1,300 × 8h + ¥1,300 × 1.25 × 2h = ¥10,400 + ¥3,250 = ¥13,650
    expect(day.baseWageYen).toBe(13_000);
    expect(day.overtimeWageYen).toBe(650);
    expect(day.dailyWageYen).toBe(13_650);
    expect(after.body.salaryYen).toBe(baseSalary + 13_650);
  });

  it('rolls the overtime up onto the admin 全体実績 row', async () => {
    await addLongDay();

    const res = await request(ctx.app)
      .get('/api/admin/records?month=2026-06')
      .set(auth(ctx.adminToken));
    const row = res.body.records.find((r: any) => r.staffId === ctx.staffId);

    expect(row.totalOvertimeMinutes).toBe(2 * 60);
    expect(row.overtimeYen).toBe(650);
  });

  it('itemises it on the 請求明細書 as 時間外（60h以下）, not folded into 時給', async () => {
    await addLongDay();

    const res = await request(ctx.app)
      .get(`/api/documents/invoice/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.adminToken));
    expect(res.status).toBe(200);

    // The premium gets its own line at the ≤60h unit price, quantified in hours.
    expect(res.text).toContain('時間外（60h以下）');
    expect(res.text).toContain('@325円 × 2:00（8時間超）');
    expect(res.text).toContain('¥650');
  });

  it('leaves the June golden master untouched — no sample day passes 8h', async () => {
    const res = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));

    expect(res.body.days.every((d: any) => d.overtimeMinutes === 0)).toBe(true);
    expect(res.body.salaryYen).toBe(131_300);
    expect(res.body.netYen).toBe(185_152);
  });
});
