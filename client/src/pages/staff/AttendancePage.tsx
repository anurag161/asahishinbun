import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { AttendanceRow, ExpenseRow, Stadium, TransportResult } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { MonthPicker } from '../../components/MonthPicker';
import { clock, currentMonth, parseTime, timeOfDay, yen } from '../../utils/format';

export function AttendancePage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [days, setDays] = useState<AttendanceRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  // form state
  const [date, setDate] = useState(`${month}-01`);
  const [stadiumId, setStadiumId] = useState<number | ''>('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('19:00');
  const [breakTaken, setBreakTaken] = useState(true);
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    Promise.all([
      api.get<AttendanceRow[]>(`/api/attendance?month=${month}`),
      api.get<ExpenseRow[]>(`/api/expenses?month=${month}`),
    ])
      .then(([a, e]) => {
        setDays(a);
        setExpenses(e);
      })
      .catch((err) => notify(err instanceof ApiError ? err.message : t('common.loadError'), 'err'));
  }, [month, notify, t]);

  useEffect(() => {
    api.get<Stadium[]>('/api/stadiums').then((s) => {
      setStadiums(s);
      setStadiumId((cur) => (cur === '' && s[0] ? s[0].id : cur));
    });
  }, []);
  useEffect(() => {
    setDate(`${month}-01`);
    reload();
  }, [month, reload]);

  async function addDay(e: FormEvent) {
    e.preventDefault();
    if (stadiumId === '') return;
    const s = parseTime(start);
    const en = parseTime(end);
    if (s === null || en === null) {
      notify('Invalid time', 'err');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ transport: TransportResult }>('/api/attendance', {
        date,
        stadiumId,
        startMinutes: s,
        endMinutes: en,
        breakTaken,
        breakMinutes: breakTaken ? breakMinutes : 0,
      });
      notify(
        res.transport.applied
          ? t('attendance.applied', { yen: yen(res.transport.totalYen) })
          : t('attendance.noRoute'),
        res.transport.applied ? 'ok' : 'err',
      );
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 409
          ? t('attendance.duplicate', { date })
          : err instanceof ApiError
            ? err.message
            : String(err);
      notify(msg, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function removeDay(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    await api.del(`/api/attendance/${id}`);
    reload();
  }

  const stadiumName = (id: number) => stadiums.find((s) => s.id === id)?.name ?? `#${id}`;
  const worked = (d: AttendanceRow) =>
    d.end_minutes - d.start_minutes - (d.break_taken ? d.break_minutes : 0);

  return (
    <>
      <div className="pagehead">
        <h1>{t('attendance.title')}</h1>
        <span className="sub">{t('attendance.subtitle')}</span>
        <div className="spacer" />
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <form className="card" onSubmit={addDay} style={{ marginBottom: 18 }}>
        <div className="row">
          <div className="field">
            <label>{t('attendance.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('attendance.stadium')}</label>
            <select value={stadiumId} onChange={(e) => setStadiumId(Number(e.target.value))} required>
              {stadiums.length === 0 && <option value="">—</option>}
              {stadiums.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 110 }}>
            <label>{t('attendance.start')}</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="field" style={{ maxWidth: 110 }}>
            <label>{t('attendance.end')}</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
          <div className="field" style={{ maxWidth: 130 }}>
            <label>{t('attendance.breakMinutes')}</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={breakTaken}
                onChange={(e) => setBreakTaken(e.target.checked)}
                aria-label={t('attendance.breakTaken')}
                style={{ width: 18 }}
              />
              <input
                type="number"
                min={0}
                value={breakMinutes}
                disabled={!breakTaken}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
              />
            </div>
          </div>
          <button className="btn primary" type="submit" disabled={busy || stadiums.length === 0}>
            {t('attendance.addDay')}
          </button>
        </div>
      </form>

      <h2 style={{ margin: '4px 0 10px' }}>{t('attendance.existing')}</h2>
      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table className="data">
          <thead>
            <tr>
              <th>{t('attendance.date')}</th>
              <th>{t('attendance.stadium')}</th>
              <th>{t('attendance.start')}</th>
              <th>{t('attendance.end')}</th>
              <th className="num">{t('attendance.worked')}</th>
              <th>{t('attendance.bucket')}</th>
              <th className="num">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : (
              days.map((d) => (
                <tr key={d.id}>
                  <td>{d.work_date}</td>
                  <td>{stadiumName(d.stadium_id)}</td>
                  <td>{timeOfDay(d.start_minutes)}</td>
                  <td>{timeOfDay(d.end_minutes)}</td>
                  <td className="num">{clock(worked(d))}</td>
                  <td><span className={`pill ${d.bucket}`}>{t(`bucket.${d.bucket}`)}</span></td>
                  <td className="num">
                    <button className="btn sm danger" onClick={() => removeDay(d.id)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ margin: '4px 0 10px' }}>{t('attendance.expenses')}</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t('attendance.date')}</th>
              <th>{t('routes.mode')}</th>
              <th className="num">{t('common.yen')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={4} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.expense_date}</td>
                  <td>{e.description ?? e.category}</td>
                  <td className="num">{yen(e.amount_yen)}</td>
                  <td>{e.source === 'auto' && <span className="pill auto">auto</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
