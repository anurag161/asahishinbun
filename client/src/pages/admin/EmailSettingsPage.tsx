import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface EmailSettings {
  testRecipient: string | null;
  smtpConfigured: boolean;
}

interface TestResult {
  to: string;
  delivery: string;
  previewUrl?: string;
}

/**
 * メール設定 — where document email is delivered while checking that it works.
 *
 * With an address set here, every document email is diverted to it instead of
 * the staff member's own. Nothing about the accounts changes; clearing the field
 * restores normal delivery.
 */
export function EmailSettingsPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  function fail(e: unknown) {
    notify(e instanceof ApiError ? e.message : t('common.loadError'), 'err');
  }

  useEffect(() => {
    api
      .get<EmailSettings>('/api/admin/email-settings')
      .then((s) => {
        setSettings(s);
        setValue(s.testRecipient ?? '');
      })
      .catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await api.put<EmailSettings>('/api/admin/email-settings', {
        testRecipient: value.trim(),
      });
      setSettings(s);
      setValue(s.testRecipient ?? '');
      notify(s.testRecipient ? t('email.saved', { to: s.testRecipient }) : t('email.cleared'), 'ok');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await api.post<TestResult>('/api/admin/email-settings/test');
      if (res.previewUrl) {
        // Ethereal: really sent, but only viewable at a preview URL.
        window.open(res.previewUrl, '_blank', 'noopener');
        notify(t('email.testPreview', { to: res.to }), 'ok');
      } else {
        notify(t('email.testSent', { to: res.to }), 'ok');
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const saved = settings?.testRecipient ?? null;
  const dirty = value.trim() !== (saved ?? '');

  return (
    <>
      <div className="pagehead">
        <h1>{t('email.title')}</h1>
        <span className="sub">{t('email.subtitle')}</span>
      </div>

      <form className="card" onSubmit={save} style={{ marginBottom: 16 }}>
        <div className="row">
          <div className="field">
            <label htmlFor="test-recipient">{t('email.recipient')}</label>
            <input
              id="test-recipient"
              type="email"
              value={value}
              placeholder={t('email.placeholder')}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <button className="btn primary" type="submit" disabled={busy || !dirty}>
            {t('common.save')}
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy || !saved || dirty}
            onClick={sendTest}
            title={dirty ? t('email.saveFirst') : ''}
          >
            {t('email.sendTest')}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '12px 2px 0' }}>
          {t('email.hint')}
        </p>
      </form>

      <div className={`banner ${saved ? 'ok' : ''}`} style={
        saved ? undefined : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
      }>
        {saved ? t('email.statusOn', { to: saved }) : t('email.statusOff')}
      </div>

      {settings && !settings.smtpConfigured && (
        <p className="muted" style={{ fontSize: 12, margin: '4px 2px 0' }}>
          {t('email.noSmtp')}
        </p>
      )}
    </>
  );
}
