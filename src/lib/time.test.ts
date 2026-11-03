import { describe, expect, it } from 'vitest';
import {
  ageOf, birthdayInRange, birthdaysBetween, bornDayFor, changeSeasonLength, dateOf, dayOf, finalChapterDay, formatDate,
  newCalendar, rescaleBornDay, stageTable, weekday,
} from './time';

const normal = stageTable({ preset: 'normal' });
const cal28 = newCalendar(28, 0);
const today = dayOf({ year: 3, season: 0, day: 4 }, cal28); // Year 3, Spring, Day 4

describe('calendar', () => {
  it('counts days the same way as v1', () => {
    expect(today).toBe(227);
    expect(formatDate(dateOf(227, cal28))).toBe('Year 3 · Spring · Day 4');
  });
  it('starts every season on a Sunday', () => {
    expect(weekday({ year: 1, season: 2, day: 1 })).toBe('Sunday');
    expect(weekday({ year: 1, season: 0, day: 4 })).toBe('Wednesday');
    expect(weekday({ year: 1, season: 0, day: 8 })).toBe('Sunday');
  });
  it('handles days before the save began', () => {
    expect(dateOf(-1, cal28)).toEqual({ year: 0, season: 3, day: 28 });
  });
  it('starts on the chosen season', () => {
    expect(dateOf(0, newCalendar(14, 2))).toEqual({ year: 1, season: 2, day: 1 });
    expect(dateOf(14, newCalendar(14, 2))).toEqual({ year: 1, season: 3, day: 1 });
  });
});

describe('life stages', () => {
  it('uses the game data, starts in the right places', () => {
    expect(normal.map((r) => r.days)).toEqual([1, 5, 7, 14, 21, 28, 42, 14]);
    expect(normal.map((r) => r.start)).toEqual([0, 1, 6, 13, 27, 48, 76, 118]);
  });
  it('rounds Short half days up', () => {
    expect(stageTable({ preset: 'short' }).map((r) => r.days)).toEqual([1, 3, 4, 7, 11, 14, 21, 7]);
  });
  it('custom: missing stages use Normal, at least 1 day', () => {
    const t = stageTable({ preset: 'custom', days: { teen: 10, child: 0 } });
    expect(t.find((r) => r.id === 'teen')!.days).toBe(10);
    expect(t.find((r) => r.id === 'child')!.days).toBe(1);
    expect(t.find((r) => r.id === 'adult')!.days).toBe(42);
  });
});

describe('a Sim already in the game (worked example)', () => {
  // Ava: Teen, "Birthday in 5 days".
  const born = bornDayFor({ stage: 'teen', fresh: false, birthdayIn: 5 }, today, normal);
  it('works out the day she was born', () => expect(born).toBe(184));
  it('shows her age like the game', () => {
    const a = ageOf(born, today, normal);
    expect(a).toMatchObject({ born: true, stage: 'teen', dayInStage: 17, stageDays: 21, birthdayIn: 5, nextStage: 'youngAdult', ageDays: 43 });
    if (a.born) expect(formatDate(dateOf(a.birthdayDay!, cal28), 'weekday')).toBe('Monday, Spring 9');
  });
  it('keeps the "Birthday in" box in range', () => {
    expect(birthdayInRange('teen', normal)).toEqual({ min: 1, max: 21 });
    expect(ageOf(bornDayFor({ stage: 'teen', fresh: false, birthdayIn: 99 }, today, normal), today, normal)).toMatchObject({ birthdayIn: 21 });
    expect(ageOf(bornDayFor({ stage: 'teen', fresh: false, birthdayIn: 0 }, today, normal), today, normal)).toMatchObject({ birthdayIn: 1 });
  });
  it('lists her future birthdays (age-ups only)', () => {
    const b = birthdaysBetween([{ id: 'ava', bornDay: born, addedDay: today }], today, today + 200, normal);
    expect(b.map((x) => [formatDate(dateOf(x.day, cal28), 'short'), x.toStage])).toEqual([
      ['Spring 9', 'youngAdult'], ['Summer 9', 'adult'], ['Fall 23', 'elder'],
    ]);
  });
});

describe('a Sim fresh from Create a Sim', () => {
  const born = bornDayFor({ stage: 'youngAdult', fresh: true }, today, normal);
  it('is on day 1 of their stage, birthday in the full stage length', () => {
    expect(ageOf(born, today, normal)).toMatchObject({ stage: 'youngAdult', dayInStage: 1, birthdayIn: 28 });
  });
  it('never "ages up today" (fixes the v1 bug)', () => {
    expect(birthdaysBetween([{ id: 'x', bornDay: born, addedDay: today }], today - 30, today + 27, normal)).toEqual([]);
    expect(birthdaysBetween([{ id: 'x', bornDay: born, addedDay: today }], today, today + 28, normal)).toHaveLength(1);
  });
});

describe('elders', () => {
  it('count days as an elder, no birthday', () => {
    const born = bornDayFor({ stage: 'elder', fresh: false, daysAsElder: 9 }, today, normal);
    const a = ageOf(born, today, normal);
    expect(a).toMatchObject({ stage: 'elder', daysAsElder: 9, barFull: false });
    expect(a.born && a.birthdayIn).toBeUndefined();
  });
  it('age bar fills after the elder minimum ("final chapter")', () => {
    const born = bornDayFor({ stage: 'elder', fresh: true }, today, normal);
    expect(ageOf(born, today + 13, normal)).toMatchObject({ barFull: false });
    expect(ageOf(born, today + 14, normal)).toMatchObject({ barFull: true, daysAsElder: 14 });
    expect(finalChapterDay(born, normal)).toBe(today + 14);
  });
  it('have no birthdays after becoming an elder', () => {
    const born = bornDayFor({ stage: 'elder', fresh: true }, today, normal);
    expect(birthdaysBetween([{ id: 'e', bornDay: born }], today, today + 500, normal)).toEqual([]);
  });
});

describe('changing settings', () => {
  const born = 184;
  it('season length: same age, today keeps its date', () => {
    const cal7 = changeSeasonLength(cal28, today, 7);
    expect(formatDate(dateOf(today, cal7))).toBe('Year 3 · Spring · Day 4');
    expect(ageOf(born, today, normal)).toMatchObject({ stage: 'teen', ageDays: 43, birthdayIn: 5 });
    // her birthday is still 5 days away; on 7-day seasons that's Summer 2
    expect(formatDate(dateOf(today + 5, cal7), 'short')).toBe('Summer 2');
  });
  it('season length: a day past the new length is capped', () => {
    const late = dayOf({ year: 3, season: 0, day: 20 }, cal28);
    expect(dateOf(late, changeSeasonLength(cal28, late, 14))).toEqual({ year: 3, season: 0, day: 14 });
  });
  it('lifespan: same stage, same share of the way through (like the game)', () => {
    const long = stageTable({ preset: 'long' });
    const nb = rescaleBornDay(born, today, normal, long);
    const a = ageOf(nb, today, long);
    expect(a).toMatchObject({ stage: 'teen', stageDays: 84, dayInStage: 65 }); // 16/21 of the way ≈ 64/84
    const back = ageOf(rescaleBornDay(nb, today, long, normal), today, normal);
    expect(back).toMatchObject({ stage: 'teen', dayInStage: 17 });
  });
  it('lifespan: never pushes a Sim into the next stage', () => {
    const lastDay = bornDayFor({ stage: 'teen', fresh: false, birthdayIn: 1 }, today, normal);
    const short = stageTable({ preset: 'short' });
    expect(ageOf(rescaleBornDay(lastDay, today, normal, short), today, short)).toMatchObject({ stage: 'teen' });
  });
});
