import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { Role, User } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const EMPTY = { name: '', email: '', password: '', role: 'staff' as Role };

export function AccountsPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const { user: me } = useAuth();
  const [list, setList] = useState<User[]>([]);
  const [form, setForm] = useState({ ...EMPTY });

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  function fail(err: unknown) {
    notify(err instanceof ApiError ? err.message : String(err), 'err');
  }
  const reload = () => api.get<User[]>('/api/admin/accounts').then(setList).catch(fail);
  useEffect(() => { reload(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/accounts', form);
      setForm({ ...EMPTY });
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  async function changeRole(u: User, role: Role) {
    try {
      await api.put(`/api/admin/accounts/${u.id}`, { name: u.name, email: u.email, role });
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  async function resetPassword(u: User) {
    const password = window.prompt(t('accounts.newPassword', { name: u.name }));
    if (!password) return;
    try {
      await api.put(`/api/admin/accounts/${u.id}/password`, { password });
      notify(t('common.save'));
    } catch (err) { fail(err); }
  }

  async function remove(u: User) {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await api.del(`/api/admin/accounts/${u.id}`);
      reload();
    } catch (err) { fail(err); }
  }

  return (
    <>
      <div className="pagehead">
        <h1>{t('accounts.title')}</h1>
        <span className="sub">{t('accounts.subtitle')}</span>
      </div>

      <form className="card" onSubmit={add} style={{ marginBottom: 18 }}>
        <div className="row">
          <div className="field"><label>{t('accounts.name')}</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
          <div className="field"><label>{t('accounts.email')}</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required /></div>
          <div className="field"><label>{t('accounts.password')}</label>
            <input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} required /></div>
          <div className="field" style={{ maxWidth: 150 }}><label>{t('accounts.role')}</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="staff">{t('accounts.staff')}</option>
              <option value="admin">{t('accounts.admin')}</option>
            </select>
          </div>
          <button className="btn primary" type="submit">{t('common.add')}</button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr>
            <th>{t('accounts.name')}</th><th>{t('accounts.email')}</th>
            <th>{t('accounts.role')}</th><th className="num">{t('common.actions')}</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={4} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : list.map((u) => (
              <tr key={u.id}>
                <td>{u.name}{me?.id === u.id && <span className="muted"> ({t('accounts.you')})</span>}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    style={{ padding: '3px 8px', fontSize: 12 }}
                  >
                    <option value="staff">{t('accounts.staff')}</option>
                    <option value="admin">{t('accounts.admin')}</option>
                  </select>
                </td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm" onClick={() => resetPassword(u)}>{t('accounts.resetPassword')}</button>{' '}
                  <button className="btn sm danger" disabled={me?.id === u.id} onClick={() => remove(u)}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
