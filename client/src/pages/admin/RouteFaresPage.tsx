import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { KnownStations, RouteFare } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { yen } from '../../utils/format';

type EditForm = { fromStation: string; toStation: string; oneWayFare: number; mode: string };

/** The 経路メモ is generated automatically; keep this in sync with the server. */
const routeNoteOf = (from: string, to: string) => (from && to ? `${from}→${to}` : '—');

/**
 * Sentinel for the その他 option. A value no station name can collide with, so
 * choosing it is never confused with picking a real station.
 */
const OTHER = '\u0000other';

const EMPTY_STATIONS: KnownStations = { stadiums: [], homes: [] };

/**
 * Station picker for 区間マスタ.
 *
 * Auto transport looks a route up by matching the station strings EXACTLY, so a
 * name typed as 甲子園駅 against a stadium registered as 阪神甲子園駅 never
 * resolves and the day silently books ¥0 — with nothing on screen to say why.
 * Offering the registered names as a list removes that whole class of mistake.
 *
 * Free text stays reachable through その他, because a fare may legitimately need
 * registering before the matching 球場/アルバイト record exists. It is an opt-in
 * with a warning attached rather than the default path.
 */
function StationSelect({
  value,
  stations,
  onChange,
  required,
}: {
  value: string;
  stations: KnownStations;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  // A station registered both as a home and as a stadium station must appear in
  // one group only — duplicated <option> keys would collide.
  const homesOnly = stations.homes.filter((s) => !stations.stadiums.includes(s));
  const isKnown = stations.stadiums.includes(value) || homesOnly.includes(value);

  const [manual, setManual] = useState(false);
  // An existing row whose station is not (or no longer) in either master opens
  // in free-text mode, so editing it can never silently blank the name.
  const showManual = manual || (value !== '' && !isKnown);

  return (
    <div className="station-control">
      <select
        value={showManual ? OTHER : value}
        required={required && !showManual}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setManual(true);
            onChange('');
          } else {
            setManual(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">—</option>
        {stations.stadiums.length > 0 && (
          <optgroup label={t('routes.stationGroupStadium')}>
            {stations.stadiums.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </optgroup>
        )}
        {homesOnly.length > 0 && (
          <optgroup label={t('routes.stationGroupHome')}>
            {homesOnly.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </optgroup>
        )}
        <option value={OTHER}>{t('routes.stationOther')}</option>
      </select>
      {showManual && (
        <>
          <input
            value={value}
            required={required}
            placeholder={t('routes.stationOther')}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="station-note">{t('routes.stationFreeWarn')}</span>
        </>
      )}
    </div>
  );
}

export function RouteFaresPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [list, setList] = useState<RouteFare[]>([]);
  const [stations, setStations] = useState<KnownStations>(EMPTY_STATIONS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fare, setFare] = useState(0);
  const [mode, setMode] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditForm>({ fromStation: '', toStation: '', oneWayFare: 0, mode: '' });

  function fail(e: unknown) {
    notify(e instanceof ApiError ? e.message : t('common.loadError'), 'err');
  }
  const reload = () => api.get<RouteFare[]>('/api/admin/route-fares').then(setList).catch(fail);
  useEffect(() => {
    reload();
    // The station list only changes when a 球場 or アルバイト record does, so it is
    // fetched once. A failure leaves the picker with just その他 rather than
    // blocking the page — registering a fare stays possible either way.
    api.get<KnownStations>('/api/admin/stations').then(setStations).catch(() => setStations(EMPTY_STATIONS));
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/route-fares', {
        fromStation: from, toStation: to, oneWayFare: fare, mode,
      });
      setFrom(''); setTo(''); setFare(0); setMode('');
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
            <StationSelect value={from} stations={stations} onChange={setFrom} required /></div>
          <div className="field"><label>{t('routes.to')}</label>
            <StationSelect value={to} stations={stations} onChange={setTo} required /></div>
          <div className="field" style={{ maxWidth: 130 }}><label>{t('routes.fare')}</label>
            <input type="number" min={0} value={fare} onChange={(e) => setFare(Number(e.target.value))} required /></div>
          <div className="field" style={{ maxWidth: 140 }}><label>{t('routes.mode')}</label>
            <input value={mode} onChange={(e) => setMode(e.target.value)} /></div>
          <div className="field"><label>{t('routes.note')}</label>
            <input value={routeNoteOf(from, to)} readOnly disabled title={t('routes.noteAuto')} /></div>
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
                <td><StationSelect value={edit.fromStation} stations={stations}
                  onChange={(v) => setEF('fromStation', v)} /></td>
                <td><StationSelect value={edit.toStation} stations={stations}
                  onChange={(v) => setEF('toStation', v)} /></td>
                <td className="num"><input type="number" min={0} value={edit.oneWayFare} onChange={(e) => setEF('oneWayFare', Number(e.target.value))} style={{ maxWidth: 110 }} /></td>
                <td><input value={edit.mode} onChange={(e) => setEF('mode', e.target.value)} style={{ maxWidth: 120 }} /></td>
                <td className="muted">{routeNoteOf(edit.fromStation, edit.toStation)}</td>
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
