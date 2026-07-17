import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { Stadium } from '../../api/types';
import { useToast } from '../../context/ToastContext';

export function StadiumsPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [list, setList] = useState<Stadium[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [station, setStation] = useState('');

  const reload = () => api.get<Stadium[]>('/api/stadiums').then(setList);
  useEffect(() => { reload(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/stadiums', { name, address, nearestStation: station });
      setName(''); setAddress(''); setStation('');
      notify(t('common.save'));
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), 'err');
    }
  }

  async function remove(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    await api.del(`/api/stadiums/${id}`);
    reload();
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
            ) : list.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.address ?? '—'}</td><td>{s.nearest_station}</td>
                <td className="num"><button className="btn sm danger" onClick={() => remove(s.id)}>{t('common.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
