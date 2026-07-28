/**
 * Which month a screen opens on.
 *
 * The seeded sample lives in 2026-06, so unless "today" happens to fall in that
 * month the current month is empty — which is what made a fresh demo open on
 * all zeros. These pin the fallback and, just as importantly, that it stops
 * applying the moment the current month has data of its own.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';

let ctx: TestContext;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

function thisMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

beforeEach(async () => {
  ctx = await makeTestContext();
});

describe('GET /api/default-month', () => {
  it('falls back to the seeded month when the current month is empty', async () => {
    const res = await request(ctx.app).get('/api/default-month').set(auth(ctx.staffToken));
    expect(res.status).toBe(200);
    // Guard against this passing for the wrong reason if run during 2026-06.
    if (thisMonth() !== '2026-06') {
      expect(res.body.month).toBe('2026-06');
      expect(res.body.month).not.toBe(thisMonth());
    }
  });

  it('prefers the current month once it has a work day', async () => {
    const now = thisMonth();
    const stadiums = await request(ctx.app).get('/api/stadiums').set(auth(ctx.staffToken));
    await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({
        date: `${now}-15`,
        stadiumId: stadiums.body[0].id,
        startMinutes: 600,
        endMinutes: 1080,
        breakTaken: true,
        breakMinutes: 60,
      })
      .expect(201);

    const res = await request(ctx.app).get('/api/default-month').set(auth(ctx.staffToken));
    expect(res.body.month).toBe(now);
  });

  it('answers for an admin, whose own account has no attendance', async () => {
    const res = await request(ctx.app).get('/api/default-month').set(auth(ctx.adminToken));
    expect(res.status).toBe(200);
    if (thisMonth() !== '2026-06') {
      expect(res.body.month).toBe('2026-06');
    }
  });

  it('requires authentication', async () => {
    await request(ctx.app).get('/api/default-month').expect(401);
  });
});

/**
 * The month has to arrive WITH the session. Resolved separately, every page
 * painted on today's empty month first and only corrected after a round trip —
 * which on a fresh demo reads as "nothing works", and on a failed request stayed
 * that way silently.
 */
describe('the month ships with the session', () => {
  it('login carries the month to open on', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'staff@example.com', password: 'staff123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    if (thisMonth() !== '2026-06') {
      expect(res.body.defaultMonth).toBe('2026-06');
      expect(res.body.defaultMonth).not.toBe(thisMonth());
    }
  });

  it('a restored session carries it too, so a refresh opens on the same month', async () => {
    const res = await request(ctx.app).get('/api/auth/me').set(auth(ctx.staffToken));

    expect(res.status).toBe(200);
    if (thisMonth() !== '2026-06') {
      expect(res.body.defaultMonth).toBe('2026-06');
    }
  });

  it('gives an admin the org-wide month, not their own empty one', async () => {
    const res = await request(ctx.app).get('/api/auth/me').set(auth(ctx.adminToken));

    expect(res.body.role).toBe('admin');
    if (thisMonth() !== '2026-06') {
      expect(res.body.defaultMonth).toBe('2026-06');
    }
  });

  it('agrees with the standalone endpoint — one rule, not two', async () => {
    for (const token of [ctx.staffToken, ctx.adminToken]) {
      const [session, endpoint] = await Promise.all([
        request(ctx.app).get('/api/auth/me').set(auth(token)),
        request(ctx.app).get('/api/default-month').set(auth(token)),
      ]);
      expect(session.body.defaultMonth).toBe(endpoint.body.month);
    }
  });

  it('follows the data: entering a day this month moves the session month to it', async () => {
    const now = thisMonth();
    const stadiums = await request(ctx.app).get('/api/stadiums').set(auth(ctx.staffToken));
    await request(ctx.app)
      .post('/api/attendance')
      .set(auth(ctx.staffToken))
      .send({
        date: `${now}-15`,
        stadiumId: stadiums.body[0].id,
        startMinutes: 600,
        endMinutes: 1080,
        breakTaken: true,
        breakMinutes: 60,
      })
      .expect(201);

    const res = await request(ctx.app).get('/api/auth/me').set(auth(ctx.staffToken));
    expect(res.body.defaultMonth).toBe(now);
  });
});
