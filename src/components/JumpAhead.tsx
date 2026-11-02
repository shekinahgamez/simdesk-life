import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUp, Cake, Confetti, Hourglass } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { useStageTable } from '../store/hooks';
import { addDays, formatDate, formatShort, SEASONS, STAGE_LABEL, toIndex } from '../lib/time';
import { recapBetween, recapHeadline, type RecapItem } from '../lib/recap';
import { Modal, Seg, toast } from './ui';

export function JumpAheadButton({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <JumpAheadModal onClose={() => setOpen(false)} />}
    </>
  );
}

function JumpAheadModal({ onClose }: { onClose(): void }) {
  const save = useSave()!;
  const { recs, updateSave } = useStore();
  const table = useStageTable();
  const len = save.seasonLength;
  const [mode, setMode] = useState<'days' | 'date'>('days');
  const [days, setDays] = useState(1);
  const [target, setTarget] = useState(() => addDays(save.date, 1, len));
  const [done, setDone] = useState<{ items: RecapItem[]; n: number } | null>(null);

  const to = mode === 'days' ? addDays(save.date, Math.max(1, days), len) : target;
  const n = toIndex(to, len) - toIndex(save.date, len);
  const preview = useMemo(
    () => (n > 0 ? recapBetween(save, to, Object.values(recs.sim), Object.values(recs.holiday), table) : []),
    [save, to, recs, n, table],
  );

  const go = () => {
    if (n <= 0) return;
    updateSave({ date: to });
    setDone({ items: preview, n });
    toast(recapHeadline(n, preview));
  };

  if (done)
    return (
      <Modal title="Here’s what happened" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>All caught up. Go play!</button>}>
        <p style={{ marginTop: 0 }}>{recapHeadline(done.n, done.items)}</p>
        <RecapList items={done.items} />
      </Modal>
    );

  return (
    <Modal
      title="Jump ahead"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={go} disabled={n <= 0}>
            Jump to {formatDate(to)}
          </button>
        </>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        Today is {formatDate(save.date)}. Move forward any amount and SimDesk catches everything up for you.
      </p>
      <Seg label="How to jump" value={mode} onChange={(v) => setMode(v)} options={[{ v: 'days', label: 'By days' }, { v: 'date', label: 'To a date' }]} />
      <div style={{ marginTop: 16 }}>
        {mode === 'days' ? (
          <div className="stack">
            <Seg
              label="Days"
              value={[1, 3, 7, len].includes(days) ? days : -1}
              onChange={(v) => v > 0 && setDays(v)}
              options={[
                { v: 1, label: '1 day' },
                { v: 3, label: '3 days' },
                ...(len !== 7 ? [{ v: 7, label: '1 week' }] : []),
                { v: len, label: 'A season' },
              ]}
            />
            <label className="row small">
              Or exactly
              <input className="input" type="number" min={1} max={9999} value={days} style={{ width: 100 }} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
              days
            </label>
          </div>
        ) : (
          <DatePickerRow value={target} onChange={setTarget} len={len} />
        )}
      </div>
      <div className="divider" />
      <div className="label" style={{ marginBottom: 8 }}>{n > 0 ? `Coming up in those ${n} days` : 'Pick a date after today'}</div>
      {n > 0 && <RecapList items={preview} empty="Nothing on the calendar. A quiet stretch." />}
    </Modal>
  );
}

export function DatePickerRow({ value, onChange, len }: { value: { year: number; season: 0 | 1 | 2 | 3; day: number }; onChange(v: typeof value): void; len: number }) {
  return (
    <div className="row">
      <label className="field" style={{ width: 90 }}>
        <span className="label">Year</span>
        <input className="input" type="number" value={value.year} onChange={(e) => onChange({ ...value, year: Number(e.target.value) || 1 })} />
      </label>
      <label className="field" style={{ width: 130 }}>
        <span className="label">Season</span>
        <select className="select" value={value.season} onChange={(e) => onChange({ ...value, season: Number(e.target.value) as 0 })}>
          {SEASONS.map((s, i) => (
            <option key={s} value={i}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field" style={{ width: 90 }}>
        <span className="label">Day</span>
        <input className="input" type="number" min={1} max={len} value={value.day} onChange={(e) => onChange({ ...value, day: Math.min(len, Math.max(1, Number(e.target.value) || 1)) })} />
      </label>
    </div>
  );
}

export function RecapList({ items, empty = 'Nothing happened. Suspiciously calm.' }: { items: RecapItem[]; empty?: string }) {
  if (!items.length) return <p className="small muted">{empty}</p>;
  return (
    <div className="stack" style={{ gap: 6, maxHeight: 320, overflow: 'auto' }}>
      {items.map((i, k) => (
        <div key={k} className="row small" style={{ gap: 10, flexWrap: 'nowrap' }}>
          <span className={`obj ${i.kind === 'holiday' ? 'calendar' : 'sims'}`} aria-hidden="true">
            {i.kind === 'ageUp' ? <ArrowUp size={14} weight="bold" /> : i.kind === 'birthday' ? <Cake size={14} weight="duotone" /> : i.kind === 'oldAge' ? <Hourglass size={14} weight="duotone" /> : <Confetti size={14} weight="duotone" />}
          </span>
          <span className="grow">
            <b>{i.label}</b>{' '}
            {i.kind === 'ageUp' && `aged up to ${STAGE_LABEL[i.stage!].toLowerCase()}`}
            {i.kind === 'birthday' && 'had a birthday'}
            {i.kind === 'oldAge' && 'can now pass of old age any day'}
          </span>
          <span className="muted tiny" style={{ whiteSpace: 'nowrap' }}>{formatShort(i.date)}</span>
        </div>
      ))}
    </div>
  );
}
