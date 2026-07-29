import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { setLanguage } from '../i18n';

const STAFF_LINKS = [
  { to: '/mypage', key: 'nav.mypage' },
  { to: '/attendance', key: 'nav.attendance' },
  { to: '/export', key: 'nav.export' },
];
const ADMIN_LINKS = [
  { to: '/admin/records', key: 'nav.records' },
  { to: '/admin/stadiums', key: 'nav.stadiums' },
  { to: '/admin/staff', key: 'nav.staff' },
  { to: '/admin/accounts', key: 'nav.accounts' },
  { to: '/admin/routes', key: 'nav.routes' },
  // 単価設定 is deliberately absent from the nav, NOT deleted: the route, the page
  // and /api/admin/rates all still work, and /admin/rates remains reachable by
  // URL. It is the only UI for 時給 and the 弁当代 amount, so it has to stay usable
  // for when MORABU confirms that figure — it is just not something Asahi should
  // be invited into during the demo.
  { to: '/admin/email', key: 'nav.email' },
];

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === 'admin' ? ADMIN_LINKS : STAFF_LINKS;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">朝</span>
          <span>{t('app.brand')}</span>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <button
          className="btn sm"
          onClick={() => setLanguage(i18n.language === 'ja' ? 'en' : 'ja')}
        >
          {i18n.language === 'ja' ? 'EN' : '日本語'}
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          {user?.name}
        </span>
        <button className="btn sm" onClick={handleLogout}>
          {t('nav.logout')}
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
