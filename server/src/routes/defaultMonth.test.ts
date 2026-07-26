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
