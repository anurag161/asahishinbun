/**
 * R3 — 交通費 preview on the attendance form, and R5's station list behind the
 * 区間マスタ dropdowns.
 *
 * The point of the preview is that it agrees with what saving the day actually
 * books, so the central test here compares the two rather than just asserting a
 * number: a preview that drifts from the engine is worse than no preview.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';

let ctx: TestContext;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => {
  ctx = await makeTestContext();
});

const preview = (stadiumId: number | string, token: string) =>
  request(ctx.app)
    .get(`/api/attendance/transport-preview?stadiumId=${stadiumId}`)
    .set(auth(token));

describe('GET /api/attendance/transport-preview', () => {
  it('resolves the seeded 円山 ⇄ 大阪 round trip before anything is saved', async () => {
    const res = await preview(ctx.stadiumId, ctx.staffToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      homeStation: '円山',
      stadiumStation: '大阪',
      outboundFare: 1_930,
      inboundFare: 1_930,
      totalYen: 3_860,
      applied: true,
      reason: null,
    });
  });

  it('previews exactly what saving the day then books', async () => {
    const shown = await preview(ctx.stadiumId, ctx.staffToken);

    const saved = await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({
        date: '2026-06-28', // a date the June fixture does not already use
        stadiumId: ctx.stadiumId,
        startMinutes: 600,
        endMinutes: 1_140,
        breakTaken: true,
        breakMinutes: 60,
      });

    expect(saved.status).toBe(201);
    expect(saved.body.transport.applied).toBe(shown.body.applied);
    expect(saved.body.transport.totalYen).toBe(shown.body.totalYen);
  });

  it('reports noRoute — not a silent ¥0 — for a stadium with no registered fare', async () => {
    const stadium = await request(ctx.app)
      .post('/api/stadiums')
      .set(auth(ctx.adminToken))
      .send({ name: '新球場', nearestStation: '未登録駅' });
    expect(stadium.status).toBe(201);

    const res = await preview(stadium.body.id, ctx.staffToken);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      stadiumStation: '未登録駅',
      totalYen: 0,
      applied: false,
      reason: 'noRoute',
    });
  });

  it('distinguishes an unregistered home station from an unregistered route', async () => {
    await ctx.db.query(`UPDATE staff_profiles SET home_nearest_station = NULL WHERE user_id = $1`, [
      ctx.staffId,
    ]);

    const res = await preview(ctx.stadiumId, ctx.staffToken);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      homeStation: null,
      applied: false,
      reason: 'noHomeStation',
      totalYen: 0,
    });
  });

  it('404s an unknown stadium and 400s a missing stadiumId', async () => {
    expect((await preview(999_999, ctx.staffToken)).status).toBe(404);

    const missing = await request(ctx.app)
      .get('/api/attendance/transport-preview')
      .set(auth(ctx.staffToken));
    expect(missing.status).toBe(400);
  });

  it('is staff-only, and is not swallowed by the month listing route', async () => {
    expect((await preview(ctx.stadiumId, ctx.adminToken)).status).toBe(403);
    expect((await request(ctx.app).get('/api/attendance/transport-preview')).status).toBe(401);
  });
});

describe('GET /api/admin/stations', () => {
  it('returns the names a route may be keyed on, grouped by master', async () => {
    const res = await request(ctx.app).get('/api/admin/stations').set(auth(ctx.adminToken));

    expect(res.status).toBe(200);
    expect(res.body.stadiums).toContain('大阪');
    expect(res.body.homes).toContain('円山');
  });

  it('picks up a station as soon as its stadium is registered', async () => {
    await request(ctx.app)
      .post('/api/stadiums')
      .set(auth(ctx.adminToken))
      .send({ name: '甲子園', nearestStation: '阪神甲子園' });

    const res = await request(ctx.app).get('/api/admin/stations').set(auth(ctx.adminToken));
    expect(res.body.stadiums).toContain('阪神甲子園');
  });

  it('de-duplicates, so a name shared by two stadiums is offered once', async () => {
    await request(ctx.app)
      .post('/api/stadiums')
      .set(auth(ctx.adminToken))
      .send({ name: '大阪第二球場', nearestStation: '大阪' });

    const res = await request(ctx.app).get('/api/admin/stations').set(auth(ctx.adminToken));
    expect(res.body.stadiums.filter((s: string) => s === '大阪')).toHaveLength(1);
  });

  it('is admin-only', async () => {
    const res = await request(ctx.app).get('/api/admin/stations').set(auth(ctx.staffToken));
    expect(res.status).toBe(403);
  });
});
