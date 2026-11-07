import { describe, expect, it } from 'vitest';
import { addHouseholds, cleanRotation, EMPTY_ROTATION, endTurn, playNext, playNow, removeHousehold, reorder, setLength, standing, turnDay, turnLength, turnSpan, upNext } from './rotation';

const base = () => addHouseholds(EMPTY_ROTATION, ['p', 'a', 'c', 'f'], 3, 10);

describe('rotation', () => {
  it('first household added starts playing today, round 1', () => {
    const r = base();
    expect(r.current).toBe('p');
    expect(r.startDay).toBe(10);
    expect(r.round).toBe(1);
    expect(upNext(r)).toEqual(['a', 'c', 'f']);
  });
  it('counts the day of the turn and its span', () => {
    const r = base();
    expect(turnDay(r, 11)).toBe(2);
    expect(turnSpan(r, 11)).toEqual({ from: 10, to: 11, days: 2 });
  });
  it('end turn passes to the next one and ticks the round when it loops', () => {
    let r = base();
    r = endTurn(r, 12); expect(r.current).toBe('a'); expect(r.startDay).toBe(12); expect(r.round).toBe(1);
    r = endTurn(r, 13); r = endTurn(r, 14);
    expect(r.current).toBe('f');
    r = endTurn(r, 15); expect(r.current).toBe('p'); expect(r.round).toBe(2);
  });
  it('play next and play now', () => {
    let r = playNext(base(), 'f');
    expect(upNext(r)).toEqual(['f', 'a', 'c']);
    r = playNow(base(), 'c', 20);
    expect(r.current).toBe('c'); expect(r.startDay).toBe(20);
    expect(upNext(r)).toEqual(['a', 'f', 'p']);
  });
  it('reorders the up-next list only', () => {
    const r = reorder(base(), ['c', 'f', 'a']);
    expect(r.order).toEqual(['p', 'c', 'f', 'a']);
    expect(reorder(base(), ['c'])).toEqual(base());
  });
  it('turn lengths', () => {
    let r = setLength(base(), 'a', 5);
    expect(turnLength(r, 'a')).toBe(5);
    r = setLength(r, 'a', 3);
    expect(r.lengths.a).toBeUndefined();
    expect(turnLength(addHouseholds(base(), ['z'], 7, 10), 'z')).toBe(7);
  });
  it('adding later joins the end of the line', () => {
    const r = addHouseholds(endTurn(base(), 11), ['z'], 3, 11);
    expect(r.current).toBe('a');
    expect(upNext(r)).toEqual(['c', 'f', 'p', 'z']);
  });
  it('removing the one playing starts the next today', () => {
    const r = removeHousehold(base(), 'p', 15);
    expect(r.current).toBe('a'); expect(r.startDay).toBe(15);
    expect(r.order).not.toContain('p');
    expect(r.roundStart).toBe('a');
    expect(removeHousehold(addHouseholds(EMPTY_ROTATION, ['x'], 3, 0), 'x', 1)).toEqual(EMPTY_ROTATION);
  });
  it('standing', () => {
    expect(standing(base(), 'p')).toEqual({ kind: 'now' });
    expect(standing(base(), 'c')).toEqual({ kind: 'next', place: 2 });
    expect(standing(base(), 'zz')).toBeNull();
  });
  it('cleans junk and deleted households', () => {
    const r = cleanRotation({ order: ['p', 'gone', 'a', 'a', 5], current: 'gone', lengths: { a: 4, p: -1 } }, (id) => id !== 'gone');
    expect(r.order).toEqual(['p', 'a']);
    expect(r.current).toBe('p');
    expect(r.lengths).toEqual({ a: 4 });
    expect(cleanRotation(undefined)).toEqual(EMPTY_ROTATION);
  });
});

describe('adding days to this turn', () => {
  it('lengthens only the turn being played and resets when the next turn starts', async () => {
    const m = await import('./rotation');
    let r = m.addHouseholds(m.EMPTY_ROTATION, ['a', 'b'], 3, 10);
    r = m.addDays(r, 2);
    expect(m.currentLength(r)).toBe(5);
    expect(m.turnLength(r, 'a')).toBe(3);
    r = m.endTurn(r, 15);
    expect(r.extra).toBe(0);
    expect(m.currentLength(r)).toBe(3);
    r = m.endTurn(r, 18);
    expect(r.current).toBe('a');
    expect(m.currentLength(r)).toBe(3);
  });
  it('playing someone else now clears the added days', async () => {
    const m = await import('./rotation');
    let r = m.addDays(m.addHouseholds(m.EMPTY_ROTATION, ['a', 'b', 'c'], 3, 1), 1);
    r = m.playNow(r, 'c', 2);
    expect(r.extra).toBe(0);
    expect(m.upNext(r)).toEqual(['b', 'a']);
  });
  it('cleans junk', () => {
    expect(cleanRotation({ order: ['a'], extra: -4 }).extra).toBe(0);
    expect(cleanRotation({ order: ['a'], extra: 2 }).extra).toBe(2);
  });
});

describe('pause', () => {
  it('keeps the household playing, then resume starts a fresh turn today', async () => {
    const m = await import('./rotation');
    let r = m.addDays(m.addHouseholds(m.EMPTY_ROTATION, ['a', 'b'], 3, 1), 2);
    r = m.pause(r);
    expect(r.paused).toBe(true);
    r = m.resume(r, 20);
    expect(r).toMatchObject({ paused: false, current: 'a', startDay: 20, extra: 0 });
    expect(m.endTurn(m.pause(r), 21).paused).toBe(false);
  });
});

