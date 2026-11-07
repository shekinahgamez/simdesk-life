import { describe, expect, it } from 'vitest';
import { DEFAULT_REAL_AGES, rangeText, stageForRealAge, realAgeShort, realAgeText, realAgeYears, sanitizeRanges } from './realAges';
import { ageOf, stageTable } from './time';

const table = stageTable({ preset: 'normal' });
const at = (stage: string, inStage: number) => {
  const row = table.find((r) => r.id === stage)!;
  return ageOf(0, row.start + inStage, table) as Extract<ReturnType<typeof ageOf>, { born: true }>;
};

describe('real-life ages', () => {
  it('start of a stage is the stage’s first age', () => {
    expect(realAgeYears(at('teen', 0), DEFAULT_REAL_AGES)).toBe(13);
    expect(realAgeYears(at('youngAdult', 0), DEFAULT_REAL_AGES)).toBe(18);
    expect(realAgeYears(at('elder', 0), DEFAULT_REAL_AGES)).toBe(60);
  });
  it('halfway through a stage is halfway through its ages', () => {
    const teen = table.find((r) => r.id === 'teen')!;
    const mid = at('teen', teen.days / 2);
    expect(realAgeText(realAgeYears(mid, DEFAULT_REAL_AGES))).toBe('15 years old');
    const adult = table.find((r) => r.id === 'adult')!;
    expect(realAgeText(realAgeYears(at('adult', adult.days / 2), DEFAULT_REAL_AGES))).toBe('45 years old');
  });
  it('babies read in weeks and months', () => {
    expect(realAgeText(0)).toBe('Under a week old');
    expect(realAgeText(0.1)).toBe('5 weeks old');
    expect(realAgeText(0.25)).toBe('3 months old');
    expect(realAgeText(0.75)).toBe('9 months old');
    expect(realAgeText(1)).toBe('1 year old');
  });
  it('an elder reaches 100 once the age bar is full and never passes it', () => {
    const elder = table.find((r) => r.id === 'elder')!;
    expect(realAgeYears(at('elder', elder.days), DEFAULT_REAL_AGES)).toBe(100);
    expect(realAgeYears(at('elder', elder.days * 5), DEFAULT_REAL_AGES)).toBe(100);
  });
  it('names each stage’s ages the way people say them', () => {
    expect(rangeText('newborn', DEFAULT_REAL_AGES)).toBe('0–3 months');
    expect(rangeText('infant', DEFAULT_REAL_AGES)).toBe('3–12 months');
    expect(rangeText('toddler', DEFAULT_REAL_AGES)).toBe('1–3 years');
    expect(rangeText('child', DEFAULT_REAL_AGES)).toBe('4–12 years');
    expect(rangeText('teen', DEFAULT_REAL_AGES)).toBe('13–17 years');
    expect(rangeText('youngAdult', DEFAULT_REAL_AGES)).toBe('18–29 years');
    expect(rangeText('adult', DEFAULT_REAL_AGES)).toBe('30–59 years');
    expect(rangeText('elder', DEFAULT_REAL_AGES)).toBe('60–100 years');
  });
  it('bad saved ranges fall back to the defaults', () => {
    expect(sanitizeRanges(undefined)).toEqual(DEFAULT_REAL_AGES);
    expect(sanitizeRanges({ starts: [0, 5, 4, 8, 9, 10, 11, 12], end: 100 })).toEqual(DEFAULT_REAL_AGES);
    expect(sanitizeRanges({ starts: [0, 0.25, 1, 4, 13, 18, 30, 65], end: 95 })).toEqual({ starts: [0, 0.25, 1, 4, 13, 18, 30, 65], end: 95 });
  });
  it('has a short form for cards', () => {
    expect(realAgeShort(30.9)).toBe('30');
    expect(realAgeShort(0.75)).toBe('9M');
    expect(realAgeShort(0.1)).toBe('5w');
    expect(realAgeShort(0)).toBe('<1w');
  });
});

describe('picking a real-life age', () => {
  const days = table.map((r) => r.days);
  it('every whole age round-trips to the same age (where the stage has enough days)', () => {
    const long = stageTable({ preset: 'custom', days: { newborn: 2, infant: 19, toddler: 84, child: 168, teen: 105, youngAdult: 462, adult: 420, elder: 525 } } as never);
    const at2 = (stage: string, inStage: number) => { const row = long.find((r) => r.id === stage)!; return ageOf(0, row.start + inStage, long) as Extract<ReturnType<typeof ageOf>, { born: true }>; };
    for (let y = 0; y < 100; y++) {
      const { stage, inStage } = stageForRealAge(y, DEFAULT_REAL_AGES, long.map((r) => r.days));
      expect(Math.floor(realAgeYears(at2(stage, inStage), DEFAULT_REAL_AGES) + 1e-9), `age ${y}`).toBe(y);
    }
  });
  it('on a short lifespan it gets within a year, before elder', () => {
    for (let y = 0; y < 60; y++) {
      const { stage, inStage } = stageForRealAge(y, DEFAULT_REAL_AGES, days);
      const back = Math.floor(realAgeYears(at(stage, inStage), DEFAULT_REAL_AGES) + 1e-9);
      expect(Math.abs(back - y), `age ${y}`).toBeLessThanOrEqual(1);
    }
  });
  it('lands in the right stage and never on the birthday itself', () => {
    expect(stageForRealAge(24, DEFAULT_REAL_AGES, days).stage).toBe('youngAdult');
    expect(stageForRealAge(13, DEFAULT_REAL_AGES, days).stage).toBe('teen');
    expect(stageForRealAge(70, DEFAULT_REAL_AGES, days).stage).toBe('elder');
    const ya = stageForRealAge(29, DEFAULT_REAL_AGES, days);
    expect(ya.inStage).toBeLessThan(table.find((r) => r.id === 'youngAdult')!.days);
  });
});
