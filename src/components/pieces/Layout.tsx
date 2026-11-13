import type { ReactNode } from 'react';
import { CaretLeft, Plus } from '@phosphor-icons/react';

/** THE list row. The left slot changes by what the row is (face, section icon, small picture, or nothing); everything else is fixed. */
export function ListRow({ lead, title, sub, chip, value, href, onClick, picked }: {
  lead?: ReactNode; title: ReactNode; sub?: ReactNode; chip?: ReactNode; value?: ReactNode; href?: string; onClick?(): void; picked?: boolean;
}) {
  const body = (
    <>
      {lead && <span className="p-lead">{lead}</span>}
      <span className="p-main"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {chip}
      {value != null && <span className="p-value">{value}</span>}
    </>
  );
  const cls = `p-row${picked ? ' picked' : ''}`;
  if (href) return <a className={cls} href={href}>{body}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} aria-pressed={picked}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** THE section header: title, count, optional action on the right. */
export function SectionHeader({ title, count, action }: { title: ReactNode; count?: number; action?: ReactNode }) {
  return <div className="p-sh"><h3>{title}</h3>{count != null && <span className="cnt">{count}</span>}<span className="grow" />{action}</div>;
}

/** THE empty state: one line of what goes here, one button when there's an action. */
export function EmptyState({ text, action, icon }: { text: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return <div className="empty">{icon}<p>{text}</p>{action}</div>;
}

/** THE page header: back link, title, actions on the right. */
export function PageHeader({ title, back, actions }: { title: ReactNode; back?: { label: string; href: string }; actions?: ReactNode }) {
  return (
    <div className="p-ph">
      {back && <a className="p-back" href={back.href}><CaretLeft size={14} weight="bold" aria-hidden="true" />{back.label}</a>}
      <div className="row" style={{ gap: 10 }}><h1 className="grow" style={{ margin: 0 }}>{title}</h1>{actions}</div>
    </div>
  );
}

/** THE add button: small, quiet, same place on every card. */
export function AddButton({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return <button type="button" className="btn sm ghost p-add" onClick={onClick}><Plus size={14} weight="bold" aria-hidden="true" /> {children}</button>;
}

/** THE progress bar. `pct` is 0 to 100. */
export function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return <div className="p-bar-track" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ width: `${Math.max(3, v)}%` }} /></div>;
}

/** THE select bar: tick rows, then one bar with the actions that fit the page. Delete goes last, red, and asks first. */
export function SelectBar({ count, noun, actions, onCancel, phone }: {
  count: number; noun: string; actions: ReactNode; onCancel(): void; phone?: boolean;
}) {
  return (
    <div className={`select-bar${phone ? ' phone' : ''}`} role="toolbar" aria-label={`Picked ${noun}`}>
      <span className="grow"><b>{count}</b> picked</span>
      <button type="button" className="btn ghost sm" onClick={onCancel}>Cancel</button>
      {actions}
    </div>
  );
}
