import { describe, expect, it } from 'vitest';
import {
  addDays,
  ageInfo,
  ageUpsBetween,
  birthdayFromStage,
  birthdaysBetween,
  fromIndex,
  stageDays,
  toIndex,
  weekdayOf,
} from './time';
import type { LifespanRules, SimDate } from './types';

const normal: LifespanRules = { preset: 'normal' };

describe('dates', () => {
  it('round-trips indexes for every season length, including before year 1', () => {
    for (const len of [7, 14, 21, 28] as const) {
      for (let i = -300; i < 300; i += 7) {
        expect(toIndex(fromIndex(i, len), len)).toBe(i);
      }
    }
  });
  it('rolls seasons and years over', () => {
    expect(addDays({ year: 1, season: 3, day: 14 }, 1, 14)).toEqual({ year: 2, season: 0, day: 1 });
    expect(addDays({ year: 1, season: 0, day: 1 }, -1, 7)).toEqual({ year: 0, season: 3, day: 7 });
  });
  it('clamps days when the season gets shorter, without losing the stored day', () => {
    const d: SimDate = { year: 2, season: 1, day: 20 };
    expect(fromIndex(toIndex(d, 7), 7)).toEqual({ year: 2, season: 1, day: 7 });
    expect(d.day).toBe(20);
  });
  it('starts every season on Sunday', () => {
    expect(weekdayOf({ year: 1, season: 2, day: 1 }, 28)).toBe(0);
    expect(weekdayOf({ year: 1, season: 2, day: 9 }, 28)).toBe(1);
  });
});

describe('lifespans', () => {
  it('short is about half of normal, long is four times', () => {
    const n = stageDays(normal);
    const l = stageDays({ preset: 'long' });
    expect(l.youngAdult).toBe(n.youngAdult * 4);
    expect(stageDays({ preset: 'short' }).youngAdult).toBe(n.youngAdult / 2);
  });
  it('uses custom days and falls back to normal for missing ones', () => {
    const d = stageDays({ preset: 'custom', custom: { teen: 40 } });
    expect(d.teen).toBe(40);
    expect(d.child).toBe(stageDays(normal).child);
  });
});

describe('ages', () => {
  const today: SimDate = { year: 3, season: 0, day: 4 };
  it('works a birthday backwards and back again', () => {
    const b = birthdayFromStage('youngAdult', 3, today, 28, normal);
    const info = ageInfo(b, today, 28, normal);
    expect(info.stage).toBe('youngAdult');
    expect(info.agesUpIn).toBe(3);
    expect(info.nextStage).toBe('adult');
    expect(info.agesUpOn).toEqual({ year: 3, season: 0, day: 7 });
  });
  it('a newborn born today is day 1 of newborn', () => {
    const info = ageInfo(today, today, 28, normal);
    expect(info.stage).toBe('newborn');
    expect(info.dayInStage).toBe(1);
  });
  it('elders past the minimum can pass any day', () => {
    const b = addDays(today, -500, 28);
    const info = ageInfo(b, today, 28, normal);
    expect(info.stage).toBe('elder');
    expect(info.agesUpIn).toBeNull();
    expect(info.oldAgeAnyDay).toBe(true);
  });
  it('changing rules recalculates from the birthday', () => {
    const b = birthdayFromStage('child', 1, today, 28, normal);
    expect(ageInfo(b, today, 28, normal).stage).toBe('child');
    expect(ageInfo(b, today, 28, { preset: 'long' }).stage).toBe('infant');
  });
  it('finds age-ups and birthdays in a jump', () => {
    const b = birthdayFromStage('teen', 2, today, 7, normal);
    const ups = ageUpsBetween(b, addDays(today, 1, 7), addDays(today, 6, 7), 7, normal);
    expect(ups).toHaveLength(1);
    expect(ups[0].stage).toBe('youngAdult');
    const bd = birthdaysBetween({ year: 1, season: 1, day: 3 }, { year: 1, season: 0, day: 1 }, { year: 4, season: 0, day: 1 }, 7);
    expect(bd.map((d) => d.year)).toEqual([2, 3]);
  });
});
