import { describe, expect, it } from 'vitest';
import { available, COMMANDS, matchWord, opensBar, parseDays, parseMove, plainCommand, rank, score, splitName, splitSlash } from './commands';

const all = { rotation: true, turn: true, date: true, clubs: true };

describe('commands', () => {
  it('has 17 one-word commands', () => {
    expect(COMMANDS).toHaveLength(17);
    expect(COMMANDS.every((c) => /^[a-z]+$/.test(c.word))).toBe(true);
    expect(new Set(COMMANDS.map((c) => c.word)).size).toBe(17);
    expect(COMMANDS.find((c) => c.id === 'household')!.word).toBe('household');
  });
  it('hides commands the save cannot use', () => {
    const ids = available({ rotation: false, turn: false, date: false, clubs: false }).map((c) => c.id);
    expect(ids).not.toContain('play');
    expect(ids).not.toContain('end');
    expect(ids).not.toContain('next');
    expect(ids).not.toContain('club');
    expect(ids).toContain('sim');
    expect(ids).toContain('help');
    expect(available(all)).toHaveLength(17);
  });
  it('matches the word by its start, exact first', () => {
    expect(matchWord('pl').map((c) => c.id)).toEqual(['play']);
    expect(matchWord('hou').map((c) => c.id)).toEqual(['household']);
    expect(matchWord('').length).toBe(17);
    expect(matchWord('zz')).toEqual([]);
  });
  it('splits slash text', () => {
    expect(splitSlash('/pl')).toEqual({ word: 'pl', rest: '', spaced: false });
    expect(splitSlash('/play cor')).toEqual({ word: 'play', rest: 'cor', spaced: true });
    expect(splitSlash('/play ')).toEqual({ word: 'play', rest: '', spaced: true });
    expect(splitSlash('cor')).toBeNull();
  });
  it('reads plain-word commands', () => {
    const list = available(all);
    expect(plainCommand('play cor', list)).toMatchObject({ cmd: { id: 'play' }, rest: 'cor' });
    expect(plainCommand('new sim Maya Brooks', list)).toMatchObject({ cmd: { id: 'sim' }, rest: 'Maya Brooks' });
    expect(plainCommand('next day', list)).toMatchObject({ cmd: { id: 'next' }, rest: '' });
    expect(plainCommand('next door', list)).toBeNull();
    expect(plainCommand('coriana', list)).toBeNull();
  });
  it('parses days, moves and names', () => {
    expect(parseDays('3')).toBe(3);
    expect(parseDays('3 days')).toBe(3);
    expect(parseDays('0')).toBeNull();
    expect(parseDays('soon')).toBeNull();
    expect(parseMove('Kai to Coriana')).toEqual({ sim: 'Kai', household: 'Coriana', toTyped: true });
    expect(parseMove('Kai Osborne to ')).toEqual({ sim: 'Kai Osborne', household: '', toTyped: true });
    expect(parseMove('Kai')).toEqual({ sim: 'Kai', household: '', toTyped: false });
    expect(parseMove('Tori')).toEqual({ sim: 'Tori', household: '', toTyped: false });
    expect(splitName('Maya Brooks')).toEqual({ first: 'Maya', last: 'Brooks' });
    expect(splitName('Cher')).toEqual({ first: 'Cher', last: '' });
    expect(splitName('Mary Ann Lee')).toEqual({ first: 'Mary Ann', last: 'Lee' });
  });
  it('ranks names: start beats word start beats inside', () => {
    expect(score('Coriana', 'cor')).toBeGreaterThan(score('Cori Fletcher', 'fle'));
    expect(score('Bree’s Spot', 'spot')).toBe(2);
    expect(score('Osborne', 'xyz')).toBe(0);
    expect(rank(['Priestley', 'Coriana', 'Corbin'], 'cor', (x) => x)).toEqual(['Corbin', 'Coriana']);
    expect(rank(['Ánh Nguyen'], 'anh', (x) => x)).toEqual(['Ánh Nguyen']);
    expect(rank(['Osborne', 'Priestley', 'Adebayo'], '', (x) => x)).toEqual(['Osborne', 'Priestley', 'Adebayo']);
  });
  it('opens on Ctrl K anywhere and / only outside a box', () => {
    const k = (key: string, o: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, ...o });
    expect(opensBar(k('k', { ctrlKey: true }), true)).toBe('open');
    expect(opensBar(k('K', { metaKey: true }), false)).toBe('open');
    expect(opensBar(k('/'), false)).toBe('slash');
    expect(opensBar(k('/'), true)).toBeNull();
    expect(opensBar(k('k'), false)).toBeNull();
  });
});
