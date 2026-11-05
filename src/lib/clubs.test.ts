import { describe, expect, it } from 'vitest';
import { activitySuggestions, canJoinClub, cleanClub, clubCountOf, clubData, clubRows, clubsOfSim, withMembers, BLANK_CLUB, MAX_ACTIVITIES } from './clubs';

const rec = (id: string, data: Record<string, unknown>) => ({ id, kind: 'club', data, edited_at: '2026-01-01T00:00:00Z', deleted_at: null });

describe('club data', () => {
  it('fills in blanks and ignores junk', () => {
    const c = clubData(rec('a', { name: 'Page Turners', members: ['s1', 5], leader: 's9', place: { kind: 'oops', id: 'x' }, encouraged: [{ text: 'Read' }, { text: '  ' }, 7], requirements: [{ cat: 'nope', value: 'x' }, { cat: 'trait', value: 'Bookworm' }], perks: [{ kind: 'vibe', text: 'Focused' }, { kind: 'zzz', text: 'x' }] }));
    expect(c.members).toEqual(['s1']);
    expect(c.leader).toBeNull(); // not a member
    expect(c.place).toBeNull();
    expect(c.encouraged).toEqual([{ text: 'Read', club: null }]);
    expect(c.requirements).toEqual([{ cat: 'trait', value: 'Bookworm' }]);
    expect(c.perks).toEqual([{ kind: 'vibe', text: 'Focused' }]);
    expect(c.admission).toBe('open');
  });
  it('keeps a good place and a leader who is a member', () => {
    const c = clubData(rec('a', { members: ['s1', 's2'], leader: 's2', place: { kind: 'type', id: 'library' }, admission: 'invite' }));
    expect(c.leader).toBe('s2'); expect(c.place).toEqual({ kind: 'type', id: 'library' }); expect(c.admission).toBe('invite');
  });
  it('caps activities at five', () => {
    const c = clubData(rec('a', { encouraged: Array.from({ length: 8 }, (_, i) => ({ text: `A${i}` })) }));
    expect(c.encouraged).toHaveLength(MAX_ACTIVITIES);
  });
});

describe('membership', () => {
  const rows = clubRows([
    rec('c1', { name: 'Zed', members: ['s1', 's2'], leader: 's1' }),
    rec('c2', { name: 'Alpha', members: ['s1'], leader: 's1' }),
    rec('c3', { name: 'Mid', members: ['s1', 's3'], leader: 's3' }),
    rec('c4', { name: 'Four', members: ['s1'] }),
  ]);
  it('sorted by name', () => expect(rows.map((r) => r.club.name)).toEqual(['Alpha', 'Four', 'Mid', 'Zed']));
  it('clubs of a Sim, with who leads', () => {
    expect(clubsOfSim(rows, 's3').map((r) => [r.club.name, r.leads])).toEqual([['Mid', true]]);
    expect(clubsOfSim(rows, 's2').map((r) => [r.club.name, r.leads])).toEqual([['Zed', false]]);
  });
  it('counts clubs, not counting the one being edited', () => {
    expect(clubCountOf(rows, 's1')).toBe(4);
    expect(clubCountOf(rows, 's1', 'c1')).toBe(3);
  });
  it('babies and toddlers cannot join; unknown age can', () => {
    expect(canJoinClub('toddler')).toBe(false); expect(canJoinClub('infant')).toBe(false); expect(canJoinClub('newborn')).toBe(false);
    expect(canJoinClub('child')).toBe(true); expect(canJoinClub('elder')).toBe(true); expect(canJoinClub(null)).toBe(true);
  });
  it('removing the leader from the members promotes the first member', () => {
    const c = { ...BLANK_CLUB, members: ['a', 'b'], leader: 'a' };
    expect(withMembers(c, ['b', 'c']).leader).toBe('b');
    expect(withMembers(c, ['a', 'c']).leader).toBe('a');
    expect(withMembers(c, []).leader).toBeNull();
  });
});

describe('cleaning a club before it is saved', () => {
  it('trims, drops blanks, and clears aims at itself or at a deleted club', () => {
    const c = cleanClub({ ...BLANK_CLUB, name: '  Hi  ', encouraged: [{ text: ' Be Nice ', club: 'other' }, { text: '', club: null }, { text: 'Read', club: 'me' }], banned: [{ text: 'Fight', club: 'gone' }] }, 'me', new Set(['me', 'other']));
    expect(c.name).toBe('Hi');
    expect(c.encouraged).toEqual([{ text: 'Be Nice', club: 'other' }, { text: 'Read', club: null }]);
    expect(c.banned).toEqual([{ text: 'Fight', club: null }]);
  });
});

describe('activity suggestions', () => {
  const rows = clubRows([
    rec('c1', { name: 'Night Owls', encouraged: [{ text: 'Cook' }, { text: 'Sing' }], banned: [{ text: 'Fight' }] }),
    rec('c2', { name: 'Clean Sweep', encouraged: [{ text: 'Clean' }, { text: 'cook' }] }),
  ]);
  it('matches other clubs, skips duplicates, the exact word, and this club', () => {
    expect(activitySuggestions(rows, null, 'co')).toEqual([{ text: 'cook', from: 'Clean Sweep' }]);
    expect(activitySuggestions(rows, null, 'cook')).toEqual([]);
    expect(activitySuggestions(rows, 'c2', 'cl')).toEqual([]);
    expect(activitySuggestions(rows, null, '')).toEqual([]);
  });
});
