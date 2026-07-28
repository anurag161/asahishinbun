import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { currentMonth } from '../utils/format';

/**
 * The month a page is showing, defaulting to one that actually has data.
 *
 * Pages used to start on the current month unconditionally, so a freshly seeded
 * install opened on all zeros and 該当なし. The month now arrives WITH the session
 * — the login and /me responses carry it — and AuthContext seeds it here before
 * any page mounts, so no screen ever paints on an empty month.
 *
 * `resolveDefaultMonth` remains only as a fallback for a session that somehow has
 * no seed. It is not the normal path, and on the normal path there is no request.
 *
 * The resolved month is held for the session, so moving between pages keeps the
 * month you were looking at instead of snapping back.
 */
let sessionMonth: string | null = null;
let inflight: Promise<string> | null = null;
/** True once the user moves the picker — their choice outranks any later seed. */
let userChose = false;

/** Reset between tests — module state would otherwise leak across cases. */
export function __resetMonthCache(): void {
  sessionMonth = null;
  inflight = null;
  userChose = false;
}

/**
 * Seed the month from the session payload. Called by AuthContext the moment login
 * or session-restore resolves, which is before any protected page renders — so
 * pages open on the right month directly, with no flash and no extra round trip.
 *
 * Never overrides a month the user picked themselves.
 */
export function seedDefaultMonth(month: string | undefined): void {
  if (!month || userChose) return;
  sessionMonth = month;
}

/** Drop the session's month on logout so the next user doesn't inherit it. */
export function clearMonthCache(): void {
  __resetMonthCache();
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
    // Normal path: AuthContext already seeded the month, so there is nothing to
    // fetch and nothing to correct.
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
    userChose = true;
    sessionMonth = m;
    setMonthState(m);
  }

  return [month, setMonth];
}
