/**
 * Money helpers. Every yen figure in the system flows through these so rounding
 * behaviour is defined in exactly one place.
 *
 * The client's sample was reproduced with half-up rounding on the PER-DAY wage
 * (verified: 5h40m → 340min × ¥1,300 / 60 = 7,366.67 → ¥7,367), then summed.
 */

/** Half-up rounding to whole yen (matches the client's spreadsheet). */
export function roundYen(value: number): number {
  return Math.round(value);
}

/** Wage for a span of minutes at an hourly rate, rounded to whole yen. */
export function wageForMinutes(minutes: number, hourlyYen: number): number {
  return roundYen((minutes * hourlyYen) / 60);
}
