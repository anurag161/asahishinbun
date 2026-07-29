/**
 * R5 — 区間マスタ station pickers.
 *
 * Auto transport matches station names EXACTLY, so a hand-typed near-miss books
 * ¥0 with nothing on screen to explain it. These tests pin the two properties
 * that close that trap: the registered names are offered as a choice, and free
 * text is a deliberate opt-in that says what it risks.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../i18n';
import { ToastProvider } from '../../context/ToastContext';
import { RouteFaresPage } from './RouteFaresPage';

const STATIONS = { stadiums: ['大阪', '阪神甲子園'], homes: ['円山', '大阪'] };

function stubApi(stations: unknown = STATIONS, fares: unknown = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = String(url).split('?')[0]!;
      const body = path === '/api/admin/stations' ? stations : fares;
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

const renderPage = () =>
  render(
    <ToastProvider>
      <RouteFaresPage />
    </ToastProvider>,
  );

/** The 出発駅 picker on the add form (the first station select on the page). */
const fromSelect = () => document.querySelectorAll('select')[0] as HTMLSelectElement;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RouteFaresPage — station pickers', () => {
  it('offers the registered stations instead of a free-text box', async () => {
    stubApi();
    renderPage();

    await waitFor(() => {
      expect(within(fromSelect()).getByRole('option', { name: '大阪' })).toBeInTheDocument();
    });
    expect(within(fromSelect()).getByRole('option', { name: '円山' })).toBeInTheDocument();
    expect(within(fromSelect()).getByRole('option', { name: '阪神甲子園' })).toBeInTheDocument();
  });

  it('lists a station shared by both masters only once', async () => {
    stubApi();
    renderPage();

    // 大阪 is seeded as a stadium station AND as someone's home station.
    await waitFor(() => {
      expect(within(fromSelect()).getAllByRole('option', { name: '大阪' })).toHaveLength(1);
    });
  });

  it('groups the options by which master they came from', async () => {
    stubApi();
    renderPage();

    await waitFor(() => {
      const groups = fromSelect().querySelectorAll('optgroup');
      expect([...groups].map((g) => g.label)).toEqual(['球場最寄り駅', '自宅最寄り駅']);
    });
  });

  it('reveals a text box with a warning only when その他 is chosen', async () => {
    stubApi();
    renderPage();

    await waitFor(() => expect(fromSelect().options.length).toBeGreaterThan(1));
    expect(document.querySelector('.station-note')).toBeNull();

    const other = within(fromSelect()).getByRole('option', {
      name: 'その他（手入力）',
    }) as HTMLOptionElement;
    await userEvent.selectOptions(fromSelect(), other.value);

    await waitFor(() => {
      expect(document.querySelector('.station-note')?.textContent).toContain('完全に一致');
    });
    expect(document.querySelector('.station-control input')).toBeInTheDocument();
  });

  it('still lets a fare be registered when the station list fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = String(url).split('?')[0]!;
        if (path === '/api/admin/stations') {
          return new Response(JSON.stringify({ error: 'boom' }), { status: 500 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );
    renderPage();

    // Degrades to その他 only — the page must not become a dead end.
    await waitFor(() => {
      expect(
        within(fromSelect()).getByRole('option', { name: 'その他（手入力）' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('区間別交通費')).toBeInTheDocument();
  });

  it('opens an existing row on free text when its station is in neither master', async () => {
    stubApi(STATIONS, [
      {
        id: 7,
        from_station: '旧駅名',
        to_station: '大阪',
        one_way_fare: 500,
        mode: '電車',
        route_note: '旧駅名→大阪',
      },
    ]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: '編集' }));

    // The name survives editing rather than being blanked by a select that has
    // no matching option.
    await waitFor(() => {
      const typed = document.querySelector<HTMLInputElement>('.station-control input');
      expect(typed?.value).toBe('旧駅名');
    });
  });
});
