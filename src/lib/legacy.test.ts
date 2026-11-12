import { describe, expect, it } from 'vitest';
import { currentGen, finished, foldLabel, genData, listItems, parseGenList, progress, genRows, BLANK_LEGACY, type GenRow } from './legacy';

const gen = (n: number, done: boolean, extra: Record<string, unknown> = {}): GenRow => ({
  id: `g${n}`, g: genData({ id: `g${n}`, kind: 'generation', edited_at: '', deleted_at: null, data: { legacy: 'L', n, goals: [{ text: 'a', done }, { text: 'b', done, optional: true }], ...extra } }),
});

describe('legacy', () => {
  it('parses a pasted list', () => {
    expect(parseGenList('Pearl · White\n\n2. Ruby · Red\n- Jade · Green\nGen 4: Onyx')).toEqual(['Pearl · White', 'Ruby · Red', 'Jade · Green', 'Onyx']);
  });
  it('keeps names that start with a number word', () => {
    expect(parseGenList('7 Wonders')).toEqual(['7 Wonders']);
  });
  it('counts goals and optional goals never block finishing', () => {
    const g = genData({ id: 'x', kind: 'generation', edited_at: '', deleted_at: null, data: { goals: [{ text: 'a', done: true }, { text: 'b', done: false, optional: true }] } });
    expect(progress(g)).toEqual({ done: 1, total: 2 });
    expect(finished(g)).toBe(true);
    expect(finished(genData(undefined))).toBe(false);
  });
  it('current generation: picked, else first with goals left, else last', () => {
    const gens = [gen(1, true), gen(2, true), gen(3, false)];
    expect(currentGen(BLANK_LEGACY, gens)?.id).toBe('g3');
    expect(currentGen({ ...BLANK_LEGACY, current: 'g1' }, gens)?.id).toBe('g1');
    expect(currentGen(BLANK_LEGACY, [gen(1, true), gen(2, true)])?.id).toBe('g2');
    expect(currentGen(BLANK_LEGACY, [])).toBeNull();
  });
  it('folds finished generations only after more than 5', () => {
    const five = [1, 2, 3, 4, 5].map((n) => gen(n, true)).concat(gen(6, false));
    expect(listItems(five, five[5]).every((i) => i.kind === 'gen')).toBe(true);
    const six = [1, 2, 3, 4, 5, 6].map((n) => gen(n, true)).concat(gen(7, false), gen(8, false));
    const items = listItems(six, six[6]);
    expect(items[0].kind).toBe('fold');
    expect(items).toHaveLength(2);
    expect(foldLabel(six.slice(0, 6))).toBe('Gen 1 to 6 · done');
    expect(foldLabel([gen(1, true), gen(3, true)])).toBe('2 generations · done');
  });
  it('sorts generations by number', () => {
    expect(genRows([{ id: 'b', kind: 'generation', edited_at: '', deleted_at: null, data: { n: 2 } }, { id: 'a', kind: 'generation', edited_at: '', deleted_at: null, data: { n: 1 } }]).map((r) => r.id)).toEqual(['a', 'b']);
  });
});
