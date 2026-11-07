import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowsClockwise, ArrowsLeftRight, MagnifyingGlass, Pause, CalendarPlus, Check, Clock, DotsSixVertical, DotsThree, Play, Plus, SkipForward, Trash } from '@phosphor-icons/react';
import { BackLink, PhoneTop } from '../../components/Shell';
import { Modal, Sheet, toast } from '../../components/ui';
import { householdLabel, householdName, simData, type SimData } from '../../lib/sims';
import { savePath } from '../../lib/router';
import {
  addDays, addHouseholds, cleanRotation, currentLength, pause, resume, DEFAULT_TURN, endTurn, ordinal, playNext, playNow, removeHousehold, reorder, setLength,
  standing, turnDay, turnLength, turnSpan, TURN_CHOICES, upNext, type Rotation,
} from '../../lib/rotation';
import { moduleOn, saveData } from '../../lib/saves';
import { useRecords, useStore } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { plural } from '../../lib/text';
import { dateOf, formatDate } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import { Faces } from '../households/shared';
import { useMoneyCheck } from '../money/Money';

/** The save's rotation, cleaned, plus what the pages need to show it. */
export function useRotation(save: SaveRow) {
  const store = useStore();
  const hhRecs = useRecords('household');
  const sims = useRecords('sim');
  const d = saveData(save);
  const ids = useMemo(() => new Set(hhRecs.map((r) => r.id)), [hhRecs]);
  const r = cleanRotation(d.rotation, (id) => ids.has(id));
  const members = (id: string) => sims.filter((s) => simData(s).householdId === id && !simData(s).deceased).map((s) => ({ id: s.id, sim: simData(s) as SimData }));
  const name = (id: string) => hhLabel(householdName(hhRecs.find((x) => x.id === id)));
  const when = (day: number) => formatDate(dateOf(day, d.calendar), 'short');
  /** Saves a change. With undo text, the toast offers Undo. */
  const update = (next: Rotation, text?: string) => {
    const before = d.rotation;
    store.updateSave(save.id, { rotation: next });
    if (text) toast(text, { label: 'Undo', run: () => store.updateSave(save.id, { rotation: before }) });
  };
  return { save, saveId: save.id, on: moduleOn(d, 'rotation'), r, d, today: d.today, track: d.trackDate, members, name, when, update, households: hhRecs };
}
type Rot = ReturnType<typeof useRotation>;

/** "Priestley" -> "Priestley household", the same way the rest of the app says it. */
export const hhLabel = (n: string) => householdLabel(n) || 'Unnamed household';
/** "the Priestley household", but "The 4Ever House" stays as is. */
const the = (n: string) => (/^the\s/i.test(n) ? n : `the ${n}`);

/** The turn's progress as one segment per day. */
function DayBar({ day, len }: { day: number; len: number }) {
  const segs = Math.max(len, Math.min(day, 14));
  return (
    <div className={`rot-bar${day > len ? ' over' : ''}`} aria-hidden="true">
      {Array.from({ length: Math.min(segs, 14) }, (_, i) => <span key={i} className={i < day ? (i >= len ? 'x' : 'on') : ''} />)}
    </div>
  );
}

function turnLine(rot: Rot) {
  const { r, today, track } = rot;
  if (!r.current) return '';
  const len = currentLength(r);
  const day = turnDay(r, today);
  if (r.paused) return track ? `Day ${day} · no end set · since ${rot.when(r.startDay)}` : 'No end set';
  const extra = r.extra ? ` (${r.extra} extra)` : '';
  if (!track) return `${len}-day turn${extra}`;
  return day > len ? `Day ${day} · turn was ${plural(len, 'day')}` : `Day ${day} of ${len}${extra} · since ${rot.when(r.startDay)}`;
}

/** Playing now: the household, day N of M, End turn. `where` = the Today page card or the Rotation page's big card. */
export function PlayingNow({ save, where }: { save: SaveRow; where: 'today' | 'page' }) {
  const rot = useRotation(save);
  const phone = useIsPhone();
  const [ending, setEnding] = useState(false);
  const [adding, setAdding] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { r } = rot;
  if (!rot.on) return null;
  const page = savePath(save.id, 'rotation');
  if (!r.current) {
    if (where === 'page') return null;
    return (
      <section className="card rot-start">
        <div className="rot-kicker"><ArrowsClockwise size={16} weight="bold" /> Rotation</div>
        <p className="muted" style={{ margin: '4px 0 12px' }}>Pick the households you take turns playing.</p>
        <button type="button" className="btn" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> Add households</button>
        {adding && <AddDialog rot={rot} phone={phone} onClose={() => setAdding(false)} />}
      </section>
    );
  }
  const cur = r.current;
  const len = currentLength(r);
  const day = turnDay(r, rot.today);
  const next = upNext(r)[0];
  const faces = rot.members(cur);
  return (
    <section className={`card rot-now rot-${where}${rot.track && !r.paused && day > len ? ' over' : ''}${r.paused ? ' paused' : ''}`}>
      <div className="rot-top">
        <div className="rot-kicker">{r.paused ? <><Pause size={14} weight="fill" /> Playing now · paused</> : <><Play size={14} weight="fill" /> Playing now</>}</div>
        {where === 'today' && <a className="rot-link" href={page}>Rotation</a>}
      </div>
      <div className={`rot-who rot-${phone ? 'page' : where}`}>
        {faces.length > 0 && <Faces sims={faces} size={where === 'page' && !phone ? 48 : 36} max={5} />}
        <div style={{ minWidth: 0 }}>
          <a className="rot-name" href={savePath(save.id, `households/${cur}`)}>{rot.name(cur)}</a>
          <div className="rot-line">{turnLine(rot)}</div>
        </div>
      </div>
      {rot.track && !r.paused && <DayBar day={day} len={len} />}
      <div className="rot-acts">
        {!r.paused && <button type="button" className="btn sm" onClick={() => rot.update(addDays(r, 1), `${rot.name(cur)} gets 1 more day this turn`)}><CalendarPlus size={14} weight="bold" /> Add a day</button>}
        {r.paused
          ? <button type="button" className="btn sm" onClick={() => rot.update(resume(r, rot.today), `Rotation is back on. ${rot.name(cur)}’s turn starts today`)}><Play size={14} weight="fill" /> Resume rotation</button>
          : <button type="button" className="btn sm" onClick={() => rot.update(pause(r), `Rotation paused. Keep playing ${rot.name(cur)} as long as you like`)}><Pause size={14} weight="fill" /> Pause rotation</button>}
        <button type="button" className="btn sm" onClick={() => setSwitching(true)}><ArrowsLeftRight size={14} weight="bold" /> Play someone else</button>
      </div>
      <div className="rot-foot">
        {where === 'today' && next ? (
          <span className="rot-next"><span className="muted">Up next:</span> <b>{rot.name(next)}</b></span>
        ) : null}
        {next && <button type="button" className={`btn${where === 'page' ? ' primary' : ''}`} onClick={() => setEnding(true)}>End turn <ArrowRight size={16} weight="bold" /></button>}
      </div>
      {ending && <EndTurnDialog rot={rot} phone={phone} onClose={() => setEnding(false)} />}
      {switching && <SwitchDialog rot={rot} phone={phone} onClose={() => setSwitching(false)} />}
    </section>
  );
}

function Pop({ phone, title, onClose, children, footer, pinned }: { phone: boolean; title: string; onClose(): void; children: ReactNode; footer: ReactNode; pinned?: ReactNode }) {
  if (phone) return <Sheet title={title} onClose={onClose}><div className="rot-sheet">{children}<div className={`rot-sheet-foot${pinned ? ' pinned' : ''}`}>{footer}{pinned}</div></div></Sheet>;
  return <Modal title={title} onClose={onClose} footer={footer} autoFocus={false}><div className="rot-sheet">{children}</div></Modal>;
}

export function EndTurnDialog({ rot, phone, onClose }: { rot: Rot; phone: boolean; onClose(): void }) {
  const { r } = rot;
  const cur = r.current!;
  const next = upNext(r)[0];
  const span = turnSpan(r, rot.today);
  const mc = useMoneyCheck(rot.save, cur);
  const go2 = () => {
    mc.commit();
    onClose();
    rot.update(endTurn(r, rot.today), `${rot.name(next)}’s turn started`);
  };
  return (
    <Pop phone={phone} title={`End ${the(rot.name(cur))}’s turn?`} onClose={onClose} pinned={mc.on && !mc.skip ? mc.total : undefined}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Not yet</button>
        <button type="button" className="btn primary" onClick={go2}><Play size={14} weight="fill" /> Start {the(rot.name(next))}’s turn</button>
      </>}>
      {rot.track && (
        <div className="rot-span">
          <b>{rot.when(span.from)}</b>{span.to !== span.from && <> <ArrowRight size={14} weight="bold" /> <b>{rot.when(span.to)}</b></>}
          <span className="muted"> · {plural(span.days, 'day')}</span>
        </div>
      )}
      {mc.on && mc.fields(phone, !phone)}
      <div className="rot-label">Next up</div>
      <div className="rot-nextcard">
        <Faces sims={rot.members(next)} size={36} max={4} />
        <div><b>{rot.name(next)}</b><div className="muted small">{turnLength(r, next)}-day turn{rot.track ? `, starting ${rot.when(rot.today)}` : ''}</div></div>
      </div>
    </Pop>
  );
}

/** Switch: tap a household to play it now. Ones not in the rotation join it as they start. */
function SwitchDialog({ rot, phone, onClose }: { rot: Rot; phone: boolean; onClose(): void }) {
  const { r } = rot;
  const [q, setQ] = useState('');
  const match = (id: string) => !q.trim() || rot.name(id).toLowerCase().includes(q.trim().toLowerCase());
  const inLine = upNext(r).filter(match);
  const out = rot.households.filter((h) => !r.order.includes(h.id)).map((h) => h.id).filter(match)
    .sort((a, b) => rot.name(a).localeCompare(rot.name(b), undefined, { sensitivity: 'base' }));
  const play = (id: string) => {
    onClose();
    const joined = r.order.includes(id) ? r : addHouseholds(r, [id], DEFAULT_TURN, rot.today);
    rot.update(playNow(joined, id, rot.today), `${rot.name(id)} is playing now`);
  };
  const add = (id: string) => rot.update(addHouseholds(r, [id], DEFAULT_TURN, rot.today), `${rot.name(id)} joined the rotation`);
  const row = (id: string, sub: string, extra?: ReactNode) => (
    <div key={id} className="rot-swrow">
      <button type="button" className="rot-swpick" onClick={() => play(id)}>
        <span className="rot-swfaces"><Faces sims={rot.members(id)} size={28} max={2} /></span>
        <span className="grow"><b>{rot.name(id)}</b><span className="muted small">{sub}</span></span>
        <Play size={14} weight="fill" className="rot-swplay" aria-hidden="true" />
      </button>
      {extra}
    </div>
  );
  return (
    <Pop phone={phone} title="Play someone else" onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>Cancel</button>}>
      <label className="rot-search"><MagnifyingGlass size={16} /><input className="input" placeholder="Search households" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <p className="muted small" style={{ margin: 0 }}>Tap one to play it now. {rot.name(r.current!)} keeps its place in line.</p>
      {inLine.length > 0 && <><div className="rot-label">In the rotation</div><div className="rot-swlist">{inLine.map((id) => { const st = standing(r, id); return row(id, st && st.kind === 'next' ? (st.place === 1 ? 'Up next' : `${ordinal(st.place)} in line`) : ''); })}</div></>}
      {out.length > 0 && <><div className="rot-label">Not in the rotation yet</div><div className="rot-swlist">{out.map((id) => row(id, plural(rot.members(id).length, 'Sim'),
        <button type="button" className="btn sm ghost" aria-label={`Add ${rot.name(id)} to the end of the line`} onClick={() => add(id)}><Plus size={14} weight="bold" /><span className="rot-swaddtxt"> Add to line</span></button>))}</div></>}
      {!inLine.length && !out.length && <p className="muted">No household called “{q}”.</p>}
    </Pop>
  );
}

function AddDialog({ rot, phone, onClose }: { rot: Rot; phone: boolean; onClose(): void }) {
  const out = rot.households.filter((h) => !rot.r.order.includes(h.id))
    .sort((a, b) => householdName(a).localeCompare(householdName(b), undefined, { sensitivity: 'base' }));
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState(DEFAULT_TURN);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const save = () => {
    onClose();
    const first = !rot.r.current;
    rot.update(addHouseholds(rot.r, picked, days, rot.today), first ? `${rot.name(picked[0])} is playing now` : `Added ${plural(picked.length, 'household')}`);
  };
  return (
    <Pop phone={phone} title="Add to rotation" onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!picked.length} onClick={save}>{picked.length ? `Add ${plural(picked.length, 'household')}` : 'Add'}</button>
      </>}>
      {out.length ? (
        <>
          <div className="rot-picklist">
            {out.map((h) => {
              const on = picked.includes(h.id);
              const m = rot.members(h.id);
              return (
                <button key={h.id} type="button" className={`rot-pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(h.id)}>
                  <span className="rot-check" aria-hidden="true">{on && <Check size={14} weight="bold" />}</span>
                  <span className="grow"><b>{hhLabel(householdName(h))}</b><span className="muted small"> {plural(m.length, 'Sim')}</span></span>
                  {on && <span className="rot-order">{ordinal(rot.r.order.length + picked.indexOf(h.id) + 1)}</span>}
                </button>
              );
            })}
          </div>
          <div className="rot-label">Turn length</div>
          <LengthChips value={days} onChange={setDays} />
          <p className="muted small" style={{ margin: 0 }}>They join the end of the line in the order you tick them. You can change each one’s length later.</p>
        </>
      ) : <p className="muted">Every household is already in the rotation.</p>}
    </Pop>
  );
}

function LengthChips({ value, onChange }: { value: number; onChange(n: number): void }) {
  return (
    <div className="rot-chips" role="radiogroup" aria-label="Turn length">
      {TURN_CHOICES.map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={`rot-chip${value === n ? ' on' : ''}`} onClick={() => onChange(n)}>{plural(n, 'day')}</button>
      ))}
    </div>
  );
}

function LengthDialog({ rot, id, phone, onClose }: { rot: Rot; id: string; phone: boolean; onClose(): void }) {
  const [days, setDays] = useState(turnLength(rot.r, id));
  return (
    <Pop phone={phone} title={`${rot.name(id)}’s turn length`} onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" onClick={() => { onClose(); rot.update(setLength(rot.r, id, days)); }}>Save</button>
      </>}>
      <LengthChips value={days} onChange={setDays} />
    </Pop>
  );
}

/** The ⋯ on an up-next row (and on the household page). */
function RowMenu({ rot, id, onLength }: { rot: Rot; id: string; onLength(): void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const first = upNext(rot.r)[0] === id;
  const act = (f: () => void) => () => { setOpen(false); f(); };
  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn ghost icon" aria-label={`More for ${rot.name(id)}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((x) => !x)}><DotsThree size={20} weight="bold" /></button>
      {open && (
        <div className="combo-list more-menu rot-menu" role="menu" style={{ right: 0, left: 'auto' }}>
          <button type="button" role="menuitem" onClick={act(() => rot.update(playNow(rot.r, id, rot.today), `${rot.name(id)} is playing now`))}><Play size={16} weight="duotone" /> Play now</button>
          {!first && <button type="button" role="menuitem" onClick={act(() => rot.update(playNext(rot.r, id)))}><SkipForward size={16} weight="duotone" /> Play next</button>}
          <button type="button" role="menuitem" onClick={act(onLength)}><Clock size={16} weight="duotone" /> Turn length</button>
          <button type="button" role="menuitem" className="danger" onClick={act(() => rot.update(removeHousehold(rot.r, id, rot.today), `Took ${the(rot.name(id))} out`))}><Trash size={16} weight="duotone" /> Take out of rotation</button>
        </div>
      )}
    </span>
  );
}

/** Up next, drag the dots to reorder. A divider shows where the next round begins. */
function UpNext({ rot, phone }: { rot: Rot; phone: boolean }) {
  const { r } = rot;
  const list = upNext(r);
  const [lengthOf, setLengthOf] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  const rows = useRef<HTMLDivElement>(null);
  if (!list.length) return null;
  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = rows.current;
    if (!el) return;
    const tops = [...el.querySelectorAll<HTMLElement>('.rot-row')].map((x) => { const b = x.getBoundingClientRect(); return b.top + b.height / 2; });
    let over = list.indexOf(id);
    setDrag({ id, over });
    const move = (ev: PointerEvent) => { over = Math.max(0, Math.min(list.length - 1, tops.filter((t) => t < ev.clientY).length - (tops.filter((t) => t < ev.clientY).length > list.indexOf(id) ? 1 : 0))); setDrag({ id, over }); };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      const next = list.filter((x) => x !== id);
      next.splice(over, 0, id);
      if (next.join() !== list.join()) rot.update(reorder(r, next));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const shown = drag ? (() => { const n = list.filter((x) => x !== drag.id); n.splice(drag.over, 0, drag.id); return n; })() : list;
  const nextRound = r.round + 1;
  return (
    <section className="card rot-up">
      <div className="card-head"><h2>Up next</h2></div>
      <div ref={rows}>
        {shown.map((id) => {
          const m = rot.members(id);
          return (
            <div key={id}>
              {id === r.roundStart && <div className="rot-round"><ArrowsClockwise size={14} /> Round {nextRound} starts here</div>}
              <div className={`rot-row${drag?.id === id ? ' dragging' : ''}`}>
                <button type="button" className="btn ghost icon rot-grip" aria-label={`Drag to move ${rot.name(id)}`} onPointerDown={startDrag(id)}><DotsSixVertical size={20} weight="bold" /></button>
                {!phone && <Faces sims={m} size={32} max={3} />}
                {(() => {
                  const len = <button type="button" className="btn sm rot-len" onClick={() => setLengthOf(id)} aria-label={`Turn length for ${rot.name(id)}: ${plural(turnLength(r, id), 'day')}`}><Clock size={14} weight="duotone" /> {plural(turnLength(r, id), 'day')}</button>;
                  const name = <a className="rot-rowname" href={savePath(rot.saveId, `households/${id}`)}><b>{rot.name(id)}</b>{!phone && <span className="muted small">{plural(m.length, 'Sim')}</span>}</a>;
                  return phone ? <div className="grow rot-rowcol">{name}{len}</div> : <><div className="grow">{name}</div>{len}</>;
                })()}
                <RowMenu rot={rot} id={id} onLength={() => setLengthOf(id)} />
              </div>
            </div>
          );
        })}
        {r.roundStart === r.current && <div className="rot-round end"><ArrowsClockwise size={14} /> Round {nextRound} starts with {the(rot.name(r.current!))}</div>}
      </div>
      {lengthOf && <LengthDialog rot={rot} id={lengthOf} phone={phone} onClose={() => setLengthOf(null)} />}
    </section>
  );
}

export function RotationPage({ save }: { save: SaveRow }) {
  const rot = useRotation(save);
  const phone = useIsPhone();
  const [adding, setAdding] = useState(false);
  const { r } = rot;
  const sub = r.order.length ? `Round ${r.round} · ${plural(r.order.length, 'household')}` : 'Take turns playing your households.';
  const add = <button type="button" className={`btn${phone ? ' sm' : ''}`} onClick={() => setAdding(true)}><Plus size={phone ? 14 : 16} weight="bold" /> {phone ? 'Add' : 'Add households'}</button>;
  const empty = !r.order.length && (
    <section className="card rot-empty">
      <span className="obj worlds lg" aria-hidden="true"><ArrowsClockwise size={24} weight="duotone" /></span>
      <h2>No one’s in the rotation yet</h2>
      <p className="muted">Add the households you take turns playing. SimDesk keeps track of whose turn it is and for how long.</p>
      <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> Add households</button>
    </section>
  );
  const body = empty || (
    <div className={phone ? 'm-stack' : 'rot-cols'}>
      <PlayingNow save={save} where="page" />
      <UpNext rot={rot} phone={phone} />
    </div>
  );
  if (!rot.on) return <div className="page"><p className="muted">Rotation is off. Turn it on in Save settings.</p></div>;
  if (phone) {
    return (
      <div className="m-stack">
        <PhoneTop save={save} />
        <BackLink href={savePath(save.id, 'more')} label="More" />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div><h1 className="m-h1">Rotation</h1><div className="muted">{sub}</div></div>
          {r.order.length > 0 && add}
        </div>
        {body}
        {adding && <AddDialog rot={rot} phone onClose={() => setAdding(false)} />}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div><h1>Rotation</h1><div className="sub">{sub}</div></div>
        {r.order.length > 0 && add}
      </div>
      {body}
      {adding && <AddDialog rot={rot} phone={false} onClose={() => setAdding(false)} />}
    </div>
  );
}

/** One line on a household page: where they stand in the rotation, with the one action that fits. */
export function HouseholdRotation({ save, hhId }: { save: SaveRow; hhId: string }) {
  const rot = useRotation(save);
  const phone = useIsPhone();
  const [ending, setEnding] = useState(false);
  if (!rot.on) return null;
  const { r } = rot;
  const st = standing(r, hhId);
  const page = savePath(save.id, 'rotation');
  let text: ReactNode;
  let action: ReactNode;
  if (!st) {
    text = <span className="muted">Not in the rotation</span>;
    action = <button type="button" className="btn sm" onClick={() => rot.update(addHouseholds(r, [hhId], DEFAULT_TURN, rot.today), r.current ? `Added ${the(rot.name(hhId))}` : `${rot.name(hhId)} is playing now`)}><Plus size={14} weight="bold" /> Add to rotation</button>;
  } else if (st.kind === 'now') {
    text = <><b>Playing now</b> <span className="muted">· {turnLine(rot)}</span></>;
    action = upNext(r).length ? <button type="button" className="btn sm" onClick={() => setEnding(true)}>End turn <ArrowRight size={14} weight="bold" /></button> : null;
  } else {
    text = <><b>{st.place === 1 ? 'Up next' : `${ordinal(st.place)} in line`}</b> <span className="muted">· {turnLength(r, hhId)}-day turn</span></>;
    action = <button type="button" className="btn sm" onClick={() => rot.update(playNow(r, hhId, rot.today), `${rot.name(hhId)} is playing now`)}><Play size={14} weight="fill" /> Play now</button>;
  }
  return (
    <div className="rot-hh">
      <a className="obj worlds" href={page} aria-label="Open Rotation"><ArrowsClockwise size={16} weight="duotone" /></a>
      <span className="grow">{text}</span>
      {action}
      {ending && <EndTurnDialog rot={rot} phone={phone} onClose={() => setEnding(false)} />}
    </div>
  );
}

/** Sim profile: a small "Playing now" tag when their household is up. Tapping opens Rotation. */
export function PlayingTag({ save, hhId }: { save: SaveRow; hhId: string | null }) {
  const rot = useRotation(save);
  if (!rot.on || !hhId || rot.r.current !== hhId) return null;
  return <a className="tag worlds rot-tag" href={savePath(save.id, 'rotation')}><Play size={10} weight="fill" /> Playing now</a>;
}
