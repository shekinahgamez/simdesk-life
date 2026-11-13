import { useEffect, useRef, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';

export type MenuItem = { label: string; run(): void; danger?: boolean };

/** THE ⋯ menu. Rare and risky actions (Rename, Duplicate, Delete) live here, with Delete last and red. */
export function MoreMenu({ items, label = 'More', small }: { items: MenuItem[]; label?: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="lot-menu" ref={ref}>
      <button type="button" className={`btn icon${small ? ' ghost sm' : ''}`} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <DotsThree size={small ? 18 : 20} weight="bold" />
      </button>
      {open && (
        <div className="combo-list more-menu" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.run(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
