import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { currentMonth } from '../utils/format';

/**
 * The month a page is showing, defaulting to one that actually has data.
 *
 * Pages used to start on the current month unconditionally, so a freshly seeded
 * install opened on all zeros and 該当なし. The server answers which month to
 * open on (see /api/default-month); until it does, we show the current month so
 * nothing blocks on the request.
 *
 * The resolved month is held for the session, so moving between pages keeps the
 * month you were looking at instead of snapping back.
 */
let sessionMonth: string | null = null;
let inflight: Promise<string> | null = null;

/** Reset between tests — module state would otherwise leak across cases. */
export function __resetMonthCache(): void {
  sessionMonth = null;
  inflight = null;
}

function resolveDefaultMonth(): Promise<string> {
  if (sessionMonth) return Promise.resolve(sessionMonth);
  if (!inflight) {
    inflight = api
      .get<{ month: string }>('/api/default-month')
      .then((r) => {
        sessionMonth = r.month;
        return r.month;
      })
      // A failure here is cosmetic — fall back to the old behaviour rather than
      // leaving the page without a month.
      .catch(() => currentMonth())
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useMonth(): [string, (month: string) => void] {
  const [month, setMonthState] = useState(sessionMonth ?? currentMonth());
  // Don't overwrite a month the user picked while the request was in flight.
  const userPicked = useRef(sessionMonth !== null);

  useEffect(() => {
    if (userPicked.current) return;
    let active = true;
    resolveDefaultMonth().then((m) => {
      if (active && !userPicked.current) setMonthState(m);
    });
    return () => {
      active = false;
    };
  }, []);

  function setMonth(m: string) {
    userPicked.current = true;
    sessionMonth = m;
    setMonthState(m);
  }

  return [month, setMonth];
}
