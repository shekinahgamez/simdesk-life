import { describe, expect, it } from 'vitest';
import {
  beatData, beatRows, isDue, sortPlanned, castOf, cleanTags, filterStories, knowOf, knowsSummary, latestBeat, NO_FILTER, secretData, sortBeats, sortStories,
  storiesOfSim, storyMarkdown, storyRows, storylineData, tagChoices, type SecretData,
} from './storylines';
import type { Rec } from './sync/types';

const rec = (id: string, kind: string, data: Record<string, unknown>): Rec => ({ id, kind, data, edited_at: '', deleted_at: null });
const story = (id: string, data: Record<string, unknown>) => rec(id, 'storyline', data);
const beat = (id: string, data: Record<string, unknown>) => rec(id, 'beat', data);
const opts = { householdOf: (id: string) => (id === 'kai' || id === 'quentin' ? 'h1' : id === 'shanae' ? 'h2' : null), simName: (id: string) => id };

describe('storylines data', () => {
  it('cleans junk', () => {
    const s = storylineData(story('a', { name: 5, status: 'weird', cast: ['x', 'x', 3], tags: [' Drama ', 'drama', ''], questions: [{ text: ' Who? ', done: 1 }, { text: '' }] }));
    expect(s).toMatchObject({ name: '', status: 'brewing', cast: ['x'], tags: ['Drama'], questions: [{ text: 'Who?', done: true }] });
    expect(beatData(undefined)).toMatchObject({ text: '', sims: [], day: null, precision: 'day', video: false });
    expect(cleanTags(['a', 'A', ' b  c '])).toEqual(['a', 'b c']);
  });
  it('reads secrets safely', () => {
    const s = secretData(rec('s', 'secret', { title: 'T', knows: { a: 'knows', b: 'nonsense', c: 'guess' }, cast: ['d'] }));
    expect(s.knows).toEqual({ a: 'knows', c: 'guess' });
    expect(knowOf(s, 'zzz')).toBe('no');
  });
});

describe('storylines logic', () => {
  const stories = storyRows([
    story('s1', { name: 'Hookah bar night', status: 'hot', cast: ['kai', 'quentin'], pinned: true, tags: ['Drama'] }),
    story('s2', { name: 'Quentin likes Shanae', status: 'brewing', cast: ['quentin', 'shanae'] }),
    story('s3', { name: 'Move in', status: 'resolved', cast: ['kai'], tags: ['drama', 'Home'] }),
  ]);
  const beats = beatRows([
    beat('b1', { storyline: 's1', text: 'At the door', sims: ['corey'], day: 14, addedAt: '2026-11-07' }),
    beat('b2', { storyline: 's1', text: 'Unpacking', sims: [], day: 3, addedAt: '2026-11-06' }),
    beat('b3', { storyline: 's2', text: 'Staring', sims: [], day: 14, addedAt: '2026-11-07' }),
  ]);
  it('sorts beats newest first', () => {
    expect(sortBeats(beats).map((b) => b.id)).toEqual(['b1', 'b3', 'b2']);
    expect(latestBeat(beats, 's1')?.id).toBe('b1');
    expect(latestBeat(beats, 's3')).toBeNull();
  });
  it('casts include people from beats', () => {
    expect(castOf(stories[0].s, beats, 's1').sort()).toEqual(['corey', 'kai', 'quentin']);
  });
  it('filters by all chosen Sims, household, status, tag and search', () => {
    expect(filterStories(stories, beats, { ...NO_FILTER, sims: ['kai', 'quentin'] }, opts).map((r) => r.id)).toEqual(['s1']);
    expect(filterStories(stories, beats, { ...NO_FILTER, sims: ['quentin'] }, opts).map((r) => r.id)).toEqual(['s1', 's2']);
    expect(filterStories(stories, beats, { ...NO_FILTER, households: ['h2'] }, opts).map((r) => r.id)).toEqual(['s2']);
    expect(filterStories(stories, beats, { ...NO_FILTER, statuses: ['resolved'] }, opts).map((r) => r.id)).toEqual(['s3']);
    expect(filterStories(stories, beats, { ...NO_FILTER, tags: ['DRAMA'] }, opts).map((r) => r.id)).toEqual(['s1', 's3']);
    expect(filterStories(stories, beats, { ...NO_FILTER, q: 'staring' }, opts).map((r) => r.id)).toEqual(['s2']);
  });
  it('sorts pinned first, resolved last', () => {
    expect(sortStories(stories, beats).map((r) => r.id)).toEqual(['s1', 's2', 's3']);
  });
  it('counts tags once per storyline, ignoring capitals', () => {
    expect(tagChoices(stories)).toEqual([{ label: 'Drama', n: 2 }, { label: 'Home', n: 1 }]);
  });
  it('finds a Sim\'s storylines', () => {
    expect(storiesOfSim(stories, beats, 'corey').map((r) => r.id)).toEqual(['s1']);
  });
  it('summarizes who knows', () => {
    const s: SecretData = { title: 'x', storyline: null, out: false, cast: ['a', 'b', 'c'], knows: { a: 'knows', b: 'guess' } };
    expect(knowsSummary(s)).toBe('1 knows, 1 guesses');
    expect(knowsSummary({ ...s, out: true })).toBe('Out in the open');
    expect(knowsSummary({ ...s, cast: [], knows: {} })).toBe('No one added yet');
    expect(knowsSummary({ ...s, cast: ['a'], knows: { a: 'knows' } })).toBe('Only one Sim knows');
  });
  it('writes a markdown note', () => {
    const md = storyMarkdown(stories[0], beats, [], { simName: (id) => id, dayText: (d) => (d == null ? '' : `Day ${d}`) });
    expect(md).toContain('# Hookah bar night');
    expect(md).toContain('Cast: [[kai]]');
    expect(md.indexOf('Unpacking')).toBeLessThan(md.indexOf('At the door'));
  });
});

describe('planned moments', () => {
  const rows = beatRows([
    beat('a', { storyline: 's', text: 'far', day: 300, planned: true }),
    beat('b', { storyline: 's', text: 'undated', planned: true }),
    beat('c', { storyline: 's', text: 'soon', day: 120, planned: true }),
    beat('d', { storyline: 's', text: 'due', day: 90, planned: true }),
    beat('e', { storyline: 's', text: 'old moment', day: 10 }),
  ]);
  it('old moments are not planned', () => expect(rows[4].b.planned).toBe(false));
  it('due means planned, dated and today has come', () => {
    expect(isDue(rows[3].b, 100)).toBe(true);
    expect(isDue(rows[2].b, 100)).toBe(false);
    expect(isDue(rows[1].b, 100)).toBe(false);
    expect(isDue(rows[4].b, 100)).toBe(false);
  });
  it('orders due, then soonest, then undated', () => {
    expect(sortPlanned(rows.filter((r) => r.b.planned), 100).map((r) => r.b.text)).toEqual(['due', 'soon', 'far', 'undated']);
  });
});
