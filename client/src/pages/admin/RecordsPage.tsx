import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { RecordsResponse } from '../../api/types';
import { MonthPicker } from '../../components/MonthPicker';
import { clock, currentMonth, yen } from '../../utils/format';

export function RecordsPage() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<RecordsResponse | null>(null);

  useEffect(() => {
    api.get<RecordsResponse>(`/api/admin/records?month=${month}`).then(setData);
  }, [month]);

  const totals = data?.records.reduce(
    (acc, r) => ({
      salary: acc.salary + r.salaryYen,
      transport: acc.transport + r.transportYen,
      tax: acc.tax + r.taxYen,
      net: acc.net + r.netYen,
    }),
    { salary: 0, transport: 0, tax: 0, net: 0 },
  );

  return (
    <>
      <div className="pagehead">
        <h1>{t('records.title')}</h1>
        <span className="sub">{t('records.subtitle')}</span>
        <div className="spacer" />
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="table-wrap">
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
            </tr>
          </thead>
          <tbody>
            {!data || data.records.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center' }}>{t('common.none')}</td></tr>
            ) : (
              <>
                {data.records.map((r) => (
                  <tr key={r.staffId}>
                    <td>{r.name}<div className="muted" style={{ fontSize: 11 }}>{r.email}</div></td>
                    <td className="num">{r.workDays}</td>
                    <td className="num">{clock(r.totalWorkedMinutes)}</td>
                    <td className="num">{yen(r.salaryYen)}</td>
                    <td className="num">{yen(r.transportYen)}</td>
                    <td className="num">{yen(r.taxYen)}</td>
                    <td className="num">{yen(r.netYen)}</td>
                  </tr>
                ))}
                {totals && (
                  <tr className="total">
                    <td>合計 / Total</td>
                    <td className="num"></td>
                    <td className="num"></td>
                    <td className="num">{yen(totals.salary)}</td>
                    <td className="num">{yen(totals.transport)}</td>
                    <td className="num">{yen(totals.tax)}</td>
                    <td className="num">{yen(totals.net)}</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
