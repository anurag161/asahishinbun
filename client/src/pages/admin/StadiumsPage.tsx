import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { Stadium } from '../../api/types';
import { useToast } from '../../context/ToastContext';

type EditForm = { name: string; address: string; nearestStation: string };

export function StadiumsPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [list, setList] = useState<Stadium[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [station, setStation] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditForm>({ name: '', address: '', nearestStation: '' });

  function fail(e: unknown) {
    notify(e instanceof ApiError ? e.message : t('common.loadError'), 'err');
  }
  const reload = () => api.get<Stadium[]>('/api/stadiums').then(setList).catch(fail);
  useEffect(() => { reload(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/stadiums', { name, address, nearestStation: station });
      setName(''); setAddress(''); setStation('');
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  const setE = (k: keyof EditForm, v: string) => setEdit((f) => ({ ...f, [k]: v }));

  function startEdit(s: Stadium) {
    setEditId(s.id);
    setEdit({ name: s.name, address: s.address ?? '', nearestStation: s.nearest_station });
  }

  async function saveEdit(id: number) {
    if (!edit.name.trim() || !edit.nearestStation.trim()) return;
    try {
      await api.put(`/api/stadiums/${id}`, {
        name: edit.name,
        address: edit.address,
        nearestStation: edit.nearestStation,
      });
      setEditId(null);
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  async function remove(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    try { await api.del(`/api/stadiums/${id}`); reload(); } catch (err) { fail(err); }
  }

  return (
    <>
      <div className="pagehead"><h1>{t('stadiums.title')}</h1></div>

      <form className="card" onSubmit={add} style={{ marginBottom: 18 }}>
        <div className="row">
          <div className="field"><label>{t('stadiums.name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label>{t('stadiums.address')}</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="field"><label>{t('stadiums.station')}</label>
            <input value={station} onChange={(e) => setStation(e.target.value)} required /></div>
          <button className="btn primary" type="submit">{t('common.add')}</button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr>
            <th>{t('stadiums.name')}</th><th>{t('stadiums.address')}</th>
            <th>{t('stadiums.station')}</th><th className="num">{t('common.actions')}</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={4} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : list.map((s) => editId === s.id ? (
              <tr key={s.id}>
                <td><input value={edit.name} onChange={(e) => setE('name', e.target.value)} /></td>
                <td><input value={edit.address} onChange={(e) => setE('address', e.target.value)} /></td>
                <td><input value={edit.nearestStation} onChange={(e) => setE('nearestStation', e.target.value)} /></td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm primary" onClick={() => saveEdit(s.id)}>{t('common.save')}</button>{' '}
                  <button className="btn sm" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                </td>
              </tr>
            ) : (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.address ?? '—'}</td><td>{s.nearest_station}</td>
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
