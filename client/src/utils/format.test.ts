import { describe, expect, it } from 'vitest';
import { clock, parseTime, timeOfDay, yen } from './format';

describe('format helpers', () => {
  it('formats yen with separators', () => {
    expect(yen(131300)).toBe('¥131,300');
    expect(yen(188)).toBe('¥188');
    expect(yen(0)).toBe('¥0');
  });

  it('formats worked-time as H:MM', () => {
    expect(clock(470)).toBe('7:50');
    expect(clock(101 * 60)).toBe('101:00');
  });

  it('formats time-of-day as HH:MM', () => {
    expect(timeOfDay(600)).toBe('10:00');
    expect(timeOfDay(1140)).toBe('19:00');
  });

  it('parses HH:MM to minutes', () => {
    expect(parseTime('10:10')).toBe(610);
    expect(parseTime('bad')).toBeNull();
  });
});
