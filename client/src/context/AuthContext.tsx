import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken } from '../api/client';
import { clearMonthCache, seedDefaultMonth } from '../hooks/useMonth';
import type { SessionUser, User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from a stored token. The response carries the month to open
    // on, so it is known before any protected page mounts (RequireRole holds them
    // back until `loading` clears) — no page ever paints on an empty month.
    api
      .get<SessionUser>('/api/auth/me')
      .then(({ defaultMonth, ...restored }) => {
        seedDefaultMonth(defaultMonth);
        setUser(restored);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: User; defaultMonth?: string }>(
      '/api/auth/login',
      { email, password },
    );
    setToken(res.token);
    seedDefaultMonth(res.defaultMonth);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
    // Otherwise the next person to sign in on this tab inherits the last one's month.
    clearMonthCache();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
