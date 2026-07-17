/**
 * Phase 3 API integration tests — the real Express app over pg-mem.
 * Covers auth, role enforcement, the auto-transport rule, my-page/payroll
 * (which must still reproduce the golden master), and admin review.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';

let ctx: TestContext;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => {
  ctx = await makeTestContext();
});

describe('auth', () => {
  it('logs in staff and returns a usable token', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'staff@example.com', password: 'staff123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('staff');
    expect(typeof res.body.token).toBe('string');

    const me = await request(ctx.app).get('/api/auth/me').set(auth(res.body.token));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('staff@example.com');
  });

  it('rejects a wrong password', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'staff@example.com', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(ctx.app).get('/api/stadiums');
    expect(res.status).toBe(401);
  });
});

describe('role enforcement', () => {
  it('forbids staff from admin routes', async () => {
    const res = await request(ctx.app)
      .get('/api/admin/records?month=2026-06')
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(403);
  });
});

describe('my-page / payroll reproduce the golden master', () => {
  it('GET /api/mypage/summary for June = ¥185,152 net, 14 days', async () => {
    const res = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-06')
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    expect(res.body.workDays).toBe(14);
    expect(res.body.totalWorkedMinutes).toBe(101 * 60);
    expect(res.body.transportTotalYen).toBe(54_040);
    expect(res.body.salaryYen).toBe(131_300);
    expect(res.body.taxYen).toBe(188);
    expect(res.body.netYen).toBe(185_152);
  });

  it('GET /api/payroll/:id — staff self allowed, other staff forbidden', async () => {
    const ok = await request(ctx.app)
      .get(`/api/payroll/${ctx.staffId}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(ok.status).toBe(200);
    expect(ok.body.result.netYen).toBe(185_152);

    const forbidden = await request(ctx.app)
      .get(`/api/payroll/${ctx.staffId + 999}?month=2026-06`)
      .set(auth(ctx.staffToken));
    expect(forbidden.status).toBe(403);
  });
});

describe('admin review', () => {
  it('GET /api/admin/records lists the staff member with net ¥185,152', async () => {
    const res = await request(ctx.app)
      .get('/api/admin/records?month=2026-06')
      .set(auth(ctx.adminToken));
    expect(res.status).toBe(200);
    const rec = res.body.records.find((r: any) => r.staffId === ctx.staffId);
    expect(rec).toBeDefined();
    expect(rec.netYen).toBe(185_152);
    expect(rec.workDays).toBe(14);
  });
});

describe('attendance + auto transport', () => {
  it('creating a day auto-applies the registered round-trip fare', async () => {
    const create = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({
        date: '2026-07-01',
        stadiumId: ctx.stadiumId,
        start: '10:00',
        end: '19:00',
        breakTaken: true,
        breakMinutes: 60,
      });
    expect(create.status).toBe(201);
    expect(create.body.transport.applied).toBe(true);
    expect(create.body.transport.totalYen).toBe(3_860); // ¥1,930 × 2

    // Two auto transport expense lines now exist for July.
    const expenses = await request(ctx.app)
      .get('/api/expenses?month=2026-07')
      .set(auth(ctx.staffToken));
    const transport = expenses.body.filter((e: any) => e.category === 'transport');
    expect(transport).toHaveLength(2);
    expect(transport.every((e: any) => e.source === 'auto')).toBe(true);

    // My-page for July reflects the day.
    const summary = await request(ctx.app)
      .get('/api/mypage/summary?month=2026-07')
      .set(auth(ctx.staffToken));
    expect(summary.body.workDays).toBe(1);
    expect(summary.body.transportTotalYen).toBe(3_860);
  });

  it('rejects a duplicate day with 409', async () => {
    const body = {
      date: '2026-07-02',
      stadiumId: ctx.stadiumId,
      start: '10:00',
      end: '18:00',
      breakTaken: false,
    };
    const first = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send(body);
    expect(first.status).toBe(201);

    const dup = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send(body);
    expect(dup.status).toBe(409);
  });

  it('rejects negative worked time with 400', async () => {
    const res = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({
        date: '2026-07-03',
        stadiumId: ctx.stadiumId,
        start: '19:00',
        end: '10:00',
        breakTaken: false,
      });
    expect(res.status).toBe(400);
  });

  it('deleting a day removes its auto transport lines', async () => {
    const create = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({
        date: '2026-07-04',
        stadiumId: ctx.stadiumId,
        start: '10:00',
        end: '17:00',
        breakTaken: false,
      });
    const id = create.body.attendance.id;

    await request(ctx.app)
      .delete(`/api/attendance/${id}`)
      .set(auth(ctx.staffToken))
      .expect(204);

    const expenses = await request(ctx.app)
      .get('/api/expenses?month=2026-07')
      .set(auth(ctx.staffToken));
    const forDay = expenses.body.filter((e: any) => e.expense_date === '2026-07-04');
    expect(forDay).toHaveLength(0);
  });
});

describe('admin masters', () => {
  it('admin can create a stadium and a route fare', async () => {
    const stadium = await request(ctx.app)
      .post('/api/stadiums')
      .set(auth(ctx.adminToken))
      .send({ name: '甲子園', address: '兵庫県西宮市', nearestStation: '甲子園' });
    expect(stadium.status).toBe(201);

    const fare = await request(ctx.app)
      .post('/api/admin/route-fares')
      .set(auth(ctx.adminToken))
      .send({ fromStation: '円山', toStation: '甲子園', oneWayFare: 2500, mode: '電車' });
    expect(fare.status).toBe(201);
    expect(fare.body.one_way_fare).toBe(2500);
  });
});
