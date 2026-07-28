import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';

/**
 * 単価設定 (Pay Rates) — the hourly/overtime/night rates and the 弁当代 (meal
 * allowance) flat amount. These feed the engine, so a change here reprices every
 * document. 弁当代 ships at ¥0 until the amount is confirmed; set it here.
 *
 * GET returns the stored row (snake_case) or the defaults (camelCase), so read
 * both shapes; PUT always takes camelCase.
 */
interface RatesForm {
  effectiveYear: string;
  hourlyYen: number;
  overtimeUnder60Yen: number;
  overtimeOver60Yen: number;
  nightYen: number;
  lunchYen: number;
}

const EMPTY: RatesForm = {
  effectiveYear: '',
  hourlyYen: 0,
  overtimeUnder60Yen: 0,
  overtimeOver60Yen: 0,
  nightYen: 0,
  lunchYen: 0,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(r: any): RatesForm {
  return {
    effectiveYear: r.effective_year ?? r.effectiveYear ?? '',
    hourlyYen: r.hourly_yen ?? r.hourlyYen ?? 0,
    overtimeUnder60Yen: r.overtime_under60_yen ?? r.overtimeUnder60Yen ?? 0,
    overtimeOver60Yen: r.overtime_over60_yen ?? r.overtimeOver60Yen ?? 0,
    nightYen: r.night_yen ?? r.nightYen ?? 0,
    lunchYen: r.lunch_yen ?? r.lunchYen ?? 0,
  };
}

export function RatesPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [form, setForm] = useState<RatesForm>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/api/admin/rates')
      .then((r) => setForm(normalize(r)))
      .catch((e) => notify(e instanceof ApiError ? e.message : t('common.loadError'), 'err'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof RatesForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'effectiveYear' ? e.target.value : Number(e.target.value) }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api.put('/api/admin/rates', form);
      setForm(normalize(saved));
      notify(t('common.save'), 'ok');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  /**
   * The premiums are stored as 割増分 (the extra ¥/h on top of the hourly rate), so
   * ¥1,300 + ¥325 is the familiar 1.25×. Nothing keeps them in step automatically —
   * spell the multiplier out so an admin who raises 時給 can see the premium drift.
   */
  function multiplierNote(premiumYen: number): string | null {
    if (!form.hourlyYen || !premiumYen) return null;
    const effective = form.hourlyYen + premiumYen;
    return t('rates.multiplier', {
      x: (effective / form.hourlyYen).toFixed(2).replace(/\.?0+$/, ''),
      effective: effective.toLocaleString('ja-JP'),
    });
  }

  const money: { k: keyof RatesForm; label: string; note?: string | null }[] = [
    { k: 'hourlyYen', label: t('rates.hourly') },
    {
      k: 'overtimeUnder60Yen',
      label: t('rates.overtimeUnder60'),
      note: multiplierNote(form.overtimeUnder60Yen),
    },
    {
      k: 'overtimeOver60Yen',
      label: t('rates.overtimeOver60'),
      note: multiplierNote(form.overtimeOver60Yen),
    },
    { k: 'nightYen', label: t('rates.night'), note: multiplierNote(form.nightYen) },
    { k: 'lunchYen', label: t('rates.lunch') },
  ];

  return (
    <>
      <div className="pagehead">
        <h1>{t('rates.title')}</h1>
        <span className="sub">{t('rates.subtitle')}</span>
      </div>

      <form className="card" onSubmit={save} style={{ maxWidth: 520 }}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t('rates.effectiveYear')}</label>
          <input type="text" value={form.effectiveYear} onChange={set('effectiveYear')} placeholder="令和8年" />
        </div>
        {money.map(({ k, label, note }) => (
          <div className="field" key={k} style={{ marginBottom: 12 }}>
            <label>{label}</label>
            <input type="number" min={0} value={form[k] as number} onChange={set(k)} />
            {note && <span className="field-note">{note}</span>}
          </div>
        ))}
        <button className="btn primary" type="submit" disabled={busy}>{t('common.save')}</button>
        <p className="muted" style={{ fontSize: 12, margin: '12px 2px 0' }}>{t('rates.overtimeHint')}</p>
        <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>{t('rates.hint')}</p>
      </form>
    </>
  );
}
