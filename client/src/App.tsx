import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RequireRole } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { MyPage } from './pages/staff/MyPage';
import { AttendancePage } from './pages/staff/AttendancePage';
import { ExportPage } from './pages/staff/ExportPage';
import { StadiumsPage } from './pages/admin/StadiumsPage';
import { StaffPage } from './pages/admin/StaffPage';
import { RouteFaresPage } from './pages/admin/RouteFaresPage';
import { RecordsPage } from './pages/admin/RecordsPage';
import { AccountsPage } from './pages/admin/AccountsPage';
import { EmailSettingsPage } from './pages/admin/EmailSettingsPage';

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="content muted">…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin/records' : '/mypage'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireRole role="staff">
            <Layout />
          </RequireRole>
        }
      >
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/export" element={<ExportPage />} />
      </Route>

      <Route
        element={
          <RequireRole role="admin">
            <Layout />
          </RequireRole>
        }
      >
        <Route path="/admin/records" element={<RecordsPage />} />
        <Route path="/admin/stadiums" element={<StadiumsPage />} />
        <Route path="/admin/staff" element={<StaffPage />} />
        <Route path="/admin/accounts" element={<AccountsPage />} />
        <Route path="/admin/routes" element={<RouteFaresPage />} />
        <Route path="/admin/email" element={<EmailSettingsPage />} />
      </Route>

      <Route path="/" element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
