/**
 * Account management (§3.5) — admin creates accounts of either role, changes
 * roles, resets passwords, with last-admin and self-delete guards.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestContext, type TestContext } from '../testing/harness';

let ctx: TestContext;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => {
  ctx = await makeTestContext();
});

describe('account management', () => {
  it('lists all accounts (both roles)', async () => {
    const res = await request(ctx.app)
      .get('/api/admin/accounts')
      .set(auth(ctx.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.map((u: any) => u.role).sort()).toEqual(['admin', 'staff']);
  });

  it('creates an ADMIN account that can then log in', async () => {
    const create = await request(ctx.app)
      .post('/api/admin/accounts')
      .set(auth(ctx.adminToken))
      .send({ name: '管理者2', email: 'admin2@example.com', password: 'pw123456', role: 'admin' });
    expect(create.status).toBe(201);
    expect(create.body.role).toBe('admin');

    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'admin2@example.com', password: 'pw123456' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('admin');
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await request(ctx.app)
      .post('/api/admin/accounts')
      .set(auth(ctx.adminToken))
      .send({ name: 'dupe', email: 'staff@example.com', password: 'pw123456', role: 'staff' });
    expect(res.status).toBe(409);
  });

  it('changes a role and resets a password', async () => {
    // promote the seeded staff to admin
    const upd = await request(ctx.app)
      .put(`/api/admin/accounts/${ctx.staffId}`)
      .set(auth(ctx.adminToken))
      .send({ name: 'サンプル 太郎', email: 'staff@example.com', role: 'admin' });
    expect(upd.status).toBe(200);
    expect(upd.body.role).toBe('admin');

    // reset the password, then log in with the new one
    const pw = await request(ctx.app)
      .put(`/api/admin/accounts/${ctx.staffId}/password`)
      .set(auth(ctx.adminToken))
      .send({ password: 'newpass123' });
    expect(pw.status).toBe(200);

    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'staff@example.com', password: 'newpass123' });
    expect(login.status).toBe(200);
  });

  it('refuses to delete the last admin and your own account', async () => {
    // admin cannot delete self
    const selfDel = await request(ctx.app)
      .delete(`/api/admin/accounts/${ctx.adminId}`)
      .set(auth(ctx.adminToken));
    expect(selfDel.status).toBe(400);

    // demoting the only admin is blocked
    const demote = await request(ctx.app)
      .put(`/api/admin/accounts/${ctx.adminId}`)
      .set(auth(ctx.adminToken))
      .send({ name: '管理者', email: 'admin@example.com', role: 'staff' });
    expect(demote.status).toBe(400);
  });

  it('forbids a staff member from managing accounts', async () => {
    const res = await request(ctx.app)
      .get('/api/admin/accounts')
      .set(auth(ctx.staffToken));
    expect(res.status).toBe(403);
  });
});
