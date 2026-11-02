import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { Camera, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { useStore } from '../store/store';

// ---------- toast ----------
const useToastStore = create<{ msg: string | null; show(m: string): void }>((set) => {
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    msg: null,
    show(m) {
      set({ msg: m });
      clearTimeout(t);
      t = setTimeout(() => set({ msg: null }), 3600);
    },
  };
});
export const toast = (m: string) => useToastStore.getState().show(m);
export function Toaster() {
  const msg = useToastStore((s) => s.msg);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

// ---------- toggle ----------
export function Toggle({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button type="button" className="toggle" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function SwitchRow({ title, desc, on, onChange }: { title: string; desc?: ReactNode; on: boolean; onChange(v: boolean): void }) {
  return (
    <div className="switch-row">
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{title}</div>
        {desc && <div className="small muted" style={{ marginTop: 2 }}>{desc}</div>}
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  );
}

// ---------- segmented ----------
export function Seg<T extends string | number>({ value, options, onChange, label }: { value: NoInfer<T>; options: { v: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- modal ----------
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose(): void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.modal-close)');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="btn ghost icon sm modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} weight="bold" />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- field ----------
export function Field({ label, hint, children, full }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; full?: boolean }) {
  const id = useId();
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

// ---------- avatar ----------
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
export function Avatar({ name, src, size = 32 }: { name: string; src?: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }} title={name}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : initials(name)}
    </span>
  );
}

// ---------- empty ----------
export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// ---------- search ----------
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange(v: string): void; placeholder: string }) {
  return (
    <div className="search" style={{ minWidth: 200, flex: '1 1 240px', maxWidth: 360 }}>
      <MagnifyingGlass size={16} weight="bold" />
      <input className="input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

// ---------- picker (combobox) ----------
export interface PickOption {
  id: string;
  label: string;
  group?: string;
  hint?: string;
}

/** Search-as-you-type picker. Multi mode shows chosen items as removable tags. */
export function Picker({
  options,
  value,
  onChange,
  multi,
  placeholder = 'Search…',
  label,
  max,
  allowCreate,
  tagClass = '',
}: {
  options: PickOption[];
  value: string[];
  onChange(v: string[]): void;
  multi?: boolean;
  placeholder?: string;
  label: string;
  max?: number;
  allowCreate?: (text: string) => string | null; // returns new id or null
  tagClass?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool = options.filter((o) => !value.includes(o.id));
    const hits = s ? pool.filter((o) => o.label.toLowerCase().includes(s) || o.group?.toLowerCase().includes(s)) : pool;
    return hits.slice(0, 80);
  }, [q, options, value]);
  const full = max != null && value.length >= max;
  const canCreate = allowCreate && q.trim() && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());

  const choose = (id: string) => {
    onChange(multi ? [...value, id] : [id]);
    setQ('');
    setActive(0);
    if (!multi) setOpen(false);
  };
  const create = () => {
    const id = allowCreate?.(q.trim());
    if (id) choose(id);
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {multi && value.length > 0 && (
        <div className="tags">
          {value.map((id) => (
            <span key={id} className={`tag ${tagClass}`}>
              {byId.get(id)?.label ?? id}
              <button type="button" aria-label={`Remove ${byId.get(id)?.label ?? id}`} onClick={() => onChange(value.filter((v) => v !== id))}>
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}
      {!full && (
        <div className="combo">
          <input
            className="input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={label}
            placeholder={!multi && value[0] ? byId.get(value[0])?.label ?? placeholder : placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[active]) choose(results[active].id);
                else if (canCreate) create();
              } else if (e.key === 'Backspace' && !q && multi && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
          />
          {open && (results.length > 0 || canCreate) && (
            <div className="combo-list" id={listId} role="listbox">
              {results.map((o, i) => (
                <div key={o.id}>
                  {o.group && o.group !== results[i - 1]?.group && <div className="group">{o.group}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o.id)}
                  >
                    <span className="grow">{o.label}</span>
                    {o.hint && <span className="tiny muted">{o.hint}</span>}
                  </button>
                </div>
              ))}
              {canCreate && (
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={create}>
                  <Plus size={14} weight="bold" /> Add “{q.trim()}”
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {!multi && value[0] && (
        <div>
          <button type="button" className="btn ghost sm" onClick={() => onChange([])}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- photo picker ----------
export function PhotoPicker({
  value,
  onChange,
  label = 'Add photo',
  height = 160,
  width = '100%',
  round,
  maxSide,
}: {
  value?: string;
  onChange(url: string | undefined): void;
  label?: string;
  height?: number | string;
  width?: number | string;
  round?: boolean;
  maxSide?: number;
}) {
  const upload = useStore((s) => s.uploadImage);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      onChange(await upload(f, { maxSide }));
    } catch (e) {
      toast(`That photo didn’t upload: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ position: 'relative', width, flexShrink: 0 }}>
      <button
        type="button"
        className="photo-drop"
        style={{ height, width: '100%', borderRadius: round ? '50%' : undefined }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files[0]);
        }}
        aria-label={value ? 'Change photo' : label}
      >
        {value ? (
          <img src={value} alt="" />
        ) : (
          <span className="row" style={{ gap: 6 }}>
            <Camera size={18} weight="duotone" /> {busy ? 'Uploading…' : label}
          </span>
        )}
      </button>
      {value && (
        <button type="button" className="btn sm icon" style={{ position: 'absolute', top: 8, right: 8 }} aria-label="Remove photo" onClick={() => onChange(undefined)}>
          <X size={14} weight="bold" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  );
}

/** Small "add another photo" button used in photo strips. */
export function AddPhotoButton({ onAdd, label = 'Add photo', size = 88, maxSide }: { onAdd(url: string): void; label?: string; size?: number; maxSide?: number }) {
  const upload = useStore((s) => s.uploadImage);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="photo-drop" style={{ width: size, height: size, flexDirection: 'column', gap: 4 }} onClick={() => ref.current?.click()}>
        <Plus size={18} weight="bold" />
        <span className="tiny">{busy ? 'Uploading…' : label}</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          setBusy(true);
          try {
            for (const f of files) onAdd(await upload(f, { maxSide }));
          } catch (err) {
            toast(`That photo didn’t upload: ${err instanceof Error ? err.message : 'unknown error'}`);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

export function useDebounced<T>(value: T, ms = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
