import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '../i18n';
import { AuthProvider } from '../context/AuthContext';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    // /api/auth/me → 401 so no session is restored.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'no' }), { status: 401 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the login form with email and password fields', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByLabelText(/メールアドレス|Email/)).toBeInTheDocument();
    // selector:'input' disambiguates from the show/hide toggle, whose aria-label
    // ("パスワードを表示") also contains "パスワード".
    expect(screen.getByLabelText(/パスワード|Password/, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
  });
});
