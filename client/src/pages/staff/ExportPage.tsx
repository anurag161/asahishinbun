import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, authFetch } from '../../api/client';
import type { User } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { MonthPicker } from '../../components/MonthPicker';
import { currentMonth } from '../../utils/format';

type DocType = 'timesheet' | 'invoice' | 'payslip';
const DOC_TYPES: DocType[] = ['timesheet', 'invoice', 'payslip'];

interface Capabilities {
  pdf: boolean;
  email: boolean;
}

export function ExportPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [me, setMe] = useState<User | null>(null);
  const [active, setActive] = useState<DocType>('payslip');
  const [html, setHtml] = useState('');
  const [caps, setCaps] = useState<Capabilities>({ pdf: false, email: false });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    api.get<User>('/api/auth/me').then(setMe).catch(() => notify(t('common.loadError'), 'err'));
    api.get<Capabilities>('/api/capabilities').then(setCaps).catch(() => {});
  }, [notify, t]);

  async function view(type: DocType) {
    setActive(type);
    const res = await authFetch(`/api/documents/${type}/${me!.id}?month=${month}`);
    setHtml(await res.text());
  }

  useEffect(() => {
    if (me) view(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, month]);

  async function openPdf(type: DocType) {
    const res = await authFetch(`/api/documents/${type}/${me!.id}?month=${month}&format=pdf`);
    if (res.status === 501) {
      notify(t('export.print'), 'err');
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  /** Print the already-loaded document (same-origin iframe → no popup blocker). */
  function printDoc() {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  }

  async function email(type: DocType) {
    try {
      const res = await api.post<{ to: string; delivery: string; pdfAttached: boolean; previewUrl?: string }>(
        `/api/documents/${type}/${me!.id}/email?month=${month}`,
      );
      if (res.delivery === 'smtp') {
        notify(t('export.emailed', { to: res.to }), 'ok');
      } else if (res.previewUrl) {
        // Ethereal: the mail really sent — open the viewable preview.
        window.open(res.previewUrl, '_blank', 'noopener');
        notify(t('export.emailedPreview', { to: res.to }), 'ok');
      } else {
        notify(t('export.emailedCaptured'), 'err');
      }
    } catch {
      notify('Email failed', 'err');
    }
  }

  return (
    <>
      <div className="pagehead">
        <h1>{t('export.title')}</h1>
        <span className="sub">{t('export.subtitle')}</span>
        <div className="spacer" />
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        {DOC_TYPES.map((type) => (
          <div className="card" key={type}>
            <h3 style={{ marginBottom: 10 }}>{t(`export.${type}`)}</h3>
            <div className="row" style={{ gap: 8 }}>
              <button
                className={`btn sm ${active === type ? 'primary' : ''}`}
                onClick={() => view(type)}
              >
                {t('export.view')}
              </button>
              <button className="btn sm btn-pdf" onClick={() => openPdf(type)} title={caps.pdf ? '' : t('export.print')}>
                {t('export.pdf')}
              </button>
              <button className="btn sm" onClick={() => email(type)}>{t('export.email')}</button>
            </div>
          </div>
        ))}
      </div>

      <div className="banner" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
        {caps.pdf ? '🖨 ' + t('export.pdfReady') : '🖨 ' + t('export.pdfBrowser')} ·{' '}
        {caps.email ? '✉ ' + t('export.emailReady') : '✉ ' + t('export.emailCapture')}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <strong>{t(`export.${active}`)}</strong>
          <button className="btn sm primary" onClick={printDoc}>{t('export.print')}</button>
        </div>
        <iframe
          ref={iframeRef}
          title={active}
          srcDoc={html}
          style={{ width: '100%', height: 640, border: 'none', background: '#fff' }}
        />
      </div>
    </>
  );
}
