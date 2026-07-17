/**
 * Transportation auto-calculation (requirements §3.2, v2plan §5.2).
 *
 * When a staff member logs attendance at a stadium, the system applies the
 * registered fare between their home nearest station and the stadium's nearest
 * station, as a ROUND TRIP (one-way fare × 2 → two expense lines). The reimbursed
 * amount is capped at the registered fare.
 */

import type { CostBucket } from '@asahi/shared';
import type { Db } from '../db/Db';
import { masterRepo } from '../repositories/masterRepo';
import { expenseRepo } from '../repositories/expenseRepo';

export interface RoundTrip {
  outboundFare: number;
  inboundFare: number;
  mode: string | null;
  outboundNote: string;
  inboundNote: string;
}

/**
 * Resolve the registered round-trip fare between two stations. Uses the reverse
 * route's own fare if registered, otherwise mirrors the outbound fare.
 * Returns null when no route is registered for the pair.
 */
export async function resolveRoundTrip(
  db: Db,
  homeStation: string,
  stadiumStation: string,
): Promise<RoundTrip | null> {
  const outbound = await masterRepo.findRouteFare(db, homeStation, stadiumStation);
  if (!outbound) return null;

  const inbound = await masterRepo.findRouteFare(db, stadiumStation, homeStation);

  return {
    outboundFare: outbound.one_way_fare,
    inboundFare: inbound?.one_way_fare ?? outbound.one_way_fare,
    mode: outbound.mode,
    outboundNote: `${homeStation} → ${stadiumStation}`,
    inboundNote: `${stadiumStation} → ${homeStation}`,
  };
}

/**
 * Regenerate the auto transport lines for one staff member on one date: clears
 * any existing auto lines, then inserts the outbound + return legs if a route is
 * registered. Returns whether transport was applied.
 */
export async function applyAutoTransport(
  db: Db,
  params: {
    staffId: number;
    date: string;
    bucket: CostBucket;
    homeStation: string | null;
    stadiumStation: string;
  },
): Promise<{ applied: boolean; totalYen: number }> {
  await expenseRepo.removeAutoTransport(db, params.staffId, params.date);

  if (!params.homeStation) return { applied: false, totalYen: 0 };

  const trip = await resolveRoundTrip(db, params.homeStation, params.stadiumStation);
  if (!trip) return { applied: false, totalYen: 0 };

  const mode = trip.mode ?? '';
  await expenseRepo.create(db, {
    staffId: params.staffId,
    expenseDate: params.date,
    category: 'transport',
    bucket: params.bucket,
    amountYen: trip.outboundFare,
    description: mode ? `${trip.outboundNote}（${mode}）` : trip.outboundNote,
    source: 'auto',
  });
  await expenseRepo.create(db, {
    staffId: params.staffId,
    expenseDate: params.date,
    category: 'transport',
    bucket: params.bucket,
    amountYen: trip.inboundFare,
    description: mode ? `${trip.inboundNote}（${mode}）` : trip.inboundNote,
    source: 'auto',
  });

  return { applied: true, totalYen: trip.outboundFare + trip.inboundFare };
}

/**
 * Enforce the fare cap for a MANUAL transport claim: it may not exceed the
 * registered fare for the route. Returns the registered cap if one exists.
 */
export async function assertWithinFareCap(
  db: Db,
  fromStation: string,
  toStation: string,
  amountYen: number,
): Promise<void> {
  const registered = await masterRepo.findRouteFare(db, fromStation, toStation);
  if (registered && amountYen > registered.one_way_fare) {
    throw Object.assign(
      new Error(
        `Claim ¥${amountYen} exceeds the registered fare ¥${registered.one_way_fare} for ${fromStation} → ${toStation}.`,
      ),
      { statusCode: 400 },
    );
  }
}
