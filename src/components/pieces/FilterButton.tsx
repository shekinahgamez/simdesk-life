import { useRef, useState, type ReactNode } from 'react';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { SearchBox } from '../ui';
import { RowPop } from '../../pages/sims/RowEdit';
import { useIsPhone } from '../../lib/useIsPhone';
import { normalize } from '../../lib/text';

/**
 * THE filter button. Every page's filters use this. Plain when nothing is picked,
 * tinted with a count ("Status · 2") when on. Opens a popover (desktop) or bottom sheet (phone).
 */
export function FilterButton({ label, count, title, width = 340, children }: {
  label: string; count: number; title?: string; width?: number; children(close: () => void): ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const phone = useIsPhone();
  return (
    <>
      <button ref={ref} type="button" className={`btn sm p-fb ${count ? 'on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}{count > 0 && ` · ${count}`}<CaretDown size={12} weight="bold" aria-hidden="true" />
      </button>
      {open && <RowPop anchor={ref.current} title={title ?? label} phone={phone} onClose={() => setOpen(false)} width={width}>{children(() => setOpen(false))}</RowPop>}
    </>
  );
}

export type CheckOption = { id: string; label: string; n?: number };

/** The list inside a filter popover: checkboxes, a count per row, search when the list can grow. */
export function CheckList({ options, value, onChange, search, icon, single }: {
  options: CheckOption[]; value: string[]; onChange(v: string[]): void; search?: boolean; icon?: ReactNode;
  /** Pick one (radio dots), used by Group by. */ single?: boolean;
}) {
  const [q, setQ] = useState('');
  const shown = options.filter((o) => !q.trim() || normalize(o.label).includes(normalize(q)));
  return (
    <div className="ph-pk">
      {search && <div className="ph-pk-search"><SearchBox value={q} onChange={setQ} placeholder={`Search ${options.length}`} /></div>}
      <div className="ph-pk-list">
        {shown.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} type="button" role={single ? 'radio' : 'checkbox'} aria-checked={on} aria-label={o.label} className="ph-pk-sim"
              onClick={() => onChange(single ? [o.id] : on ? value.filter((x) => x !== o.id) : [...value, o.id])}>
              <span className={`ph-cb ${on ? 'on' : ''}${single ? ' dot' : ''}`} aria-hidden="true" />{icon}<span className="ph-pk-t">{o.label}</span>{o.n != null && <span className="p-n">{o.n}</span>}
            </button>
          );
        })}
        {shown.length === 0 && <p className="muted ph-pk-none">{options.length ? `No match for “${q.trim()}”.` : 'Nothing to pick yet.'}</p>}
      </div>
    </div>
  );
}

/** The row every list page puts above its list: search, filter buttons, Clear, then the view switch on the right. */
export function FilterBar({ search, onSearch, searchLabel, active, onClear, right, children }: {
  search?: string; onSearch?(v: string): void; searchLabel?: string; active: boolean; onClear(): void; right?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="p-bar">
      {onSearch && (
        <div className="p-search"><MagnifyingGlass size={16} weight="bold" aria-hidden="true" />
          <input aria-label={searchLabel ?? 'Search'} placeholder={searchLabel ?? 'Search'} value={search ?? ''} onChange={(e) => onSearch(e.target.value)} />
        </div>
      )}
      {children}
      {active && <button type="button" className="p-clear" onClick={onClear}>Clear</button>}
      <span className="grow" />
      {right}
    </div>
  );
}
