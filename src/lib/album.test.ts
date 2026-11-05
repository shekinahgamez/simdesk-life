import { describe, expect, it } from 'vitest';
import { dayOf, newCalendar } from './time';
import { groupPhotos, addedText, photoDates, photoRows, sortPhotos, photosOfItem, photosOfSim, photosOfClub, filterPhotos, matchesText, rangeText, suggest, NO_ALBUM_FILTER, type Namer } from './album';

const cal = newCalendar(28, 0);
const rec = (id: string, data: Record<string, unknown>) => ({ id, kind: 'photo', data: { photo: { id: 'p' + id, w: 10, h: 10 }, ...data }, edited_at: '2026-01-01T00:00:00Z', deleted_at: null });
const NOW = new Date('2026-11-04T12:00:00Z');

describe('photo dates', () => {
  it('game date leads, added day is the quiet line', () => {
    const d = photoDates({ gameDay: 5, added: '2026-11-03T10:00:00Z' }, cal, NOW);
    expect(d.main).toMatch(/Spring/); expect(d.sub).toBe('Added Nov 3');
  });
  it('no game date: the added day leads alone', () => {
    expect(photoDates({ gameDay: null, added: '2026-11-03T10:00:00Z' }, cal, NOW)).toEqual({ main: 'Added Nov 3', sub: '' });
  });
  it('a save without dates never shows a game date', () => {
    expect(photoDates({ gameDay: 5, added: '2026-11-03T10:00:00Z' }, null, NOW)).toEqual({ main: 'Added Nov 3', sub: '' });
  });
  it('other years show the year', () => expect(addedText('2025-02-01T10:00:00Z', NOW)).toBe('Feb 1, 2025'));
});

describe('photo order and filters', () => {
  const rows = photoRows([
    rec('a', { gameDay: 3, added: '2026-11-01T00:00:00Z', simIds: ['s1'] }),
    rec('b', { gameDay: 9, added: '2026-10-01T00:00:00Z', simIds: ['s1', 's2'], item: { kind: 'event', id: 'e1' } }),
    rec('c', { gameDay: null, added: '2026-11-03T00:00:00Z' }),
    rec('d', { added: '2026-11-02T00:00:00Z' }),
  ]);
  it('game date first (latest first), then the rest by added day', () => expect(sortPhotos(rows, true).map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']));
  it('without dates, by added day', () => expect(sortPhotos(rows, false).map((r) => r.id)).toEqual(['c', 'd', 'a', 'b']));
  it('by Sim', () => expect(photosOfSim(rows, 's2', true).map((r) => r.id)).toEqual(['b']));
  it('by calendar item', () => expect(photosOfItem(rows, 'event', 'e1', true).map((r) => r.id)).toEqual(['b']));
  it('ignores records without a photo', () => expect(photoRows([{ ...rec('x', {}), data: {} }])).toEqual([]));
});

describe('grid sections', () => {
  const rows = sortPhotos(photoRows([
    rec('a', { gameDay: 3, added: '2026-11-01T12:00:00Z' }),
    rec('b', { gameDay: 5, added: '2026-10-01T12:00:00Z' }),
    rec('c', { gameDay: 40, added: '2026-10-02T12:00:00Z' }),
    rec('d', { added: '2026-11-03T12:00:00Z' }),
  ]), true);
  it('by game season, then by month added', () => {
    const g = groupPhotos(rows, cal);
    expect(g.map((x) => x.title)).toEqual(['Summer · Year 1', 'Spring · Year 1', 'No game date']);
    expect(g[1].rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
  it('sorting by date added groups by month', () => {
    expect(groupPhotos(sortPhotos(rows, false), cal, 'added').map((x) => x.title)).toEqual(['November 2026', 'October 2026']);
  });
  it('a save without dates groups by month only', () => {
    expect(groupPhotos(sortPhotos(rows, false), null).map((x) => x.title)).toEqual(['November 2026', 'October 2026']);
  });
});

describe('search and filters', () => {
  const n: Namer = {
    simName: (id) => ({ s1: 'Adaeze Okafor', s2: 'Tobi Okafor' } as Record<string, string>)[id] ?? 'Removed Sim',
    occasionName: (i) => (i.id === 'e1' ? 'Adaeze’s graduation party' : 'Housewarming'),
    clubName: (id) => (id === 'k1' ? 'Page Turners' : ''),
  };
  const rows = sortPhotos(photoRows([
    rec('a', { caption: 'Blowing out candles', gameDay: 3, added: '2026-11-01T00:00:00Z', simIds: ['s1'] }),
    rec('b', { caption: 'Cap and gown', gameDay: 9, added: '2026-10-01T00:00:00Z', simIds: ['s1', 's2'], item: { kind: 'event', id: 'e1' } }),
    rec('c', { caption: 'Pool party chaos', gameDay: null, added: '2026-11-03T00:00:00Z', simIds: ['s2'], item: { kind: 'event', id: 'e2' } }),
  ]), true);
  const ids = (f: Partial<typeof NO_ALBUM_FILTER>) => filterPhotos(rows, { ...NO_ALBUM_FILTER, ...f }, n).map((r) => r.id);
  it('text matches captions, Sims and occasions', () => {
    expect(ids({ q: 'candles' })).toEqual(['a']);
    expect(ids({ q: 'tobi' })).toEqual(['b', 'c']);
    expect(ids({ q: 'graduation' })).toEqual(['b']);
    expect(ids({ q: 'party' })).toEqual(['b', 'c']);
  });
  it('every word has to match, in any order, ignoring case and curly quotes', () => {
    expect(ids({ q: 'party ADAEZE' })).toEqual(['b']);
    expect(ids({ q: "adaeze's" })).toEqual(['b']);
    expect(matchesText(rows[0].p, '   ', n)).toBe(true);
  });
  it('several Sims means photos with all of them', () => expect(ids({ simIds: ['s1', 's2'] })).toEqual(['b']));
  it('by occasion', () => expect(ids({ occasion: 'event:e2' })).toEqual(['c']));
  it('by a range of game days, both ends counted, photos with no game date left out', () => {
    expect(ids({ from: 3, to: 9 })).toEqual(['b', 'a']);
    expect(ids({ from: 4, to: 9 })).toEqual(['b']);
    expect(ids({ from: 9, to: 9 })).toEqual(['b']);
    expect(ids({ from: 0, to: 100 })).toEqual(['b', 'a']);
    expect(ids({ from: 20, to: 30 })).toEqual([]);
    expect(ids({ from: 3, to: null })).toEqual(['b', 'a', 'c']);
  });
  it('by club, and a club name is searchable', () => {
    const withClub = sortPhotos(photoRows([
      rec('x', { caption: 'Chapter one', gameDay: 2, clubId: 'k1', added: '2026-11-01T00:00:00Z' }),
      rec('y', { caption: 'Solo', gameDay: 1, added: '2026-11-02T00:00:00Z' }),
    ]), true);
    const run = (f: Partial<typeof NO_ALBUM_FILTER>) => filterPhotos(withClub, { ...NO_ALBUM_FILTER, ...f }, n).map((r) => r.id);
    expect(run({ club: 'k1' })).toEqual(['x']);
    expect(run({ q: 'turners' })).toEqual(['x']);
    expect(suggest(withClub, 'turn', n).clubs).toEqual([{ id: 'k1', name: 'Page Turners', count: 1 }]);
    expect(photosOfClub(withClub, 'k1', true).map((r) => r.id)).toEqual(['x']);
  });
  it('range, Sim and text combine', () => expect(ids({ from: 0, to: 5, simIds: ['s1'], q: 'candles' })).toEqual(['a']));
  it('suggests Sims, occasions and captions as you type', () => {
    const s = suggest(rows, 'ada', n);
    expect(s.sims.map((x) => x.name)).toEqual(['Adaeze Okafor']);
    expect(s.sims[0].count).toBe(2);
    expect(s.occasions.map((x) => x.name)).toEqual(['Adaeze’s graduation party']);
    expect(suggest(rows, 'party', n).captions.map((x) => x.caption)).toEqual(['Pool party chaos']);
    expect(suggest(rows, '', n)).toEqual({ sims: [], occasions: [], clubs: [], captions: [] });
  });
});

describe('date range in words', () => {
  const d = (year: number, season: number, day: number) => dayOf({ year, season: season as 0, day }, cal);
  it('a few days', () => expect(rangeText(d(1, 0, 3), d(1, 0, 12), cal)).toBe('Spring 3 → Spring 12 · Year 1'));
  it('one day', () => expect(rangeText(d(1, 2, 5), d(1, 2, 5), cal)).toBe('Fall 5 · Year 1'));
  it('a whole season reads as the season', () => expect(rangeText(d(1, 0, 1), d(1, 0, 28), cal)).toBe('Spring · Year 1'));
  it('across seasons and years', () => {
    expect(rangeText(d(1, 2, 20), d(1, 3, 5), cal)).toBe('Fall 20 → Winter 5 · Year 1');
    expect(rangeText(d(1, 3, 20), d(2, 0, 5), cal)).toBe('Winter 20 · Year 1 → Spring 5 · Year 2');
  });
  it('nothing picked', () => expect(rangeText(null, null, cal)).toBe(''));
});
