import { describe, expect, it } from 'vitest';
import type { Rec } from './sync/types';
import { flatTabs, inkSvg, landingTab, moveOrders, nextOrder, parseBody, subtreeIds, tabCount, tabTree } from './docs';

const tab = (id: string, o: Record<string, unknown>, del = false): Rec => ({ id, kind: 'doctab', data: { doc: 'd1', parent: '', title: id, order: 0, ...o }, edited_at: '', deleted_at: del ? 'x' : null });
const recs = [
  tab('a', { order: 0 }), tab('b', { order: 1 }), tab('b1', { parent: 'b', order: 1 }), tab('b0', { parent: 'b', order: 0 }),
  tab('c', { order: 2 }), tab('z', { doc: 'other' }), tab('gone', { order: 9 }, true),
  tab('deep', { parent: 'b0', order: 5 }), tab('orphan', { parent: 'nope', order: 3 }),
];

describe('docs tabs', () => {
  const tree = tabTree(recs, 'd1');
  it('builds tabs with sub-tabs in order and skips trash and other docs', () => {
    expect(tree.map((t) => t.id)).toEqual(['a', 'b', 'c', 'orphan', 'deep']);
    expect(tree.find((t) => t.id === 'b')!.children.map((c) => c.id)).toEqual(['b0', 'b1']);
  });
  it('never goes deeper than two levels: a sub-tab of a sub-tab shows as a tab', () => {
    expect(tree.every((t) => t.children.every((c) => c.children.length === 0))).toBe(true);
    expect(tree.some((t) => t.id === 'deep')).toBe(true);
  });
  it('flattens in reading order and counts', () => {
    expect(flatTabs(tree).map((t) => t.id)).toEqual(['a', 'b', 'b0', 'b1', 'c', 'orphan', 'deep']);
    expect(tabCount(recs, 'd1')).toBe(7);
  });
  it('moves a tab or sub-tab one step, and stops at the ends', () => {
    expect([...moveOrders(tree, 'b', -1)!]).toEqual([['b', 0], ['a', 1], ['c', 2], ['orphan', 3], ['deep', 4]]);
    expect(moveOrders(tree, 'a', -1)).toBeNull();
    expect([...moveOrders(tree, 'b1', -1)!]).toEqual([['b1', 0], ['b0', 1]]);
    expect(moveOrders(tree, 'b1', 1)).toBeNull();
  });
  it('picks the next order and the trash set', () => {
    expect(nextOrder(tree, '')).toBe(6);
    expect(nextOrder(tree, 'b')).toBe(2);
    expect(subtreeIds(tree, 'b')).toEqual(['b', 'b0', 'b1']);
    expect(subtreeIds(tree, 'b1')).toEqual(['b1']);
  });
  it('lands on the last tab read, else the first', () => {
    expect(landingTab(tree, 'b1')).toBe('b1');
    expect(landingTab(tree, 'missing')).toBe('a');
    expect(landingTab([], null)).toBeNull();
  });
});

describe('docs text and icons', () => {
  it('parses headings, bullets and paragraphs', () => {
    expect(parseBody('# Plan\n\n- one\n- two\n\nText line\nmore\n## Next')).toEqual([
      { kind: 'h1', text: 'Plan' }, { kind: 'ul', items: ['one', 'two'] }, { kind: 'p', text: 'Text line\nmore' }, { kind: 'h2', text: 'Next' },
    ]);
  });
  it('recolors an icon', () => {
    expect(inkSvg('<path fill="#6B49C2"/><path stroke="#6B49C2"/>', '#2F62D6')).toBe('<path fill="#2F62D6"/><path stroke="#2F62D6"/>');
    expect(inkSvg('<path fill="#6B49C2"/>', '')).toBe('<path fill="#6B49C2"/>');
  });
});
