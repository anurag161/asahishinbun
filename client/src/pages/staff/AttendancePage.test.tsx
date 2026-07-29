/**
 * R3 — the staff member must be able to see which route will be claimed, and for
 * how much, BEFORE pressing 追加. A ¥0 outcome has to say which master is missing
 * rather than just showing nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../i18n';
import { ToastProvider } from '../../context/ToastContext';
import { __resetMonthCache } from '../../hooks/useMonth';
import { AttendancePage } from './AttendancePage';

const STADIUMS = [
  { id: 1, name: '大阪球場（サンプル）', address: '大阪市', nearest_station: '大阪' },
  { id: 2, name: '新球場', address: null, nearest_station: '未登録駅' },
];

/** Serves stubbed JSON by path, ignoring the query string. */
function stubApi(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = String(url).split('?')[0]!;
      if (!(path in routes)) {
        return new Response(JSON.stringify({ error: `unstubbed ${path}` }), { status: 404 });
      }
      return new Response(JSON.stringify(routes[path]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

const renderPage = () =>
  render(
    <ToastProvider>
      <AttendancePage />
    </ToastProvider>,
  );

const banner = () => document.querySelector('.banner');

beforeEach(() => {
  __resetMonthCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AttendancePage — 交通費 preview', () => {
  it('shows the route and the round-trip fare for the selected stadium', async () => {
    stubApi({
      '/api/stadiums': STADIUMS,
      '/api/attendance': [],
      '/api/expenses': [],
      '/api/default-month': { month: '2026-06' },
      '/api/attendance/transport-preview': {
        homeStation: '円山',
        stadiumStation: '大阪',
        mode: 'バス・電車',
        outboundFare: 1_930,
        inboundFare: 1_930,
        totalYen: 3_860,
        applied: true,
        reason: null,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(banner()?.textContent).toContain('円山 → 大阪');
    });
    // The round trip and the per-leg breakdown, so ¥3,860 is checkable against
    // the ¥1,930 on the 区間マスタ rather than taken on trust.
    expect(banner()?.textContent).toContain('¥3,860');
    expect(banner()?.textContent).toContain('¥1,930');
    expect(banner()?.className).toContain('ok');
  });

  it('names the missing 区間 instead of silently previewing ¥0', async () => {
    stubApi({
      '/api/stadiums': STADIUMS,
      '/api/attendance': [],
      '/api/expenses': [],
      '/api/default-month': { month: '2026-06' },
      '/api/attendance/transport-preview': {
        homeStation: '円山',
        stadiumStation: '未登録駅',
        mode: null,
        outboundFare: 0,
        inboundFare: 0,
        totalYen: 0,
        applied: false,
        reason: 'noRoute',
      },
    });

    renderPage();

    await waitFor(() => {
      expect(banner()?.textContent).toContain('円山 → 未登録駅');
    });
    expect(banner()?.className).toContain('warn');
  });

  it('points at the staff master when the home station is the thing missing', async () => {
    stubApi({
      '/api/stadiums': STADIUMS,
      '/api/attendance': [],
      '/api/expenses': [],
      '/api/default-month': { month: '2026-06' },
      '/api/attendance/transport-preview': {
        homeStation: null,
        stadiumStation: '大阪',
        mode: null,
        outboundFare: 0,
        inboundFare: 0,
        totalYen: 0,
        applied: false,
        reason: 'noHomeStation',
      },
    });

    renderPage();

    await waitFor(() => {
      expect(banner()?.textContent).toContain('自宅最寄り駅');
    });
    expect(banner()?.textContent).toContain('アルバイトマスタ');
  });

  it('re-resolves the fare when the stadium changes', async () => {
    const previews: Record<string, unknown> = {
      '1': {
        homeStation: '円山', stadiumStation: '大阪', mode: null,
        outboundFare: 1_930, inboundFare: 1_930, totalYen: 3_860, applied: true, reason: null,
      },
      '2': {
        homeStation: '円山', stadiumStation: '未登録駅', mode: null,
        outboundFare: 0, inboundFare: 0, totalYen: 0, applied: false, reason: 'noRoute',
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const raw = String(url);
        const path = raw.split('?')[0]!;
        const body =
          path === '/api/attendance/transport-preview'
            ? previews[new URL(raw, 'http://x').searchParams.get('stadiumId')!]
            : path === '/api/stadiums'
              ? STADIUMS
              : path === '/api/default-month'
                ? { month: '2026-06' }
                : [];
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );

    renderPage();
    await waitFor(() => expect(banner()?.textContent).toContain('¥3,860'));

    await userEvent.selectOptions(screen.getByLabelText('球場'), '2');

    await waitFor(() => expect(banner()?.textContent).toContain('未登録駅'));
    expect(banner()?.textContent).not.toContain('¥3,860');
  });
});
