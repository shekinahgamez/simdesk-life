import { describe, expect, it } from 'vitest';
import { photoNames, zip } from './photoZip';
import { spreadsheetTables } from './spreadsheet';
import type { Rec } from './types';

const rec = (id: string, kind: string, data: Record<string, unknown>): Rec => ({ id, kind, data, edited_at: '', deleted_at: null } as unknown as Rec);
const ref = (id: string) => ({ id, w: 10, h: 10 });
const save = { name: 'S', today: 5, trackDate: true, calendar: { seasonLength: 7, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' } };

describe('photo names', () => {
  it('names portraits after the Sim, captions for photos, numbers the rest, and de-duplicates', () => {
    const recs = [
      rec('a', 'sim', { first: 'Cori', last: 'Fletcher', portrait: ref('p1') }),
      rec('b', 'sim', { first: 'Cori', last: 'Fletcher', portrait: ref('p2') }),
      rec('c', 'photo', { photo: ref('p3'), caption: 'Beach day', simIds: [] }),
      rec('d', 'photo', { photo: ref('p4'), caption: '', simIds: [] }),
      rec('e', 'photo', { photo: ref('p5'), caption: 'a/b:c', simIds: [] }),
    ];
    const n = photoNames({}, recs);
    expect(n.get('p1')).toBe('Cori Fletcher - portrait');
    expect(n.get('p2')).toBe('Cori Fletcher - portrait (2)');
    expect(n.get('p3')).toBe('Beach day');
    expect(n.get('p4')).toBe('Photo 1');
    expect(n.get('p5')).toBe('abc');
  });
});

describe('zip', () => {
  it('writes a readable store-only archive', () => {
    const z = zip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: 'b.txt', data: new TextEncoder().encode('world!') }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
    expect(new TextDecoder().decode(z)).toContain('helloworld'.slice(0, 5));
  });
});

describe('spreadsheet tables', () => {
  it('turns ids into words and leaves out empty tabs', () => {
    const recs = [
      rec('h1', 'household', { name: 'Coriana' }),
      rec('s1', 'sim', { first: 'Cori', last: 'Fletcher', householdId: 'h1', bornDay: -10, traits: [] }),
      rec('s2', 'sim', { first: 'Kiana', last: 'Carter', householdId: null, traits: [] }),
      rec('r1', 'rel', { a: 's1', b: 's2', type: 'friend', labelA: '', labelB: '', secret: true }),
    ];
    const t = spreadsheetTables(save, recs, []);
    expect(Object.keys(t)).toEqual(['Sims', 'Households', 'Relationships']);
    expect(t.Sims.map((r) => r.Name)).toEqual(['Cori Fletcher', 'Kiana Carter']);
    expect(t.Sims[0].Household).toBe('Coriana');
    expect(t.Households[0].Members).toBe('Cori Fletcher');
    expect(t.Relationships[0]).toMatchObject({ Sim: 'Cori Fletcher', 'Other Sim': 'Kiana Carter', Secret: 'Yes' });
  });
});
