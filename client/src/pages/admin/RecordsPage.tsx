import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { AttendanceRow, RecordsResponse, Stadium } from '../../api/types';
import type { CostBucket } from '@asahi/shared';
import { useToast } from '../../context/ToastContext';
import { MonthPicker } from '../../components/MonthPicker';
import { useMonth } from '../../hooks/useMonth';
import { clock, timeOfDay, yen } from '../../utils/format';

const BUCKETS: CostBucket[] = ['henshu', 'daikai'];

export function RecordsPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [month, setMonth] = useMonth();
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [openStaff, setOpenStaff] = useState<number | null>(null);
  const [days, setDays] = useState<AttendanceRow[]>([]);

  function loadRecords() {
    setLoading(true);
    setError('');
    return api
      .get<RecordsResponse>(`/api/admin/records?month=${month}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : t('common.loadError')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.get<Stadium[]>('/api/stadiums').then(setStadiums).catch(() => {});
  }, []);

  useEffect(() => {
    setOpenStaff(null);
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function openDetail(staffId: number) {
    if (openStaff === staffId) {
      setOpenStaff(null);
      return;
    }
    setOpenStaff(staffId);
    const rows = await api
      .get<AttendanceRow[]>(`/api/admin/staff/${staffId}/attendance?month=${month}`)
      .catch((e) => {
        notify(e instanceof ApiError ? e.message : t('common.loadError'), 'err');
        return [] as AttendanceRow[];
      });
    setDays(rows);
  }

  async function retag(dayId: number, bucket: CostBucket) {
    try {
      await api.put(`/api/admin/attendance/${dayId}/bucket`, { bucket });
      setDays((ds) => ds.map((d) => (d.id === dayId ? { ...d, bucket } : d)));
      notify(t('common.save'));
      loadRecords();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : String(e), 'err');
    }
  }

  const stadiumName = (id: number) => stadiums.find((s) => s.id === id)?.name ?? `#${id}`;
  const worked = (d: AttendanceRow) =>
    d.end_minutes - d.start_minutes - (d.break_taken ? d.break_minutes : 0);

  return (
    <>
      <div className="pagehead">
        <h1>{t('records.title')}</h1>
        <span className="sub">{t('records.subtitle')}</span>
        <div className="spacer" />
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {error && <div className="banner err">{error}</div>}
      {loading && <div className="empty-state">{t('common.loading')}</div>}

      <div className="table-wrap" style={{ display: loading ? 'none' : undefined }}>
        <table className="data">
          <thead>
            <tr>
              <th>{t('records.staff')}</th>
              <th className="num">{t('records.workDays')}</th>
              <th className="num">{t('attendance.worked')}</th>
              <th className="num">{t('records.salary')}</th>
              <th className="num">{t('records.transport')}</th>
              <th className="num">{t('records.tax')}</th>
              <th className="num">{t('records.net')}</th>
              <th className="num">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.records.length === 0 ? (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : (
              data.records.map((r) => (
                <tr key={r.staffId}>
                  <td>{r.name}<div className="muted" style={{ fontSize: 11 }}>{r.email}</div></td>
                  <td className="num">{r.workDays}</td>
                  <td className="num">{clock(r.totalWorkedMinutes)}</td>
                  <td className="num">{yen(r.salaryYen)}</td>
                  <td className="num">{yen(r.transportYen)}</td>
                  <td className="num">{yen(r.taxYen)}</td>
                  <td className="num">{yen(r.netYen)}</td>
                  <td className="num">
                    <button className="btn sm" onClick={() => openDetail(r.staffId)}>
                      {openStaff === r.staffId ? t('common.close') : t('records.details')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openStaff !== null && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 4 }}>{t('records.retagTitle')}</h3>
          <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
            {t('records.retagHint')}
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('attendance.date')}</th>
                  <th>{t('attendance.stadium')}</th>
                  <th className="num">{t('attendance.start')}</th>
                  <th className="num">{t('attendance.end')}</th>
                  <th className="num">{t('attendance.break')}</th>
                  <th className="num">{t('attendance.worked')}</th>
                  <th>{t('attendance.bucket')}</th>
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
                      <td className="num">{timeOfDay(d.start_minutes)}</td>
                      <td className="num">{timeOfDay(d.end_minutes)}</td>
                      <td className="num">{d.break_taken && d.break_minutes ? clock(d.break_minutes) : '—'}</td>
                      <td className="num">{clock(worked(d))}</td>
                      <td>
                        <select
                          value={d.bucket}
                          onChange={(e) => retag(d.id, e.target.value as CostBucket)}
                          className={`pill ${d.bucket}`}
                          style={{ padding: '3px 8px', fontSize: 12, border: 'none' }}
                        >
                          {BUCKETS.map((b) => (
                            <option key={b} value={b}>{t(`bucket.${b}`)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
