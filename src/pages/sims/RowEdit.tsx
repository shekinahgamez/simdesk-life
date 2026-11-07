import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, MagnifyingGlass } from '@phosphor-icons/react';
import { Sheet, type Option } from '../../components/ui';
import { useLayer } from '../../lib/layers';

/**
 * A small pop-up for changing one thing. On desktop it opens right under what you tapped;
 * on a phone it's a bottom sheet. Tap outside or press Escape to close.
 */
export function RowPop({ anchor, title, phone, onClose, children, width = 320 }: {
  anchor: HTMLElement | null; title: string; phone: boolean; onClose(): void; children: ReactNode; width?: number;
}) {
  if (phone) return <Sheet title={title} onClose={onClose}>{children}</Sheet>;
  return <DeskPop anchor={anchor} title={title} onClose={onClose} width={width}>{children}</DeskPop>;
}

function DeskPop({ anchor, title, onClose, children, width }: { anchor: HTMLElement | null; title: string; onClose(): void; children: ReactNode; width: number }) {
  useLayer(onClose);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor?.getBoundingClientRect();
      if (!r) { setPos({ left: (window.innerWidth - width) / 2, top: 120, maxH: window.innerHeight - 160 }); return; }
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      const below = window.innerHeight - r.bottom - 16;
      const above = r.top - 16;
      // Opens under the row when there's room, otherwise just above it.
      if (below >= 240 || below >= above) setPos({ left, top: r.bottom + 6, maxH: below });
      else setPos({ left, bottom: window.innerHeight - r.top + 6, maxH: above });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, width]);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      // A dropdown list from a field inside the pop-up lives in its own layer; don't close for it.
      if ((t as HTMLElement).closest?.('.combo-list, [role="listbox"]')) return;
      onClose();
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [anchor, onClose]);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('input, select, button[aria-pressed="true"], button')?.focus(); }, [pos === null]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="row-pop" role="dialog" aria-label={title} ref={ref}
      style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom, width, maxHeight: pos.maxH } : { visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}

/** A searchable list where one tap picks. Used for occult, aspiration, pronouns and so on. */
export function ChoiceList({ options, value, onPick, none, search = true, addLabel, onAdd }: {
  options: Option[]; value: string | null | undefined; onPick(id: string | null): void;
  /** An extra first row that clears the field, like "--" or "Human". */
  none?: string;
  search?: boolean;
  /** When set, typing something not in the list offers it as a new answer. */
  addLabel?: (typed: string) => string;
  onAdd?: (typed: string) => string;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = options.filter((o) => !needle || o.label.toLowerCase().includes(needle) || (o.group ?? '').toLowerCase().includes(needle));
  const groups: { name: string; opts: Option[] }[] = [];
  for (const o of shown) {
    const g = o.group ?? '';
    const last = groups[groups.length - 1];
    if (last && last.name === g) last.opts.push(o); else groups.push({ name: g, opts: [o] });
  }
  const exact = options.some((o) => o.label.toLowerCase() === needle);
  const row = (id: string | null, label: string) => (
    <button key={id ?? '-none'} type="button" role="option" aria-selected={value === id} className="choice" onClick={() => onPick(id)}>
      <span className="grow">{label}</span>{value === id && <Check size={16} weight="bold" aria-hidden="true" />}
    </button>
  );
  return (
    <div className="choice-list">
      {search && (
        <label className="choice-search">
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (shown[0]) onPick(shown[0].id); } }} />
        </label>
      )}
      <div className="choice-scroll" role="listbox">
        {none && !needle && row(null, none)}
        {groups.map((g) => (
          <div key={g.name || '-'}>
            {g.name && <div className="choice-group">{g.name}</div>}
            {g.opts.map((o) => row(o.id, o.label))}
          </div>
        ))}
        {needle && !exact && onAdd && (
          <button type="button" className="choice add" onClick={() => onPick(onAdd(q.trim()))}>{addLabel ? addLabel(q.trim()) : `Add “${q.trim()}”`}</button>
        )}
        {shown.length === 0 && !(needle && onAdd) && <div className="muted small" style={{ padding: '8px 10px' }}>Nothing matches “{q.trim()}”.</div>}
      </div>
    </div>
  );
}
