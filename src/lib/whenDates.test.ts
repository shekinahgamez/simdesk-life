import { describe, expect, it } from 'vitest';
import { approxDay, dateOf, dayOf, newCalendar, yearText } from './time';
import { beatData } from './storylines';

const cal = newCalendar(21, 0);

describe('dates before the save began', () => {
  it('round-trips years of 0 and below', () => {
    for (const year of [0, -1, -3]) {
      const d = { year, season: 2 as const, day: 5 };
      expect(dateOf(dayOf(d, cal), cal)).toEqual(d);
    }
    expect(dayOf({ year: 0, season: 3, day: 21 }, cal)).toBe(-1);
  });
  it('puts a season or year stand-in inside it, in order', () => {
    const fall = approxDay('season', -2, 2, cal);
    const year = approxDay('year', -3, 0, cal);
    expect(dateOf(fall, cal)).toMatchObject({ year: -2, season: 2 });
    expect(dateOf(year, cal).year).toBe(-3);
    expect(year).toBeLessThan(fall);
    expect(fall).toBeLessThan(0);
  });
  it('reads precision, defaulting to an exact day', () => {
    expect(beatData({ id: 'x', data: { day: 4, precision: 'season' } } as never).precision).toBe('season');
    expect(beatData({ id: 'x', data: { day: 4, precision: 'nope' } } as never).precision).toBe('day');
  });
  it('writes a real minus sign', () => expect(yearText(-3)).toBe('−3'));
});
