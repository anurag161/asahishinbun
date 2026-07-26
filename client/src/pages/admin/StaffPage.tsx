import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { StaffMember } from '../../api/types';
import { useToast } from '../../context/ToastContext';

const EMPTY = {
  name: '', email: '', password: '',
  postalCode: '', address: '', homeNearestStation: '', phone: '',
};
type EditForm = {
  name: string; homeNearestStation: string; postalCode: string; address: string; phone: string;
};

export function StaffPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [list, setList] = useState<StaffMember[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditForm>({
    name: '', homeNearestStation: '', postalCode: '', address: '', phone: '',
  });

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setE = (k: keyof EditForm, v: string) => setEdit((f) => ({ ...f, [k]: v }));
  function fail(e: unknown) {
    notify(e instanceof ApiError ? e.message : t('common.loadError'), 'err');
  }
  const reload = () => api.get<StaffMember[]>('/api/admin/staff').then(setList).catch(fail);
  useEffect(() => { reload(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/staff', form);
      setForm({ ...EMPTY });
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  function startEdit(s: StaffMember) {
    setEditId(s.id);
    setEdit({
      name: s.name,
      homeNearestStation: s.home_nearest_station ?? '',
      postalCode: s.postal_code ?? '',
      address: s.address ?? '',
      phone: s.phone ?? '',
    });
  }

  async function saveEdit(id: number) {
    if (!edit.name.trim()) return;
    try {
      await api.put(`/api/admin/staff/${id}/profile`, edit);
      setEditId(null);
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  async function remove(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    try { await api.del(`/api/admin/staff/${id}`); reload(); } catch (err) { fail(err); }
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
          <div className="field" style={{ maxWidth: 130 }}><label>{t('staff.postalCode')}</label>
            <input value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)}
              inputMode="numeric" placeholder="530-0001" /></div>
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
            <th>{t('staff.homeStation')}</th><th>{t('staff.postalCode')}</th>
            <th>{t('staff.address')}</th><th>{t('staff.phone')}</th>
            <th className="num">{t('common.actions')}</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : list.map((s) => editId === s.id ? (
              <tr key={s.id}>
                <td><input value={edit.name} onChange={(e) => setE('name', e.target.value)} /></td>
                <td className="muted">{s.email}</td>
                <td><input value={edit.homeNearestStation} onChange={(e) => setE('homeNearestStation', e.target.value)} /></td>
                <td><input value={edit.postalCode} onChange={(e) => setE('postalCode', e.target.value)}
                  inputMode="numeric" placeholder="530-0001" /></td>
                <td><input value={edit.address} onChange={(e) => setE('address', e.target.value)} /></td>
                <td><input value={edit.phone} onChange={(e) => setE('phone', e.target.value)} /></td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm primary" onClick={() => saveEdit(s.id)}>{t('common.save')}</button>{' '}
                  <button className="btn sm" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                </td>
              </tr>
            ) : (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.email}</td>
                <td>{s.home_nearest_station ?? '—'}</td><td>{s.postal_code ?? '—'}</td>
                <td>{s.address ?? '—'}</td><td>{s.phone ?? '—'}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm" onClick={() => startEdit(s)}>{t('common.edit')}</button>{' '}
                  <button className="btn sm danger" onClick={() => remove(s.id)}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
