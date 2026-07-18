import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import type { MyPageSummary } from '../../api/types';
import { MonthPicker } from '../../components/MonthPicker';
import { clock, currentMonth, yen } from '../../utils/format';

export function MyPage() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<MyPageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get<MyPageSummary>(`/api/mypage/summary?month=${month}`)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t('common.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, t]);

  return (
    <>
      <div className="pagehead">
        <h1>{t('mypage.title')}</h1>
        <span className="sub">{t('mypage.subtitle')}</span>
        <div className="spacer" />
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="empty-state">{t('common.loading')}</div>
      ) : error ? (
        <div className="banner err">{error}</div>
      ) : !summary ? (
        <div className="empty-state">{t('common.none')}</div>
      ) : (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <div className="card stat">
              <span className="label">{t('mypage.workDays')}</span>
              <span className="value">{summary.workDays}<span className="muted" style={{ fontSize: 14 }}> {t('common.days')}</span></span>
            </div>
            <div className="card stat">
              <span className="label">{t('mypage.totalHours')}</span>
              <span className="value">{clock(summary.totalWorkedMinutes)}</span>
            </div>
            <div className="card stat">
              <span className="label">{t('mypage.transport')}</span>
              <span className="value">{yen(summary.transportTotalYen)}</span>
            </div>
            <div className="card stat">
              <span className="label">{t('mypage.net')}</span>
              <span className="value good">{yen(summary.netYen)}</span>
            </div>
          </div>

          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <div className="card stat">
              <span className="label">{t('mypage.salary')}</span>
              <span className="value accent" style={{ fontSize: 19 }}>{yen(summary.salaryYen)}</span>
            </div>
            <div className="card stat">
              <span className="label">{t('mypage.gross')}</span>
              <span className="value" style={{ fontSize: 19 }}>{yen(summary.grossYen)}</span>
            </div>
            <div className="card stat">
              <span className="label">{t('mypage.tax')}</span>
              <span className="value" style={{ fontSize: 19 }}>{yen(summary.taxYen)}</span>
            </div>
            <div className="card stat" style={{ justifyContent: 'center' }}>
              <Link className="btn primary" to="/export">{t('mypage.goExport')}</Link>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('attendance.date')}</th>
                  <th className="num">{t('attendance.worked')}</th>
                  <th className="num">{t('mypage.salary')}</th>
                  <th className="num">{t('mypage.tax')}</th>
                  <th>{t('attendance.bucket')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.days.length === 0 ? (
                  <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
                ) : (
                  summary.days.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td className="num">{clock(d.workedMinutes)}</td>
                      <td className="num">{yen(d.dailyWageYen)}</td>
                      <td className="num">{yen(d.dailyTaxYen)}</td>
                      <td><span className={`pill ${d.bucket}`}>{t(`bucket.${d.bucket}`)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
