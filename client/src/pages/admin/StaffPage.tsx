import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { StaffMember } from '../../api/types';
import { useToast } from '../../context/ToastContext';

const EMPTY = { name: '', email: '', password: '', address: '', homeNearestStation: '', phone: '' };

export function StaffPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [list, setList] = useState<StaffMember[]>([]);
  const [form, setForm] = useState({ ...EMPTY });

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const reload = () => api.get<StaffMember[]>('/api/admin/staff').then(setList);
  useEffect(() => { reload(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/staff', form);
      setForm({ ...EMPTY });
      notify(t('common.save'));
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), 'err');
    }
  }

  async function remove(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    await api.del(`/api/admin/staff/${id}`);
    reload();
  }

  return (
    <>
      <div className="pagehead"><h1>{t('staff.title')}</h1></div>

      <form className="card" onSubmit={add} style={{ marginBottom: 18 }}>
        <div className="row">
          <div className="field"><label>{t('staff.name')}</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
          <div className="field"><label>{t('staff.email')}</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required /></div>
          <div className="field"><label>{t('staff.password')}</label>
            <input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} required /></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field"><label>{t('staff.homeStation')}</label>
            <input value={form.homeNearestStation} onChange={(e) => set('homeNearestStation', e.target.value)} /></div>
          <div className="field"><label>{t('staff.address')}</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="field"><label>{t('staff.phone')}</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <button className="btn primary" type="submit">{t('common.add')}</button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr>
            <th>{t('staff.name')}</th><th>{t('staff.email')}</th>
            <th>{t('staff.homeStation')}</th><th>{t('staff.phone')}</th>
            <th className="num">{t('common.actions')}</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : list.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.email}</td>
                <td>{s.home_nearest_station ?? '—'}</td><td>{s.phone ?? '—'}</td>
                <td className="num"><button className="btn sm danger" onClick={() => remove(s.id)}>{t('common.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
