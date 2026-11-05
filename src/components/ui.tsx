import {
  useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { useLayer } from '../lib/layers';
import { isPhone } from '../lib/useIsPhone';
import { matches, normalize } from '../lib/text';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIRST_FIELD = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** Keeps Tab and Shift+Tab inside `el`. */
function trapTab(e: ReactKeyboardEvent, el: HTMLElement | null) {
  if (e.key !== 'Tab' || !el) return;
  const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Opens with focus on the first field (desktop only, so phones don't pop the keyboard up),
 * and hands focus back to whatever had it when it closes. Runs once: typing never moves focus.
 */
function useOpenFocus(ref: React.RefObject<HTMLElement | null>, focusFirstField: boolean) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (el) {
      const first = focusFirstField && !isPhone() ? el.querySelector<HTMLElement>(FIRST_FIELD) : null;
      (first ?? el).focus({ preventScroll: true });
    }
    return () => prev?.focus?.({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Closes only when the press both starts and ends on the dimmed backdrop. */
function useBackdrop(onTap: () => void) {
  const downOnScrim = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      downOnScrim.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent) => {
      if (downOnScrim.current && e.target === e.currentTarget) onTap();
      downOnScrim.current = false;
    },
  };
}

// ---------- pop-up ----------
export function Modal({
  title, onClose, dirty = false, onSaveDraft, children, footer, wide, className = '', autoFocus = true,
}: {
  title: ReactNode;
  /** Actually closes the pop-up. Called straight away when nothing changed, or after the player picks Discard. */
  onClose(): void;
  /** True when the form has changes that would be lost. Closing then asks first. */
  dirty?: boolean;
  /** Only pass this once drafts really save. The "Save draft" button shows only when it's set. */
  onSaveDraft?: () => void;
  children: ReactNode;
  /** Buttons at the bottom. Pass a function to get `close`, which asks first when there are changes (for Cancel). */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  wide?: boolean;
  /** "pinned" keeps the buttons at the bottom while the form scrolls. */
  className?: string;
  /** false: open without putting the cursor in the first field (for pop-ups that are mostly buttons). */
  autoFocus?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);
  const latest = useRef({ onClose, dirty });
  latest.current = { onClose, dirty };
  const requestClose = () => (latest.current.dirty ? setAsking(true) : latest.current.onClose());
  const { isTop } = useLayer(requestClose);
  useOpenFocus(ref, autoFocus);
  const backdrop = useBackdrop(requestClose);

  return createPortal(
    <div className="modal-scrim" {...backdrop}>
      <div
        className={`modal ${wide ? 'wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
        tabIndex={-1}
        onKeyDown={(e) => isTop() && trapTab(e, ref.current)}
      >
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="btn ghost icon sm" aria-label="Close" onClick={requestClose}>
            <X size={18} weight="bold" />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{typeof footer === 'function' ? footer(requestClose) : footer}</div>}
      </div>
      {asking && (
        <DiscardChanges
          onKeep={() => setAsking(false)}
          onSaveDraft={onSaveDraft && (() => { setAsking(false); onSaveDraft(); })}
          onDiscard={() => { setAsking(false); latest.current.onClose(); }}
        />
      )}
    </div>,
    document.body,
  );
}

/** The in-app "unsaved changes" message. Escape or tapping outside means Keep editing. */
function DiscardChanges({ onKeep, onSaveDraft, onDiscard }: { onKeep(): void; onSaveDraft?: () => void; onDiscard(): void }) {
  return (
    <Confirm title="Discard changes?" text="You have changes that haven’t been saved." onCancel={onKeep}
      actions={[
        { label: 'Keep editing', kind: 'primary', run: onKeep },
        ...(onSaveDraft ? [{ label: 'Save draft', run: onSaveDraft }] : []),
        { label: 'Discard', kind: 'danger' as const, run: onDiscard },
      ]} />
  );
}

export type ConfirmAction = { label: ReactNode; kind?: 'primary' | 'danger'; run(): void; disabled?: boolean };

/** A small in-app question (never the browser's pop-up). Escape or tapping outside = onCancel. First button gets focus. */
export function Confirm({ title, text, actions, onCancel, children, after }: {
  title: ReactNode; text?: ReactNode; actions: ConfirmAction[]; onCancel(): void; children?: ReactNode;
  /** A small line under the buttons (like "Stop asking"). */
  after?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  const { isTop } = useLayer(() => cancel.current());
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.confirm-actions button')?.focus({ preventScroll: true });
  }, []);
  const backdrop = useBackdrop(() => cancel.current());
  return createPortal(
    <div className="modal-scrim confirm-scrim" {...backdrop}>
      <div className="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby={id} ref={ref}
        onKeyDown={(e) => isTop() && trapTab(e, ref.current)}>
        <h2 id={id}>{title}</h2>
        {text && <p className="muted" style={{ margin: '8px 0 0' }}>{text}</p>}
        {children}
        <div className="confirm-actions">
          {actions.map((a, i) => (
            <button key={i} type="button" className={`btn ${a.kind ?? ''}`} disabled={a.disabled} onClick={a.run}>{a.label}</button>
          ))}
        </div>
        {after}
      </div>
    </div>,
    document.body,
  );
}

// ---------- bottom sheet (phone menus) ----------
export function Sheet({ title, onClose, children }: { title?: ReactNode; onClose(): void; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [closing, setClosing] = useState(false);
  const close = () => setClosing(true);
  const { isTop } = useLayer(close);
  useOpenFocus(ref, false);
  const backdrop = useBackdrop(close);

  // Swipe down to close. Works from anywhere on the sheet once its content is scrolled to the top.
  useEffect(() => {
    const el = ref.current!;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let dragging = false;
    const start = (y: number) => { startY = y; startT = Date.now(); dy = 0; dragging = el.scrollTop <= 0; };
    const move = (y: number, e?: Event) => {
      if (!dragging) return;
      dy = Math.max(0, y - startY);
      if (dy > 0 && e?.cancelable) e.preventDefault();
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      const fast = dy > 40 && dy / Math.max(1, Date.now() - startT) > 0.5;
      el.style.transition = '';
      if (dy > 110 || fast) setClosing(true);
      else el.style.transform = '';
    };
    const ts = (e: TouchEvent) => start(e.touches[0].clientY);
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, e);
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  return createPortal(
    <div className={`m-sheet-scrim ${closing ? 'out' : ''}`} {...backdrop}
      onAnimationEnd={(e) => closing && e.target === e.currentTarget && closeRef.current()}>
      <div className={`m-sheet ${closing ? 'out' : ''}`} role="dialog" aria-modal="true" aria-labelledby={title ? id : undefined}
        aria-label={title ? undefined : 'Menu'} ref={ref} tabIndex={-1} onKeyDown={(e) => isTop() && trapTab(e, ref.current)}>
        <div className="grab" aria-hidden="true" />
        {title && <h2 id={id} className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ---------- message at the bottom of the screen ----------
type ToastMsg = { id: number; text: string; action?: { label: string; run(): void } };
let toastState: ToastMsg | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastSubs = new Set<() => void>();
const emitToast = () => toastSubs.forEach((f) => f());

/** Shows one message. A new one replaces the old. With a button (like Undo) it stays 6 seconds, otherwise 3.6. */
export function toast(text: string, action?: ToastMsg['action']) {
  toastState = { id: Date.now(), text, action };
  emitToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastState = null; emitToast(); }, action ? 6000 : 3600);
}
function dismissToast() {
  clearTimeout(toastTimer);
  toastState = null;
  emitToast();
}
export function Toaster() {
  const msg = useSyncExternalStore((f) => (toastSubs.add(f), () => toastSubs.delete(f)), () => toastState);
  if (!msg) return null;
  return (
    <div className="toast" role="status" key={msg.id}>
      <span>{msg.text}</span>
      {msg.action && (
        <button type="button" className="toast-btn" onClick={() => { const run = msg.action!.run; dismissToast(); run(); }}>
          {msg.action.label}
        </button>
      )}
    </div>
  );
}

// ---------- fields ----------
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

/** Text box. `name` fields capitalize each word and never autocorrect. */
export function TextInput({ kind = 'text', ...rest }: { kind?: 'text' | 'name' } & React.InputHTMLAttributes<HTMLInputElement>) {
  const extra = kind === 'name' ? { autoCapitalize: 'words', autoCorrect: 'off', spellCheck: false, autoComplete: 'off' } : {};
  return <input className="input" {...extra} {...rest} />;
}

// ---------- search ----------
export function SearchBox({ value, onChange, placeholder, id }: { value: string; onChange(v: string): void; placeholder: string; id?: string }) {
  return (
    <div className="search">
      <MagnifyingGlass size={16} />
      <input id={id} className="input" type="search" value={value} placeholder={placeholder} aria-label={placeholder}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
export function NoMatches({ query }: { query: string }) {
  return <div className="no-matches">No matches for “{query.trim()}”.</div>;
}

// ---------- chooser (search as you type) ----------
export type Option = { id: string; label: string; group?: string };

export function Picker({
  id, options, value, onChange, multiple = false, placeholder, onAdd, addLabel, max,
}: {
  id?: string;
  options: Option[];
  value: string[];
  onChange(ids: string[]): void;
  /** One pick (Occult, Aspiration) or several (Traits). */
  multiple?: boolean;
  placeholder?: string;
  /** Lets the player add what they typed as a new option. Return the new option's id. */
  onAdd?: (label: string) => string;
  /** The words on the add row. Default: Add “what you typed”. */
  addLabel?: (typed: string) => string;
  max?: number;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const labelOf = (vid: string) => byId.get(vid)?.label ?? 'Removed item';

  const results = useMemo(
    () => options.filter((o) => !value.includes(o.id) && (matches(o.label, q) || (!!o.group && matches(o.group, q)))).slice(0, 80),
    [options, value, q],
  );
  const canAdd = !!onAdd && q.trim() !== '' && !options.some((o) => normalize(o.label) === normalize(q));
  const rows = results.length + (canAdd ? 1 : 0);
  const full = multiple && max !== undefined && value.length >= max;
  const single = !multiple ? value[0] : undefined;

  const pick = (oid: string) => {
    onChange(multiple ? [...value, oid] : [oid]);
    setQ('');
    setHi(0);
    if (!multiple) { setOpen(false); setEditing(false); }
  };
  const add = () => onAdd && pick(onAdd(q.trim()));

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && rows > 0) { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, rows - 1)); }
    else if (e.key === 'ArrowUp' && rows > 0) { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && open && rows > 0) {
      e.preventDefault();
      if (hi < results.length) pick(results[hi].id);
      else add();
    } else if (e.key === 'Escape' && (open || editing)) {
      // Close just the list, not the pop-up around it.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      setEditing(false);
      setQ('');
    } else if (e.key === 'Backspace' && multiple && q === '' && value.length) onChange(value.slice(0, -1));
  };

  // Single pick: the choice sits inside the field itself, so it never pushes the field out of line.
  if (!multiple && single && !editing) {
    return (
      <div className="picker-chosen input">
        <button type="button" id={inputId} className="picker-chosen-label" onClick={() => {
          setEditing(true); setOpen(true); setTimeout(() => inputRef.current?.focus(), 0);
        }}>
          <span className={byId.has(single) ? '' : 'muted'}>{labelOf(single)}</span>
        </button>
        <button type="button" className="picker-clear" aria-label={`Clear ${labelOf(single)}`} onClick={() => onChange([])}>
          <X size={14} weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div className="combo">
      {!full && (
        <input
          ref={inputRef}
          id={inputId}
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={q}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { setOpen(false); if (!multiple) { setEditing(false); setQ(''); } }}
          onKeyDown={onKey}
        />
      )}
      {open && !full && (
        <div className="combo-list" id={listId} role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {results.map((o, i) => (
            <div key={o.id}>
              {o.group && (i === 0 || results[i - 1].group !== o.group) && <div className="group">{o.group}</div>}
              <button type="button" role="option" aria-selected={i === hi} data-active={i === hi} onClick={() => pick(o.id)}>
                {o.label}
              </button>
            </div>
          ))}
          {canAdd && (
            <button type="button" role="option" aria-selected={hi === results.length} data-active={hi === results.length} onClick={add}>
              <Plus size={14} weight="bold" /> {addLabel ? addLabel(q.trim()) : `Add “${q.trim()}”`}
            </button>
          )}
          {rows === 0 && <div className="no-matches">{q.trim() ? `No matches for “${q.trim()}”.` : 'Nothing left to pick.'}</div>}
        </div>
      )}
      {multiple && value.length > 0 && (
        <div className="tags" style={{ marginTop: 8 }}>
          {value.map((vid) => (
            <span key={vid} className={`tag berry ${byId.has(vid) ? '' : 'missing'}`}>
              {labelOf(vid)}
              <button type="button" aria-label={`Remove ${labelOf(vid)}`} onClick={() => onChange(value.filter((x) => x !== vid))}>
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- on/off and pick-one ----------
export function Toggle({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button type="button" className="toggle" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}
export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

/** A number with − and + buttons. Typing works too; it snaps into range when you leave the box. */
export function Stepper({ id, value, onChange, min, max, label, unit }: {
  id?: string; value: number; onChange(v: number): void; min: number; max: number; label: string; unit?: string;
}) {
  // While typing, show what was typed; otherwise always show the real value.
  const [text, setText] = useState<string | null>(null);
  const clampTo = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const commit = () => {
    if (text === null) return;
    const n = Number(text);
    const v = Number.isFinite(n) && text.trim() !== '' ? clampTo(n) : value;
    setText(null);
    if (v !== value) onChange(v);
  };
  return (
    <div className="stepper">
      <button type="button" className="btn icon" aria-label={`Fewer ${unit ?? ''}`.trim()} disabled={value <= min} onClick={() => onChange(clampTo(value - 1))}>−</button>
      <input id={id} className="input" inputMode="numeric" aria-label={label} value={text ?? String(value)}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n));
        }}
        onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <button type="button" className="btn icon" aria-label={`More ${unit ?? ''}`.trim()} disabled={value >= max} onClick={() => onChange(clampTo(value + 1))}>+</button>
      {unit && <span className="stepper-unit">{unit}</span>}
    </div>
  );
}

// ---------- notes box ----------
/** A text box that saves itself a moment after typing stops, and when you leave it. */
export function AutoText({ value, onSave, placeholder, label, rows = 4 }: { value: string; onSave(v: string): void; placeholder: string; label: string; rows?: number }) {
  const [text, setText] = useState(value);
  const timer = useRef<number>();
  const latest = useRef({ value, onSave });
  latest.current = { value, onSave };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <textarea className="textarea notes-box" aria-label={label} placeholder={placeholder} rows={rows} value={text}
      onChange={(e) => { const v = e.target.value; setText(v); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => latest.current.onSave(v), 500); }}
      onBlur={() => { window.clearTimeout(timer.current); if (text !== latest.current.value) latest.current.onSave(text); }} />
  );
}
