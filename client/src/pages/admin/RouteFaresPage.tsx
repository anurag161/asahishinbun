import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { RouteFare } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { yen } from '../../utils/format';

type EditForm = { fromStation: string; toStation: string; oneWayFare: number; mode: string; routeNote: string };

export function RouteFaresPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [list, setList] = useState<RouteFare[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fare, setFare] = useState(0);
  const [mode, setMode] = useState('');
  const [note, setNote] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditForm>({ fromStation: '', toStation: '', oneWayFare: 0, mode: '', routeNote: '' });

  function fail(e: unknown) {
    notify(e instanceof ApiError ? e.message : t('common.loadError'), 'err');
  }
  const reload = () => api.get<RouteFare[]>('/api/admin/route-fares').then(setList).catch(fail);
  useEffect(() => { reload(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/route-fares', {
        fromStation: from, toStation: to, oneWayFare: fare, mode, routeNote: note,
      });
      setFrom(''); setTo(''); setFare(0); setMode(''); setNote('');
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  const setEF = (k: keyof EditForm, v: string | number) => setEdit((f) => ({ ...f, [k]: v }));

  function startEdit(r: RouteFare) {
    setEditId(r.id);
    setEdit({
      fromStation: r.from_station,
      toStation: r.to_station,
      oneWayFare: r.one_way_fare,
      mode: r.mode ?? '',
      routeNote: r.route_note ?? '',
    });
  }

  async function saveEdit(id: number) {
    if (!edit.fromStation.trim() || !edit.toStation.trim()) return;
    try {
      await api.put(`/api/admin/route-fares/${id}`, edit);
      setEditId(null);
      notify(t('common.save'));
      reload();
    } catch (err) { fail(err); }
  }

  async function remove(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    try { await api.del(`/api/admin/route-fares/${id}`); reload(); } catch (err) { fail(err); }
  }

  return (
    <>
      <div className="pagehead">
        <h1>{t('routes.title')}</h1>
        <span className="sub">{t('routes.hint')}</span>
      </div>

      <form className="card" onSubmit={add} style={{ marginBottom: 18 }}>
        <div className="row">
          <div className="field"><label>{t('routes.from')}</label>
            <input value={from} onChange={(e) => setFrom(e.target.value)} required /></div>
          <div className="field"><label>{t('routes.to')}</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} required /></div>
          <div className="field" style={{ maxWidth: 130 }}><label>{t('routes.fare')}</label>
            <input type="number" min={0} value={fare} onChange={(e) => setFare(Number(e.target.value))} required /></div>
          <div className="field" style={{ maxWidth: 140 }}><label>{t('routes.mode')}</label>
            <input value={mode} onChange={(e) => setMode(e.target.value)} /></div>
          <div className="field"><label>{t('routes.note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn primary" type="submit">{t('common.add')}</button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr>
            <th>{t('routes.from')}</th><th>{t('routes.to')}</th>
            <th className="num">{t('routes.fare')}</th><th>{t('routes.mode')}</th>
            <th>{t('routes.note')}</th><th className="num">{t('common.actions')}</th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : list.map((r) => editId === r.id ? (
              <tr key={r.id}>
                <td><input value={edit.fromStation} onChange={(e) => setEF('fromStation', e.target.value)} /></td>
                <td><input value={edit.toStation} onChange={(e) => setEF('toStation', e.target.value)} /></td>
                <td className="num"><input type="number" min={0} value={edit.oneWayFare} onChange={(e) => setEF('oneWayFare', Number(e.target.value))} style={{ maxWidth: 110 }} /></td>
                <td><input value={edit.mode} onChange={(e) => setEF('mode', e.target.value)} style={{ maxWidth: 120 }} /></td>
                <td><input value={edit.routeNote} onChange={(e) => setEF('routeNote', e.target.value)} /></td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm primary" onClick={() => saveEdit(r.id)}>{t('common.save')}</button>{' '}
                  <button className="btn sm" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td>{r.from_station}</td><td>{r.to_station}</td>
                <td className="num">{yen(r.one_way_fare)}</td>
                <td>{r.mode ?? '—'}</td><td>{r.route_note ?? '—'}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm" onClick={() => startEdit(r)}>{t('common.edit')}</button>{' '}
                  <button className="btn sm danger" onClick={() => remove(r.id)}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
