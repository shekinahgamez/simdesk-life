import type { Icon } from '@phosphor-icons/react';

/** THE segmented control: layout views (List, Cards, Board), sort, and any 2 to 5 fixed choices. Icons only on phone. */
export function ViewSwitch<T extends string>({ value, options, onChange, label, size = 'md' }: {
  value: T; options: { v: T; label: string; icon?: Icon }[]; onChange(v: T): void; label: string; size?: 'md' | 'sm';
}) {
  return (
    <div className={`p-views ${size}`} role="group" aria-label={label}>
      {options.map(({ v, label: l, icon: I }) => (
        <button key={v} type="button" aria-label={l} title={l} aria-pressed={value === v} onClick={() => onChange(v)}>
          {I && <I size={16} weight="duotone" aria-hidden="true" />}<span className={I ? 'p-vl' : undefined}>{l}</span>
        </button>
      ))}
    </div>
  );
}
