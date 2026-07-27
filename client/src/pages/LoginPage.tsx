import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { setLanguage } from '../i18n';
import { EyeIcon, EyeOffIcon } from '../components/icons';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // The sample-staff login changes when DEMO_STAFF_EMAIL is set, so read the
  // real address from the server instead of hard-coding a stale hint.
  const [staffEmail, setStaffEmail] = useState('staff@example.com');

  useEffect(() => {
    api
      .get<{ demoStaffEmail?: string }>('/api/capabilities')
      .then((c) => c.demoStaffEmail && setStaffEmail(c.demoStaffEmail))
      .catch(() => {});
  }, []);

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/records' : '/mypage'} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? t('login.error') : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="brand" style={{ marginBottom: 16 }}>
          <span className="mark">朝</span>
          <span>{t('app.brand')}　<span className="muted" style={{ fontWeight: 500 }}>{t('app.title')}</span></span>
        </div>
        <h1 style={{ fontSize: 18, marginBottom: 14 }}>{t('login.title')}</h1>

        {error && <div className="banner err">{error}</div>}

        <div className="field">
          <label htmlFor="email">{t('login.email')}</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t('login.password')}</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', paddingRight: 42 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
              aria-pressed={showPassword}
              title={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                padding: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? t('common.loading') : t('login.submit')}
        </button>

        <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('login.demo')}</div>
          admin@example.com / admin123<br />
          {staffEmail} / staff123
        </div>

        <button
          type="button"
          className="btn sm"
          style={{ marginTop: 14 }}
          onClick={() => setLanguage(i18n.language === 'ja' ? 'en' : 'ja')}
        >
          {i18n.language === 'ja' ? 'English' : '日本語'}
        </button>
      </form>
    </div>
  );
}
