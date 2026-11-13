import { Picker, type Option } from '../ui';

/**
 * THE dropdown. Every pick-one-from-a-list uses this (never a plain browser dropdown): tap to open a list with search,
 * tap a choice. `none` adds a first row (like "None yet") that sets the value to an empty string.
 */
export function Dropdown({ id, options, value, onChange, none, placeholder, ariaLabel }: {
  id?: string; ariaLabel?: string; options: Option[]; value: string; onChange(v: string): void; none?: string; placeholder?: string;
}) {
  const NONE = '__none__';
  const list = none ? [{ id: NONE, label: none }, ...options] : options;
  const cur = value === '' && none ? NONE : value;
  return (
    <Picker id={id} ariaLabel={ariaLabel} options={list} value={cur ? [cur] : []} placeholder={placeholder ?? 'Pick one'} clearable={false}
      onChange={(v) => { const n = v[0]; if (n === undefined) return; onChange(n === NONE ? '' : n); }} />
  );
}
