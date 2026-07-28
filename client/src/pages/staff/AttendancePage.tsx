import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { overtimeMinutesFor } from '@asahi/shared';
import { api, ApiError } from '../../api/client';
import type { AttendanceRow, ExpenseRow, Stadium, TransportResult } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { MonthPicker } from '../../components/MonthPicker';
import { useMonth } from '../../hooks/useMonth';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { clock, parseTime, timeOfDay, yen } from '../../utils/format';

/** The four fields a staff member can correct in-place on a saved day. */
type EditForm = { date: string; stadiumId: number; start: string; end: string };

/**
 * Expense types a staff member enters by hand. 'transport' is a valid category
 * server-side but is NOT offered here: it is generated from the registered fare
 * when a work day is saved, so a manual line would double-claim the journey.
 */
const MANUAL_CATEGORIES = ['perdiem', 'phone', 'lodging', 'other'] as const;
type ManualCategory = (typeof MANUAL_CATEGORIES)[number];

/** Keep a number box on whole numbers inside its range; empty reads as 0. */
function clampInt(raw: string, min: number, max: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function AttendancePage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [month, setMonth] = useMonth();
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [days, setDays] = useState<AttendanceRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  // form state
  const [date, setDate] = useState(`${month}-01`);
  const [stadiumId, setStadiumId] = useState<number | ''>('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('19:00');
  // Break is entered as HOURS + MINUTES, never as decimal hours. A single
  // decimal box accepted "1.25" as 1:15, but the client's paper 勤務表 writes
  // breaks as 1:25 — so transcribing it silently under-deducted 10 minutes and
  // overpaid the day. Two boxes make that mistake impossible to express.
  const [breakTaken, setBreakTaken] = useState(true);
  const [breakH, setBreakH] = useState(1);
  const [breakM, setBreakM] = useState(0);
  const breakMinutes = breakTaken ? breakH * 60 + breakM : 0;
  // 弁当代有無 — a ○/× the staff can only pick when the day exceeds 6 worked hours.
  const [lunchAllowance, setLunchAllowance] = useState(false);
  const [busy, setBusy] = useState(false);

  // Manual expense form (私有携帯 / 出張日当 / 宿泊実費 / その他).
  const [exDate, setExDate] = useState(`${month}-01`);
  const [exCategory, setExCategory] = useState<ManualCategory>('perdiem');
  const [exAmount, setExAmount] = useState('');
  const [exNote, setExNote] = useState('');

  // Inline row editing (pencil). null = no row open for edit.
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditForm>({ date: '', stadiumId: 0, start: '', end: '' });

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
    setExDate(`${month}-01`);
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
        breakMinutes,
        lunchAllowance: lunchEligible && lunchAllowance,
      });
      // The day is saved either way; only the auto-transport differs. Both are
      // success toasts — a red one here reads as "add failed", which it didn't.
      notify(
        res.transport.applied
          ? t('attendance.applied', { yen: yen(res.transport.totalYen) })
          : t('attendance.noRoute'),
        'ok',
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

  async function addExpense(e: FormEvent) {
    e.preventDefault();
    const amountYen = Math.round(Number(exAmount));
    if (!Number.isFinite(amountYen) || amountYen < 0) {
      notify(t('expense.amount'), 'err');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/expenses', {
        date: exDate,
        category: exCategory,
        amountYen,
        description: exNote.trim() || undefined,
      });
      // Clear the amount and note but keep date and type — entering several
      // lines for one trip is the common case.
      setExAmount('');
      setExNote('');
      notify(t('expense.added'), 'ok');
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function removeExpense(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await api.del(`/api/expenses/${id}`);
      reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), 'err');
    }
  }

  async function removeDay(id: number) {
    if (!confirm(t('common.confirmDelete'))) return;
    await api.del(`/api/attendance/${id}`);
    reload();
  }

  function startEdit(d: AttendanceRow) {
    setEditId(d.id);
    setEdit({
      date: d.work_date,
      stadiumId: d.stadium_id,
      start: timeOfDay(d.start_minutes),
      end: timeOfDay(d.end_minutes),
    });
  }

  async function saveEdit(row: AttendanceRow) {
    const s = parseTime(edit.start);
    const en = parseTime(edit.end);
    if (s === null || en === null) {
      notify('Invalid time', 'err');
      return;
    }
    setBusy(true);
    try {
      const res = await api.put<{ transport: TransportResult }>(`/api/attendance/${row.id}`, {
        date: edit.date,
        stadiumId: edit.stadiumId,
        startMinutes: s,
        endMinutes: en,
        // Carry the row's other fields through untouched. The server re-parses the
        // whole body and defaults anything missing — omitting these would silently
        // reset the break, the 弁当代 flag and the admin's 区分 re-tagging.
        breakTaken: row.break_taken,
        breakMinutes: row.break_minutes,
        lunchAllowance: row.lunch_allowance,
        bucket: row.bucket,
        overtimeMinutes: row.overtime_minutes,
        nightMinutes: row.night_minutes,
        tournament: row.tournament,
      });
      setEditId(null);
      // Moving a day re-runs auto transport, same as adding one.
      notify(
        res.transport.applied
          ? t('attendance.applied', { yen: yen(res.transport.totalYen) })
          : t('attendance.noRoute'),
        'ok',
      );
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 409
          ? t('attendance.duplicate', { date: edit.date })
          : err instanceof ApiError
            ? err.message
            : String(err);
      notify(msg, 'err');
    } finally {
      setBusy(false);
    }
  }

  const stadiumName = (id: number) => stadiums.find((s) => s.id === id)?.name ?? `#${id}`;
  const worked = (d: AttendanceRow) =>
    d.end_minutes - d.start_minutes - (d.break_taken ? d.break_minutes : 0);
  // 時間外 as the engine will pay it (worked − 8h) — shown, never typed in.
  const overtime = (d: AttendanceRow) => overtimeMinutesFor(worked(d), d.overtime_minutes);
  // 弁当代有無 as it lands on the 勤務表: ○ only when declared AND the day exceeds
  // 6 worked hours (same gate the engine applies); × otherwise.
  const lunchMark = (d: AttendanceRow) => (d.lunch_allowance && worked(d) > 6 * 60 ? '○' : '×');

  // 弁当代 is offered only when the day exceeds 6 worked hours (勤務表 note). Compute
  // that live from the form so the ○/× disables the moment the day drops to ≤6h.
  const formStart = parseTime(start);
  const formEnd = parseTime(end);
  const formWorkedMin =
    formStart !== null && formEnd !== null ? formEnd - formStart - breakMinutes : 0;
  const lunchEligible = formWorkedMin > 6 * 60;

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
          <div className="field field-break">
            <label>{t('attendance.break')}</label>
            <div className="break-control">
              <input
                type="checkbox"
                checked={breakTaken}
                onChange={(e) => setBreakTaken(e.target.checked)}
                aria-label={t('attendance.breakTaken')}
              />
              <input
                type="number"
                min={0}
                max={23}
                step={1}
                value={breakH}
                disabled={!breakTaken}
                aria-label={`${t('attendance.break')} — ${t('attendance.unitHour')}`}
                onChange={(e) => setBreakH(clampInt(e.target.value, 0, 23))}
              />
              <span className="unit">{t('attendance.unitHour')}</span>
              {/* Capped at 59 so 90 minutes can't be entered here and read as 1:90
                  — the hours box is where anything past an hour belongs. */}
              <input
                type="number"
                min={0}
                max={59}
                step={1}
                value={breakM}
                disabled={!breakTaken}
                aria-label={`${t('attendance.break')} — ${t('attendance.unitMinute')}`}
                onChange={(e) => setBreakM(clampInt(e.target.value, 0, 59))}
              />
              <span className="unit">{t('attendance.unitMinute')}</span>
            </div>
          </div>
          <div className="field field-lunch">
            <label htmlFor="lunch">{t('attendance.lunch')}</label>
            {/* The ineligibility note sits beside the toggle it explains, not at
                the foot of the form where it read as a note about the whole row. */}
            <div className="lunch-control">
              <select
                id="lunch"
                value={lunchEligible && lunchAllowance ? 'yes' : 'no'}
                disabled={!lunchEligible}
                onChange={(e) => setLunchAllowance(e.target.value === 'yes')}
              >
                <option value="yes">{t('attendance.lunchYes')}</option>
                <option value="no">{t('attendance.lunchNo')}</option>
              </select>
              {/* Always rendered, only hidden — otherwise the row reflows and the
                  submit button jumps as the entered hours cross 6. */}
              <span className={`field-note${lunchEligible ? ' is-hidden' : ''}`}>
                {t('attendance.lunchIneligible')}
              </span>
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
              <th className="num">{t('attendance.overtime')}</th>
              <th style={{ textAlign: 'center' }}>{t('attendance.lunch')}</th>
              <th className="num">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : (
              days.map((d) => editId === d.id ? (
                <tr key={d.id}>
                  <td>
                    <input type="date" value={edit.date}
                      onChange={(e) => setEdit((f) => ({ ...f, date: e.target.value }))} />
                  </td>
                  <td>
                    <select value={edit.stadiumId}
                      onChange={(e) => setEdit((f) => ({ ...f, stadiumId: Number(e.target.value) }))}>
                      {stadiums.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="time" value={edit.start}
                      onChange={(e) => setEdit((f) => ({ ...f, start: e.target.value }))} />
                  </td>
                  <td>
                    <input type="time" value={edit.end}
                      onChange={(e) => setEdit((f) => ({ ...f, end: e.target.value }))} />
                  </td>
                  {/* Worked and overtime are derived, so they stay read-only. */}
                  <td className="num">{clock(worked(d))}</td>
                  <td className="num">{overtime(d) ? clock(overtime(d)) : '—'}</td>
                  {/* 弁当代有無 isn't inline-editable; carried through on save. */}
                  <td style={{ textAlign: 'center' }}>{lunchMark(d)}</td>
                  <td className="num">
                    <span className="row-actions">
                      <button className="btn sm primary" disabled={busy}
                        onClick={() => saveEdit(d)}>{t('common.save')}</button>
                      <button className="btn sm" disabled={busy}
                        onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                    </span>
                  </td>
                </tr>
              ) : (
                <tr key={d.id}>
                  <td>{d.work_date}</td>
                  <td>{stadiumName(d.stadium_id)}</td>
                  <td>{timeOfDay(d.start_minutes)}</td>
                  <td>{timeOfDay(d.end_minutes)}</td>
                  <td className="num">{clock(worked(d))}</td>
                  <td className="num">{overtime(d) ? clock(overtime(d)) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{lunchMark(d)}</td>
                  <td className="num">
                    <span className="row-actions">
                      <button
                        className="btn sm icon"
                        onClick={() => startEdit(d)}
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        className="btn sm icon danger"
                        onClick={() => removeDay(d.id)}
                        aria-label={t('common.delete')}
                        title={t('common.delete')}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ margin: '4px 0 10px' }}>{t('attendance.expenses')}</h2>

      {/* 交通費 is deliberately absent from the type list: it is generated from the
          registered fare when a day is saved, so offering it here would let the
          same journey be claimed twice. */}
      <form className="card" onSubmit={addExpense} style={{ marginBottom: 14 }}>
        <div className="row">
          <div className="field">
            <label>{t('attendance.date')}</label>
            <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('expense.category')}</label>
            <select value={exCategory} onChange={(e) => setExCategory(e.target.value as ManualCategory)}>
              {MANUAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`expense.${c}`)}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 130 }}>
            <label>{t('expense.amount')}</label>
            <input
              type="number"
              min={0}
              step={1}
              value={exAmount}
              onChange={(e) => setExAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>{t('expense.description')}</label>
            <input value={exNote} onChange={(e) => setExNote(e.target.value)} />
          </div>
          <button className="btn primary" type="submit" disabled={busy}>{t('expense.add')}</button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '10px 2px 0' }}>{t('expense.hint')}</p>
        {exCategory === 'phone' && (
          <p className="muted" style={{ fontSize: 12, margin: '4px 2px 0' }}>{t('expense.taxableNote')}</p>
        )}
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{t('attendance.date')}</th>
              <th>{t('expense.category')}</th>
              <th>{t('expense.description')}</th>
              <th className="num">{t('common.yen')}</th>
              <th className="num">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.expense_date}</td>
                  <td>
                    {e.source === 'auto' ? t('expense.auto') : t(`expense.${e.category}`)}
                  </td>
                  <td>{e.description ?? '—'}</td>
                  <td className="num">{yen(e.amount_yen)}</td>
                  <td className="num">
                    {/* Auto transport is owned by the work day — the API refuses to
                        delete it here, so don't offer a button that cannot work. */}
                    {e.source === 'auto' ? (
                      <span className="pill auto">auto</span>
                    ) : (
                      <button
                        className="btn sm icon danger"
                        onClick={() => removeExpense(e.id)}
                        aria-label={t('common.delete')}
                        title={t('common.delete')}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
