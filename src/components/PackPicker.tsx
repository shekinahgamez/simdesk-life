import { useMemo, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { useGameData, PACK_TYPE_LABEL, type Pack } from '../data/gameData';

const TINT: Record<string, string> = { expansion: '#FFE4DC', game: '#DDE9FF', stuff: '#FFF0D1', kit: '#ECE7FF', free: '#D8F3EE' };

export function PackPicker({ value, onChange }: { value: string[]; onChange(v: string[]): void }) {
  const packs = useGameData((s) => s.data?.packs ?? []);
  const groups = useMemo(() => {
    const g = new Map<string, Pack[]>();
    for (const p of packs) if (p.type !== 'base') g.set(p.type, [...(g.get(p.type) ?? []), p]);
    return [...g.entries()];
  }, [packs]);
  const [tab, setTab] = useState(groups[0]?.[0] ?? 'expansion');
  const set = new Set(value);
  const cur = groups.find(([k]) => k === tab)?.[1] ?? [];
  const allOn = cur.every((p) => set.has(p.id));
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg">
          {groups.map(([k]) => <button key={k} type="button" aria-pressed={k === tab} onClick={() => setTab(k)}>{PACK_TYPE_LABEL[k] ?? k}</button>)}
        </div>
        <button type="button" className="btn sm" onClick={() => { for (const p of cur) allOn ? set.delete(p.id) : set.add(p.id); onChange([...set]); }}>{allOn ? 'Clear all' : 'Select all'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, maxHeight: 360, overflow: 'auto' }}>
        {cur.map((p) => {
          const on = set.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => { on ? set.delete(p.id) : set.add(p.id); onChange([...set]); }}
              style={{ minHeight: 56, borderRadius: 14, border: `2px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: TINT[p.type] ?? '#EEE7E3', color: '#24191F', textAlign: 'left', padding: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}
            >
              {p.name}
              {on && <Check size={14} weight="bold" color="#B83C76" />}
            </button>
          );
        })}
      </div>
      <span className="tiny muted">{value.length} packs selected</span>
    </div>
  );
}
