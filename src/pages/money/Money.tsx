import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowsClockwise, CaretRight, Check, Coins, HouseSimple, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { Modal, Sheet, toast, Toggle } from '../../components/ui';
import { RowPop } from '../sims/RowEdit';
import { SimAvatar } from '../sims/shared';
import { lotData } from '../../lib/lots';
import {
  bySim, changeSince, classIndex, classLine, fmt, GROUP_LABEL, GROUPS, itemTitle, logToday, MOD_NAMES, moneyData, moneyId,
  moneySettings, parseAmount, shareOf, short, simNet, totals, typeOf, typesFor, visibleItems,
  type Group, type MoneyData, type MoneyItem, type MoneySettings, type Side, type WealthClass,
} from '../../lib/money';
import { savePath } from '../../lib/router';
import { moduleOn, saveData } from '../../lib/saves';
import { householdLabel, householdName, simData, type SimData } from '../../lib/sims';
import { newId } from '../../lib/sync/store';
import { useRecords, useStore } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { dateOf, formatDate } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';

const COLOR: Record<Group, string> = { cash: 'var(--households-ink)', bank: 'var(--calendar-ink)', invest: 'var(--worlds-ink)', property: 'var(--sims-ink)' };

// ---------- data ----------
/** Everything the money pieces need for one household. `on` is false when the module is off. */
export function useMoney(save: SaveRow, hhId: string | null) {
  const store = useStore();
  const recs = useRecords('money');
  const sims = useRecords('sim');
  const lots = useRecords('lot');
  const hhRecs = useRecords('household');
  const d = saveData(save);
  const set = moneySettings((d as { money?: unknown }).money);
  const on = moduleOn(d, 'funds') && !!hhId;
  const id = hhId ? moneyId(hhId) : '';
  const rec = recs.find((r) => r.id === id);
  return useMemo(() => {
    const m = moneyData(rec, hhId ?? '');
    const members = sims.filter((s) => hhId && simData(s).householdId === hhId && !simData(s).deceased).map((s) => ({ id: s.id, sim: simData(s) as SimData }));
    const memberIds = members.map((x) => x.id);
    const owned = lots.map((r) => ({ id: r.id, lot: lotData(r) })).filter((r) => hhId && r.lot.owner === hhId && !r.id.startsWith('apt:'));
    const lotsValue = owned.reduce((a, r) => a + (r.lot.price ?? 0), 0);
    const t = totals(m, set, lotsValue);
    const by = bySim(m, set, memberIds, lotsValue);
    const change = changeSince(m.log, t.net, d.today);
    const when = (day: number) => formatDate(dateOf(day, d.calendar), 'short');
    const name = householdLabel(householdName(hhRecs.find((r) => r.id === hhId))) || 'Unnamed household';
    const empty = m.funds === null && !m.items.length;
    /** Saves a change and logs today's net worth. With text, the toast offers Undo. */
    const write = (next: MoneyData, text?: string) => {
      const before = rec ? rec.data : { household: hhId, funds: null, items: [], log: [], lastCheck: null };
      const nt = totals(next, set, lotsValue);
      const out: MoneyData = { ...next, household: hhId ?? '', log: logToday(next, d.today, nt.net, bySim(next, set, memberIds, lotsValue)) };
      store.put('money', out as unknown as Record<string, unknown>, id);
      if (text) toast(text, { label: 'Undo', run: () => store.put('money', before, id) });
    };
    return { on, saveId: save.id, hhId: hhId ?? '', m, set, members, memberIds, owned, lotsValue, t, by, change, when, name, empty, write, today: d.today, track: d.trackDate };
  }, [rec, sims, lots, hhRecs, save, hhId, on]); // eslint-disable-line react-hooks/exhaustive-deps
}
type Money = ReturnType<typeof useMoney>;

const ClassTag = ({ classes, net }: { classes: WealthClass[]; net: number }) => <span className="mny-cls">{classes[classIndex(classes, net)]?.name}</span>;
function Change({ mo, amount, day }: { mo: Money; amount: number; day: number }) {
  return <><span className={amount < 0 ? 'mny-dn' : 'mny-up'}>{amount < 0 ? '▼' : '▲'} {fmt(Math.abs(amount))}</span> <span className="muted">since {mo.when(day)}</span></>;
}

function Avatars({ mo, owners }: { mo: Money; owners: string[] }) {
  const list = owners.map((o) => mo.members.find((x) => x.id === o)).filter(Boolean) as { id: string; sim: SimData }[];
  if (!list.length) return <span className="mny-av hh" aria-hidden="true"><Coins size={13} weight="duotone" /></span>;
  return <span className="mny-avs">{list.slice(0, 3).map((x) => <SimAvatar key={x.id} sim={x.sim} size={24} />)}</span>;
}

// ---------- chart and bars ----------
function Chart({ mo, height = 120, labels = true }: { mo: Money; height?: number; labels?: boolean }) {
  const pts = mo.m.log.map((s) => ({ day: s.day, v: s.net }));
  if (pts.length < 2) return labels ? <p className="small muted" style={{ margin: 0 }}>The chart fills in after your second money check.</p> : null;
  const w = 440;
  const vs = pts.map((p) => p.v);
  let mn = Math.min(...vs); let mx = Math.max(...vs);
  if (mn === mx) { mn -= 1; mx += 1; }
  const L = labels ? 44 : 2; const B = labels ? 20 : 2;
  const d0 = pts[0].day; const d1 = pts[pts.length - 1].day;
  const px = (day: number) => L + ((day - d0) / Math.max(1, d1 - d0)) * (w - L - 4);
  const py = (v: number) => 6 + (height - B - 10) * (1 - (v - mn) / (mx - mn));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.day).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ');
  const mid = pts[Math.floor(pts.length / 2)];
  return (
    <svg className="mny-chart" width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img"
      aria-label={`Net worth from ${fmt(pts[0].v)} on ${mo.when(d0)} to ${fmt(pts[pts.length - 1].v)} on ${mo.when(d1)}`}>
      <path d={`${line} L${px(d1)},${height - B} L${px(d0)},${height - B} Z`} fill="var(--households-tint)" />
      <path d={line} fill="none" stroke="var(--households-ink)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      {labels && <>
        <text x={L} y={height - 4} fontSize={11} fill="var(--muted)">{mo.when(d0)}</text>
        {pts.length > 2 && <text x={px(mid.day)} y={height - 4} fontSize={11} fill="var(--muted)" textAnchor="middle">{mo.when(mid.day)}</text>}
        <text x={w - 2} y={height - 4} fontSize={11} fill="var(--muted)" textAnchor="end">{mo.when(d1)}</text>
        <text x={0} y={py(mx) + 4} fontSize={11} fill="var(--muted)">{short(mx)}</text>
        <text x={0} y={py(mn) + 4} fontSize={11} fill="var(--muted)">{short(mn)}</text>
      </>}
    </svg>
  );
}

function Breakdown({ mo }: { mo: Money }) {
  const g = mo.t.groups;
  const total = GROUPS.reduce((a, k) => a + Math.max(0, g[k]), 0);
  return (
    <>
      <div className="mny-bar" role="img" aria-label={GROUPS.map((k) => `${GROUP_LABEL[k]} ${fmt(g[k])}`).join(', ')}>
        {total > 0 && GROUPS.filter((k) => g[k] > 0).map((k) => <span key={k} style={{ width: `${(100 * g[k]) / total}%`, background: COLOR[k] }} />)}
      </div>
      <div className="mny-key">{GROUPS.map((k) => <span key={k}><i style={{ background: COLOR[k] }} />{GROUP_LABEL[k]}</span>)}</div>
    </>
  );
}

/** Household funds, lots, each Sim: a bar and the amount. Tapping a Sim filters to theirs. */
function BySim({ mo, who, onWho, names = true, fundsOnly = false }: { mo: Money; who?: string | null; onWho?: (id: string | null) => void; names?: boolean; fundsOnly?: boolean }) {
  const rows: { id: string; label: string; v: number; sim?: SimData }[] = fundsOnly ? [{ id: 'funds', label: 'Household funds', v: mo.by.funds }] : [
    { id: 'funds', label: 'Household funds', v: mo.by.funds },
    ...mo.members.map((x) => ({ id: x.id, label: x.sim.first || 'Unnamed', v: mo.by[x.id] ?? 0, sim: x.sim })),
    ...(mo.by.household ? [{ id: 'household', label: 'Shared', v: mo.by.household }] : []),
    ...(mo.lotsValue ? [{ id: 'lots', label: 'Lots', v: mo.lotsValue }] : []),
  ];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  return (
    <div className="mny-sims">
      {rows.map((r) => {
        const tap = onWho && r.sim;
        const inner = (
          <>
            {r.sim ? <SimAvatar sim={r.sim} size={28} /> : <span className="mny-av hh big" aria-hidden="true"><Coins size={15} weight="duotone" /></span>}
            {names && <span className="nm">{r.label}</span>}
            <span className="track"><span style={{ width: `${(100 * Math.abs(r.v)) / max}%`, background: r.v < 0 ? 'var(--danger)' : undefined }} /></span>
            <span className="amt">{short(r.v)}</span>
          </>
        );
        return tap
          ? <button key={r.id} type="button" className={`mny-sim${who === r.id ? ' on' : ''}`} aria-pressed={who === r.id} onClick={() => onWho!(who === r.id ? null : r.id)}>{inner}</button>
          : <div key={r.id} className="mny-sim">{inner}</div>;
      })}
    </div>
  );
}

// ---------- household page ----------
/** Desktop: the Money card at the top of the household's right column. The whole card opens the details. */
export function MoneyCard({ save, hhId, compact = false }: { save: SaveRow; hhId: string; compact?: boolean }) {
  const mo = useMoney(save, hhId);
  const [open, setOpen] = useState<null | 'details' | 'check'>(null);
  if (!mo.on) return null;
  return (
    <section className="card mny-card">
      <div className="card-head"><h2><span className="obj households"><Coins size={16} weight="duotone" /></span>Money</h2>
        <button type="button" className="btn sm" onClick={() => setOpen('check')}><ArrowsClockwise size={14} weight="bold" /> Money check</button></div>
      {mo.empty ? (
        <p className="muted small" style={{ margin: 0 }}>No money logged yet. A money check fills in their funds and accounts.</p>
      ) : (
        <button type="button" className="mny-open" onClick={() => setOpen('details')} aria-label={`Open ${mo.name} money`}>
          <span className="mny-nw-row"><span className="mny-nw">{fmt(mo.t.net)}</span><ClassTag classes={mo.set.classes} net={mo.t.net} /></span>
          <span className="mny-meta">{mo.change ? <Change mo={mo} {...mo.change} /> : <span className="muted">Net worth</span>}</span>
          <Chart mo={mo} height={48} labels={false} />
          <BySim mo={mo} fundsOnly={compact} />
          <span className="mny-link">Details <CaretRight size={14} weight="bold" /></span>
        </button>
      )}
      {open === 'details' && <MoneyDetails save={save} hhId={hhId} onClose={() => setOpen(null)} onCheck={() => setOpen('check')} />}
      {open === 'check' && <MoneyCheckDialog save={save} hhId={hhId} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** Each household member's net worth as short text ("§705k"), or null when there is nothing to show. Used by the desktop household page. */
export function useSimNet(save: SaveRow, hhId: string): Record<string, string> | null {
  const mo = useMoney(save, hhId);
  if (!mo.on || mo.empty) return null;
  const out: Record<string, string> = {};
  for (const x of mo.members) out[x.id] = short(mo.by[x.id] ?? 0);
  return out;
}

/** Phone: one tappable line under the rotation line. */
export function MoneyStrip({ save, hhId }: { save: SaveRow; hhId: string }) {
  const mo = useMoney(save, hhId);
  const [open, setOpen] = useState<null | 'details' | 'check'>(null);
  if (!mo.on) return null;
  return (
    <>
      <button type="button" className="mny-strip" onClick={() => setOpen(mo.empty ? 'check' : 'details')}>
        <span className="obj households"><Coins size={16} weight="duotone" /></span>
        <span className="grow">
          {mo.empty ? <><b>Money</b><span className="mny-meta">Tap to log their funds</span></> : <>
            <span className="mny-nw-row"><b className="mny-nw sm">{fmt(mo.t.net)}</b><ClassTag classes={mo.set.classes} net={mo.t.net} /></span>
            <span className="mny-meta">{mo.change ? <Change mo={mo} {...mo.change} /> : 'Net worth'}</span>
          </>}
        </span>
        <CaretRight size={16} weight="bold" className="chev" />
      </button>
      {open === 'details' && <MoneyDetails save={save} hhId={hhId} onClose={() => setOpen(null)} onCheck={() => setOpen('check')} />}
      {open === 'check' && <MoneyCheckDialog save={save} hhId={hhId} onClose={() => setOpen(null)} />}
    </>
  );
}

// ---------- details ----------
type Edit = { item: MoneyItem | null; side: Side; owner?: string } | 'funds';

/** The detailed money view. Desktop: a wide two-column pop-over. Phone: a full sheet with Money check pinned at the bottom. */
export function MoneyDetails({ save, hhId, onClose, onCheck, who: startWho = null }: { save: SaveRow; hhId: string; onClose(): void; onCheck(): void; who?: string | null }) {
  const mo = useMoney(save, hhId);
  const phone = useIsPhone();
  const [who, setWho] = useState<string | null>(startWho);
  const [edit, setEdit] = useState<Edit | null>(null);
  const check = () => { onClose(); onCheck(); };
  const head = (
    <div className="mny-head">
      <div>
        <div className="mny-big">{fmt(mo.t.net)}</div>
        <div className="mny-meta" style={{ marginTop: 6 }}><ClassTag classes={mo.set.classes} net={mo.t.net} />{mo.change && <span style={{ marginLeft: 8 }}><Change mo={mo} {...mo.change} /></span>}</div>
        <div className="mny-meta">{classLine(mo.set.classes, mo.t.net)}</div>
      </div>
      {!phone && (
        <div className="mny-head-act">
          <button type="button" className="btn primary" onClick={check}><ArrowsClockwise size={16} weight="bold" /> Money check</button>
          {mo.m.lastCheck !== null && mo.track && <span className="small muted">Last check {mo.when(mo.m.lastCheck)}</span>}
        </div>
      )}
    </div>
  );
  const left = (
    <div>
      <div className="mny-sec">Net worth over time</div>
      <Chart mo={mo} />
      <div className="mny-sec">Breakdown</div>
      <Breakdown mo={mo} />
      <div className="mny-sec">By Sim{mo.members.length > 0 && <span className="r">Tap one to see just theirs</span>}</div>
      <BySim mo={mo} who={who} onWho={setWho} />
    </div>
  );
  const right = <Statement mo={mo} who={who} onWho={setWho} onEdit={setEdit} />;
  const dialogs = edit && (edit === 'funds'
    ? <FundsForm mo={mo} onClose={() => setEdit(null)} />
    : <ItemForm mo={mo} item={edit.item} side={edit.side} owner={edit.owner} onClose={() => setEdit(null)} />);
  const title = `${mo.name} money`;
  if (phone) {
    return (
      <Sheet title={title} onClose={onClose}>
        <div className="mny-sheet">
          {head}{left}{right}
          <div className="mny-pin"><button type="button" className="btn primary" onClick={check}><ArrowsClockwise size={16} weight="bold" /> Money check</button></div>
        </div>
        {dialogs}
      </Sheet>
    );
  }
  return (
    <Modal title={title} onClose={onClose} className="mny-modal" autoFocus={false}>
      {head}
      <div className="mny-cols">{left}{right}</div>
      {dialogs}
    </Modal>
  );
}

/** Accounting style: the § sits at the left of the cell and only shows where asked (first row of a section, totals). Below zero reads (1,200). */
function Amt({ v, cur }: { v: number | null; cur: boolean }) {
  const n = v === null ? '--' : `${v < 0 ? '(' : ''}${Math.round(Math.abs(v)).toLocaleString('en-US')}${v < 0 ? ')' : ''}`;
  return <span className="mny-acct" aria-label={v === null ? 'not set' : fmt(v)}><span className="c" aria-hidden="true">{cur ? '§' : ''}</span><span className="n" aria-hidden="true">{n}</span></span>;
}

type ModKey = 'snb' | 'simfin' | 'base';
const MOD_ORDER: ModKey[] = ['snb', 'simfin', 'base'];
/** Splits items into one block per mod (SNB, SimFinancial, then the rest), have before owe already filtered. */
function byMod(list: MoneyItem[]) {
  const g = (i: MoneyItem): ModKey => typeOf(i.type).mod ?? 'base';
  const rank = (i: MoneyItem) => GROUPS.indexOf(typeOf(i.type).group);
  return MOD_ORDER.map((k) => ({ k, items: list.filter((i) => g(i) === k).sort((x, y) => rank(x) - rank(y)) })).filter((b) => b.items.length);
}
const modTitle = (k: ModKey, anyMod: boolean) => (k === 'base' ? (anyMod ? 'Other' : '') : MOD_NAMES[k]);

/** What they have, what they owe, net worth. Each part split by mod. Tap a row to edit it. */
function Statement({ mo, who, onWho, onEdit }: { mo: Money; who: string | null; onWho(id: string | null): void; onEdit(e: Edit): void }) {
  const items = visibleItems(mo.m, mo.set).filter((i) => !who || i.owners.includes(who));
  const amt = (i: MoneyItem) => (who ? Math.abs(shareOf(i, who)) : i.amount);
  const haveItems = items.filter((i) => typeOf(i.type).side === 'have');
  const oweItems = items.filter((i) => typeOf(i.type).side === 'owe');
  const anyMod = mo.set.snb || mo.set.simfin;
  const whoName = who ? mo.members.find((x) => x.id === who)?.sim.first : null;
  let first = true;
  const cur = () => { const c = first; first = false; return c; };
  const row = (i: MoneyItem) => (
    <button key={i.id} type="button" className="mny-row" onClick={() => onEdit({ item: i, side: typeOf(i.type).side })}>
      <Avatars mo={mo} owners={i.owners} />
      <span className="t">{itemTitle(i)}{i.note && <small>{i.note}</small>}{who && i.owners.length > 1 && <small>Their half of {fmt(i.amount)}</small>}</span>
      <Amt v={amt(i)} cur={cur()} />
    </button>
  );
  const blocks = (list: MoneyItem[]) => byMod(list).map((b) => (
    <div key={b.k}>{modTitle(b.k, anyMod) && <div className="mny-mod">{modTitle(b.k, anyMod)}</div>}{b.items.map(row)}</div>
  ));
  const haveTotal = haveItems.reduce((a, i) => a + amt(i), 0) + (who ? 0 : (mo.m.funds ?? 0) + mo.lotsValue);
  const oweTotal = oweItems.reduce((a, i) => a + amt(i), 0);
  const net = who ? simNet(mo.m, mo.set, who) : mo.t.net;
  const addBtn = (side: Side) => <button type="button" className="link-btn" onClick={() => onEdit({ item: null, side, owner: who ?? undefined })}><Plus size={14} weight="bold" /> Add</button>;
  first = true;
  const have = (
    <>
      {!who && (
        <button type="button" className="mny-row" onClick={() => onEdit('funds')}>
          <span className="mny-av hh" aria-hidden="true"><Coins size={13} weight="duotone" /></span><span className="t">Household funds</span><Amt v={mo.m.funds} cur={cur()} />
        </button>
      )}
      {blocks(haveItems)}
      {!who && <>
        <div className="mny-mod">Property</div>
        {mo.owned.length ? mo.owned.map((r) => (
          <a key={r.id} className="mny-row" href={savePath(mo.saveId, `worlds/lot/${r.id}`)}>
            <span className="mny-av hh" aria-hidden="true"><HouseSimple size={13} weight="duotone" /></span>
            <span className="t">{r.lot.name || 'Unnamed lot'}{r.lot.price === null && <small>No value set on the lot</small>}</span><Amt v={r.lot.price} cur={cur()} />
          </a>
        )) : <div className="small muted mny-none">No lots owned yet.</div>}
      </>}
      <div className="mny-sub-total"><span>Total</span><Amt v={haveTotal} cur /></div>
    </>
  );
  first = true;
  const owe = oweItems.length ? <>{blocks(oweItems)}<div className="mny-sub-total"><span>Total</span><Amt v={oweTotal} cur /></div></> : <div className="small muted mny-none">Nothing owed.</div>;
  return (
    <div>
      {who && <div className="mny-filter">Showing {whoName}’s share <button type="button" className="link-btn" onClick={() => onWho(null)}>Show everyone</button></div>}
      <div className="mny-sec">What they have<span className="r">{addBtn('have')}</span></div>
      {have}
      <div className="mny-sec">What they owe<span className="r">{addBtn('owe')}</span></div>
      {owe}
      <div className="mny-total"><span>Net worth</span><Amt v={net} cur /></div>
    </div>
  );
}

// ---------- forms ----------
function Pop({ phone, title, onClose, children, footer, dirty }: { phone: boolean; title: string; onClose(): void; children: ReactNode; footer: (close: () => void) => ReactNode; dirty?: boolean }) {
  if (phone) return <Sheet title={title} onClose={onClose}><div className="mny-form">{children}<div className="mny-form-foot">{footer(onClose)}</div></div></Sheet>;
  return <Modal title={title} onClose={onClose} dirty={dirty} footer={footer}><div className="mny-form">{children}</div></Modal>;
}

function AmountInput({ value, onChange, label, id }: { value: string; onChange(v: string): void; label: string; id?: string }) {
  return <input id={id} className="mny-in" inputMode="decimal" aria-label={label} value={value} placeholder="§0"
    onChange={(e) => onChange(e.target.value)} onBlur={() => { const n = parseAmount(value); if (n !== null) onChange(fmt(n)); }} />;
}

function FundsForm({ mo, onClose }: { mo: Money; onClose(): void }) {
  const phone = useIsPhone();
  const [v, setV] = useState(mo.m.funds === null ? '' : fmt(mo.m.funds));
  const n = parseAmount(v);
  const save = () => { mo.write({ ...mo.m, funds: n }, 'Household funds saved'); onClose(); };
  return (
    <Pop phone={phone} title="Household funds" onClose={onClose} dirty={v !== (mo.m.funds === null ? '' : fmt(mo.m.funds))}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={save} disabled={v.trim() !== '' && n === null}>Save</button></>}>
      <label className="mny-lbl" htmlFor="mny-funds">The money in the household’s wallet</label>
      <AmountInput id="mny-funds" value={v} onChange={setV} label="Household funds" />
    </Pop>
  );
}

/** Add or edit one account or debt. */
function ItemForm({ mo, item, side, owner, onClose }: { mo: Money; item: MoneyItem | null; side: Side; owner?: string; onClose(): void }) {
  const phone = useIsPhone();
  const types = typesFor(mo.set, side);
  const [type, setType] = useState(item?.type ?? types[0]?.id ?? (side === 'owe' ? 'debt' : 'savings'));
  const [name, setName] = useState(item?.name ?? '');
  const [owners, setOwners] = useState<string[]>(item?.owners ?? (owner ? [owner] : mo.members[0] ? [mo.members[0].id] : []));
  const [amount, setAmount] = useState(item ? fmt(item.amount) : '');
  const [note, setNote] = useState(item?.note ?? '');
  const n = parseAmount(amount);
  const dirty = !item ? !!(name || amount || note) : type !== item.type || name !== item.name || note !== item.note || n !== item.amount || owners.join() !== item.owners.join();
  const save = () => {
    const next: MoneyItem = { id: item?.id ?? newId(), type, name: name.trim(), owners, amount: n ?? 0, note: note.trim() };
    const items = item ? mo.m.items.map((i) => (i.id === item.id ? next : i)) : [...mo.m.items, next];
    mo.write({ ...mo.m, items }, item ? `${itemTitle(next)} saved` : `${itemTitle(next)} added`);
    onClose();
  };
  const del = () => { mo.write({ ...mo.m, items: mo.m.items.filter((i) => i.id !== item!.id) }, `${itemTitle(item!)} deleted`); onClose(); };
  const toggle = (id: string) => setOwners((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const title = item ? itemTitle(item) : side === 'owe' ? 'Add something they owe' : 'Add an account';
  return (
    <Pop phone={phone} title={title} onClose={onClose} dirty={dirty}
      footer={(close) => <>
        {item && <button type="button" className="btn ghost" style={{ marginRight: 'auto', color: 'var(--danger)' }} onClick={del}><Trash size={16} /> Delete</button>}
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <button type="button" className="btn primary" onClick={save} disabled={n === null}>{item ? 'Save' : 'Add'}</button>
      </>}>
      <div className="mny-lbl">Type</div>
      <div role="radiogroup" aria-label="Type">
        {MOD_ORDER.map((k) => {
          const list = types.filter((t) => (t.mod ?? 'base') === k);
          if (!list.length) return null;
          return (
            <div key={k}>
              {modTitle(k, mo.set.snb || mo.set.simfin) && <div className="mny-mod">{modTitle(k, mo.set.snb || mo.set.simfin)}</div>}
              <div className="mny-types">
                {list.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={type === t.id} className={`mny-type${type === t.id ? ' on' : ''}`} onClick={() => setType(t.id)}>
                    {type === t.id && <Check size={14} weight="bold" />}<span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <label className="mny-lbl" htmlFor="mny-name">Name <span className="muted">(optional)</span></label>
      <input id="mny-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={side === 'owe' ? 'Like “Priestley Foundation”' : 'Like “1,200 shares”'} />
      {mo.members.length > 0 && <>
        <div className="mny-lbl">Whose is it? <span className="muted">Pick two or more for joint. None = the household.</span></div>
        <div className="mny-owners">
          {mo.members.map((x) => (
            <button key={x.id} type="button" className={`mny-owner${owners.includes(x.id) ? ' on' : ''}`} aria-pressed={owners.includes(x.id)} onClick={() => toggle(x.id)}>
              <SimAvatar sim={x.sim} size={24} /><span>{x.sim.first || 'Unnamed'}</span>{owners.includes(x.id) && <Check size={14} weight="bold" />}
            </button>
          ))}
        </div>
      </>}
      <label className="mny-lbl" htmlFor="mny-amt">{side === 'owe' ? 'How much they still owe' : 'Balance'}</label>
      <AmountInput id="mny-amt" value={amount} onChange={setAmount} label={side === 'owe' ? 'Amount owed' : 'Balance'} />
      <label className="mny-lbl" htmlFor="mny-note">Note <span className="muted">(optional)</span></label>
      <input id="mny-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={side === 'owe' ? 'Like “§1,550 a week · 12 weeks left”' : ''} />
    </Pop>
  );
}

// ---------- money check ----------
type CheckRow = { key: string; label: string; was: number | null; owe: boolean };

/** The money check fields: every balance, filled in with the last value. Used in End turn and on its own. */
export function useMoneyCheck(save: SaveRow, hhId: string | null) {
  const mo = useMoney(save, hhId);
  const rows: CheckRow[] = useMemo(() => [
    { key: 'funds', label: 'Household funds', was: mo.m.funds, owe: false },
    ...visibleItems(mo.m, mo.set).map((i) => {
      const who = i.owners.map((o) => mo.members.find((x) => x.id === o)?.sim.first).filter(Boolean).join(' & ');
      return { key: i.id, label: `${who ? `${who} · ` : ''}${itemTitle(i)}${typeOf(i.type).side === 'owe' ? ' owed' : ''}`, was: i.amount, owe: typeOf(i.type).side === 'owe' };
    }),
  ], [mo]);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, r.was === null ? '' : fmt(r.was)])));
  const [skip, setSkip] = useState(false);
  const valueOf = (r: CheckRow) => { const s = vals[r.key]; return s === undefined ? r.was : parseAmount(s); };
  const next = (): MoneyData => {
    const f = valueOf(rows[0]);
    return { ...mo.m, funds: f, lastCheck: mo.today, items: mo.m.items.map((i) => { const r = rows.find((x) => x.key === i.id); const v = r ? valueOf(r) : null; return v === null || !r ? i : { ...i, amount: v }; }) };
  };
  const nt = totals(next(), mo.set, mo.lotsValue).net;
  const delta = nt - (mo.m.log.length ? mo.m.log[mo.m.log.length - 1].net : mo.t.net);
  const commit = () => { if (!mo.on || skip) return; mo.write(next()); };
  const total = <div className="mny-ctot"><span>Net worth now</span><span>{fmt(nt)}{delta !== 0 && <span className={delta < 0 ? 'mny-dn' : 'mny-up'}> {delta < 0 ? '▼' : '▲'} {fmt(Math.abs(delta))}</span>}</span></div>;
  const fields = (phone: boolean, withTotal = true) => (
    <div className="mny-check">
      <div className="mny-sec" style={{ marginTop: 0 }}><span className="row" style={{ gap: 6 }}><Coins size={16} weight="duotone" /> Money check</span>
        <span className="r"><button type="button" className="link-btn" onClick={() => setSkip((s) => !s)}>{skip ? 'Do the money check' : 'Skip this time'}</button></span></div>
      {!skip && <>
        <div className={phone ? 'mny-crows' : 'mny-cgrid'}>
          {rows.map((r) => {
            const v = valueOf(r);
            const d = v !== null && r.was !== null ? v - r.was : 0;
            const dt = d !== 0 && <span className={(r.owe ? -d : d) < 0 ? 'mny-dn d' : 'mny-up d'}>{d > 0 ? '+' : '−'}{fmt(Math.abs(d))}</span>;
            return (
              <label key={r.key} className={`mny-cf${d ? ' ch' : ''}`}>
                <span className="l"><span className="tx">{r.label}</span>{dt}</span>
                <input className="mny-in" inputMode="decimal" value={vals[r.key] ?? ''} placeholder="§0" onChange={(e) => setVals((x) => ({ ...x, [r.key]: e.target.value }))}
                  onBlur={() => { const n = parseAmount(vals[r.key] ?? ''); if (n !== null) setVals((x) => ({ ...x, [r.key]: fmt(n) })); }} />
              </label>
            );
          })}
        </div>
        {rows.length === 1 && <p className="small muted" style={{ margin: '8px 0 0' }}>Add accounts and debts from the household’s Money details.</p>}
        {withTotal && total}
      </>}
    </div>
  );
  return { on: mo.on, skip, fields, total, commit, name: mo.name };
}

export function MoneyCheckDialog({ save, hhId, onClose }: { save: SaveRow; hhId: string; onClose(): void }) {
  const phone = useIsPhone();
  const mc = useMoneyCheck(save, hhId);
  const done = () => { mc.commit(); if (!mc.skip) toast('Money check saved'); onClose(); };
  return (
    <Pop phone={phone} title={`${mc.name} money check`} onClose={onClose}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={done}>Save</button></>}>
      {mc.fields(phone)}
    </Pop>
  );
}

// ---------- Sim profile ----------
/** A Sim's own money: their accounts and their share of joint ones. */
export function SimMoney({ save, simId, hhId, phone }: { save: SaveRow; simId: string; hhId: string | null; phone: boolean }) {
  const mo = useMoney(save, hhId);
  const [open, setOpen] = useState<null | 'details' | 'check' | 'add'>(null);
  if (!mo.on || !mo.memberIds.includes(simId)) return null;
  const items = visibleItems(mo.m, mo.set).filter((i) => i.owners.includes(simId));
  const net = simNet(mo.m, mo.set, simId);
  const ch = changeSince(mo.m.log, net, mo.today, simId);
  const body = (
    <>
      <div><span className="mny-nw">{fmt(net)}</span> <ClassTag classes={mo.set.classes} net={net} /></div>
      <div className="mny-meta">{ch && <><Change mo={mo} {...ch} /> · </>}{classLine(mo.set.classes, net)}</div>
      {items.length ? (
        <div style={{ marginTop: 8 }}>
          {byMod(items).map((b, bi) => (
            <div key={b.k}>{modTitle(b.k, mo.set.snb || mo.set.simfin) && <div className="mny-mod">{modTitle(b.k, mo.set.snb || mo.set.simfin)}</div>}
              {b.items.map((i, ii) => (
                <div key={i.id} className="mny-row static">
                  <span className="t">{itemTitle(i)}{i.owners.length > 1 && <small>Joint · their half of {fmt(i.amount)}</small>}</span>
                  <Amt v={shareOf(i, simId)} cur={bi === 0 && ii === 0} />
                </div>
              ))}
            </div>
          ))}
          <div className="mny-sub-total"><span>Net worth</span><Amt v={net} cur /></div>
        </div>
      ) : <p className="small muted" style={{ margin: '8px 0 0' }}>No accounts of their own yet. <button type="button" className="link-btn" onClick={() => setOpen('add')}>Add one</button></p>}
      <div className="small muted" style={{ marginTop: 8 }}>Part of the {mo.name}’s {fmt(mo.t.net)}</div>
    </>
  );
  const dialogs = <>
    {open === 'details' && <MoneyDetails save={save} hhId={mo.hhId} who={simId} onClose={() => setOpen(null)} onCheck={() => setOpen('check')} />}
    {open === 'check' && <MoneyCheckDialog save={save} hhId={mo.hhId} onClose={() => setOpen(null)} />}
    {open === 'add' && <ItemForm mo={mo} item={null} side="have" owner={simId} onClose={() => setOpen(null)} />}
  </>;
  if (phone) {
    return (
      <>
        <div className="m-label edit-label"><span>Money</span><button type="button" className="link-btn m-add" onClick={() => setOpen('details')}>Details <CaretRight size={14} weight="bold" /></button></div>
        <div className="m-group cp-pad mny-simcard">{body}</div>
        {dialogs}
      </>
    );
  }
  return (
    <section className="card mny-simcard">
      <div className="card-head"><h2><span className="obj households"><Coins size={16} weight="duotone" /></span>Money</h2>
        <button type="button" className="link-btn" onClick={() => setOpen('details')}>Details</button></div>
      {body}
      {dialogs}
    </section>
  );
}

// ---------- Save settings ----------
/** Wealth classes: names and where each starts. The first always starts at the bottom. */
export function ClassEditor({ value, onChange, anchor, phone, onClose }: { value: WealthClass[]; onChange(v: WealthClass[]): void; anchor: HTMLElement | null; phone: boolean; onClose(): void }) {
  const [rows, setRows] = useState(value.map((c) => ({ name: c.name, from: c.from ? fmt(c.from) : '' })));
  const commit = (next: typeof rows) => {
    setRows(next);
    const out = next.map((r, i) => ({ name: r.name.trim() || `Class ${i + 1}`, from: i === 0 ? 0 : parseAmount(r.from) ?? 0 }));
    onChange(out);
  };
  return (
    <RowPop anchor={anchor} title="Wealth classes" phone={phone} onClose={onClose} width={440}>
      {!phone && <h3 className="mny-pop-h">Wealth classes</h3>}
      <p className="small muted" style={{ margin: '0 0 10px' }}>Net worth picks the class. Saves as you type.</p>
      <div className="mny-ct">
        {rows.map((r, i) => (
          <div key={i} className="mny-ct-row">
            <input className="input" aria-label={`Class ${i + 1} name`} value={r.name} onChange={(e) => commit(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            {i === 0 ? <span className="small muted mny-ct-from">below {fmt(parseAmount(rows[1]?.from ?? '') ?? 0)}</span>
              : <input className="input r" inputMode="decimal" aria-label={`${r.name} starts at`} value={r.from} placeholder="from §0"
                onChange={(e) => commit(rows.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))}
                onBlur={() => { const n = parseAmount(r.from); if (n !== null) setRows(rows.map((x, j) => (j === i ? { ...x, from: fmt(n) } : x))); }} />}
          </div>
        ))}
      </div>
    </RowPop>
  );
}

/** The rows under Household funds in Save settings: one switch per mod, and wealth classes. */
export function FundsSettings({ save, phone, update }: { save: SaveRow; phone: boolean; update(p: { money: unknown }): void }) {
  const d = saveData(save);
  const set: MoneySettings = moneySettings((d as { money?: unknown }).money);
  const [editing, setEditing] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  if (!moduleOn(d, 'funds')) return null;
  const put = (p: Partial<MoneySettings>) => update({ money: { ...set, ...p } });
  const sw = (on: boolean, change: (v: boolean) => void, label: string) => <Toggle on={on} onChange={change} label={label} />;
  const rows = [
    { k: 'snb', title: 'SNB by SimRealist', sub: 'SNB accounts, loans, mortgages and Patron Plaque', right: sw(set.snb, (v) => put({ snb: v }), 'SNB by SimRealist') },
    { k: 'simfin', title: 'SimFinancial by adeepindigo', sub: 'Credit Union accounts, SimCo shares, loans and cards', right: sw(set.simfin, (v) => put({ simfin: v }), 'SimFinancial by adeepindigo') },
    { k: 'cls', title: 'Wealth classes', sub: `${set.classes.length} classes · ${set.classes[0]?.name} to ${set.classes[set.classes.length - 1]?.name}`,
      right: <button ref={btn} type="button" className="btn sm" onClick={() => setEditing(true)}><PencilSimple size={14} /> Edit</button> },
  ];
  return (
    <div className={phone ? 'mny-subm' : 'mny-sub'}>
      {rows.map((r) => (
        <div key={r.k} className={phone ? 'm-row mny-srow' : 'switch-row mny-srow'}>
          <div className="grow"><div style={{ fontWeight: 600 }}>{r.title}</div><div className="small muted" style={{ marginTop: 2 }}>{r.sub}</div></div>
          {r.right}
        </div>
      ))}
      {editing && <ClassEditor value={set.classes} onChange={(classes) => put({ classes })} anchor={btn.current} phone={phone} onClose={() => setEditing(false)} />}
    </div>
  );
}
