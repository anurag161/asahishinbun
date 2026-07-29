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
    // DECIMAL, like the 時給 line: it is the quantity the ¥325 was multiplied by
    // (2 × ¥325 = ¥650), not a duration being reported. h:mm on this row would
    // not reconcile with the amount beside it.
    expect(res.text).toContain('時間外（60h以下）');
    expect(res.text).toContain('@325円 × 2（8時間超）');
    expect(res.text).not.toContain('2:00（8時間超）');
    expect(res.text).toContain('¥650');
  });

  it('writes a part-hour premium as 2.25, the figure that reconciles with ¥731', async () => {
    // 10:00–21:15 less a 1h break = 10h15m worked → 2h15m overtime.
    const stadiums = await request(ctx.app).get('/api/stadiums').set(auth(ctx.staffToken));
    await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({ ...LONG_DAY, endMinutes: 21 * 60 + 15, stadiumId: stadiums.body[0].id })
      .expect(201);

    const res = await request(ctx.app)
      .get(`/api/documents/invoice/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.adminToken));

    // 2.25 × ¥325 = ¥731.25 → ¥731. Asserting both halves is the point: the row
    // has to be arithmetic a reader can redo. Printed as 2:15 it isn't.
    expect(res.text).toContain('@325円 × 2.25（8時間超）');
    expect(res.text).toMatch(/2\.25（8時間超）<\/span><\/td>\s*<td class="num">¥731<\/td>/);
  });

  it('does not flag the tax as provisional — ¥13,650 is on a transcribed 丙 row', async () => {
    await addLongDay();

    const mine = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));
    expect(mine.body.taxProvisional).toBe(false);
    expect(mine.body.provisionalTaxDays).toEqual([]);
  });
});

describe('a day past the 丙 table ceiling is labelled 暫定, never shown as settled', () => {
  /** 09:00–20:45, 1h break = 10h45m worked → ¥14,869 > the ¥14,800 transcribed ceiling. */
  const HUGE_DAY = {
    date: '2026-06-28',
    startMinutes: 9 * 60,
    endMinutes: 20 * 60 + 45,
    breakTaken: true,
    breakMinutes: 60,
  };

  async function addHugeDay() {
    const stadiums = await request(ctx.app).get('/api/stadiums').set(auth(ctx.staffToken));
    const res = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({ ...HUGE_DAY, stadiumId: stadiums.body[0].id });
    expect(res.status).toBe(201);
  }

  it('flags it on My Page with the offending date', async () => {
    await addHugeDay();

    const res = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));
    const day = res.body.days.find((d: any) => d.date === HUGE_DAY.date);

    expect(day.dailyWageYen).toBe(14_869);
    expect(day.taxProvisional).toBe(true);
    expect(res.body.taxProvisional).toBe(true);
    expect(res.body.provisionalTaxDays).toEqual([HUGE_DAY.date]);
  });

  it('flags the admin 全体実績 row', async () => {
    await addHugeDay();

    const res = await request(ctx.app)
      .get('/api/admin/records?month=2026-06')
      .set(auth(ctx.adminToken));
    const row = res.body.records.find((r: any) => r.staffId === ctx.staffId);

    expect(row.taxProvisional).toBe(true);
    expect(row.provisionalTaxDays).toEqual([HUGE_DAY.date]);
  });

  it('prints the 暫定 notice on the 給料計算書', async () => {
    await addHugeDay();

    const res = await request(ctx.app)
      .get(`/api/documents/payslip/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.adminToken));
    expect(res.status).toBe(200);

    expect(res.text).toContain('※暫定');
    expect(res.text).toContain('暫定計算');
    expect(res.text).toContain('¥14,800');
  });

  it('prints no notice at all on an ordinary month', async () => {
    const res = await request(ctx.app)
      .get(`/api/documents/payslip/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.adminToken));

    expect(res.text).not.toContain('暫定');
  });
});

describe('the June golden master', () => {
  it('is untouched — no sample day passes 8h', async () => {
    const res = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));

    expect(res.body.days.every((d: any) => d.overtimeMinutes === 0)).toBe(true);
    expect(res.body.salaryYen).toBe(131_300);
    expect(res.body.netYen).toBe(185_152);
  });
});
