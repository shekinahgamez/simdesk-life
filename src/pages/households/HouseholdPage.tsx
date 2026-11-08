import { useEffect, useRef, useState } from 'react';
import { DotsThree, HouseSimple, MapPin, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { PhotoBox } from '../../components/photo';
import { BackLink } from '../../components/Shell';
import { AutoText, Confirm, Modal, Picker, toast } from '../../components/ui';
import { homeLot, type HH } from '../../lib/households';
import { APARTMENT, lotTypeName } from '../../lib/lots';
import { birthdayCell, fullName, householdLabel, initials, simAge, stageLabel, stageOf, type SimData } from '../../lib/sims';
import { go, savePath } from '../../lib/router';
import { plural } from '../../lib/text';
import { useStore } from '../../lib/sync/react';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { SimForm } from '../sims/SimForm';
import { useBirthdayView } from '../sims/shared';
import { HomePicker } from './HomePicker';
import { ComingUp } from '../calendar/shared';
import { NewHousehold } from './HouseholdsList';
import { HhPill, useHhCtx, type HhCtx } from './shared';
import { HouseholdRotation } from '../rotation/Rotation';
import { MoneyCard, MoneyStrip, useSimNet } from '../money/Money';

/** One household: its Sims, the lots it lives on and owns, and notes. */
export function HouseholdPage({ save, hhId }: { save: SaveRow; hhId: string }) {
  const ctx = useHhCtx(save);
  const store = useStore();
  const phone = useIsPhone();
  const [view] = useBirthdayView();
  const [dialog, setDialog] = useState<null | 'home' | 'rename' | 'sim' | 'movein' | 'own' | 'delete'>(null);
  const net = useSimNet(save, hhId);
  const hh = ctx.byId.get(hhId);
  const back = savePath(save.id, 'households');
  if (!hh) return <div className="page"><p>That household isn’t here anymore.</p><a className="btn" href={back}>Back to Households</a></div>;

  const info = ctx.lots.info;
  const members = ctx.membersOf(hh.id);
  const home = ctx.homeOf(hh);
  const homeLotId = homeLot(hh.data.home);
  const ownedOthers = ctx.own.filter((r) => r.lot.owner === hh.id && r.id !== homeLotId);
  const label = householdLabel(hh.data.name) || 'Unnamed';
  const world = home ? ctx.lots.worldName(home.world) : '';
  const sub = [plural(members.length, 'Sim'), world].filter(Boolean).join(' · ');
  const update = (p: Partial<HH['data']>) => { const cur = store.get(hh.id); if (cur) store.put('household', { ...cur.data, ...p }, hh.id); };
  const setOwner = (lotId: string, owner: string | null) => { const cur = store.get(lotId); if (cur) store.put('lot', { ...cur.data, owner }, lotId); };
  const unown = (lotId: string, name: string) => {
    setOwner(lotId, null);
    toast(`${label} doesn’t own ${name} anymore`, { label: 'Undo', run: () => setOwner(lotId, hh.id) });
  };
  const lotHref = (id: string) => savePath(save.id, `worlds/lot/${id}`);
  const homeHref = home ? (home.lotId ? lotHref(home.lotId) : savePath(save.id, `worlds/apt/${home.key.slice(4)}`)) : '';
  const ownsHome = !!homeLotId && ctx.own.some((r) => r.id === homeLotId && r.lot.owner === hh.id);

  const tiles = (
    <div className="hh-tiles">
      {members.map((s) => {
        const age = simAge(s.sim, info.today, info.table, info.track);
        const b = birthdayCell(age, info.cal, view, false);
        return (
          <a key={s.id} className="hh-tile" href={savePath(save.id, `sims/${s.id}`)}>
            <Tile sim={s.sim} />
            <b>{s.sim.first || fullName(s.sim)}</b>
            <span>{stageLabel(stageOf(age))}{b?.soon && <> · <span className="bd">bday {b.text}</span></>}</span>
          </a>
        );
      })}
      {members.length === 0 && <p className="muted small" style={{ margin: 0 }}>No Sims yet.</p>}
    </div>
  );
  const homeRow = home ? (
    <a className="hh-lot" href={homeHref}>
      <span className="obj worlds"><HouseSimple size={18} weight="duotone" /></span>
      <span className="grow"><b>{home.title}</b><span className="s">{ctx.whereOf(home)}</span></span>
      <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span className="tag outline-soft">Live here</span>{ownsHome && <span className="tag outline-soft">Own</span>}</span>
    </a>
  ) : (
    <div className="hh-lot"><span className="obj worlds"><HouseSimple size={18} weight="duotone" /></span><span className="grow muted">No home yet</span></div>
  );
  const lotsCard = (
    <div className="card">
      <div className="card-head"><h2>Lots</h2><button type="button" className="btn ghost sm" style={{ color: 'var(--accent)' }} onClick={() => setDialog('own')}><Plus size={14} weight="bold" /> Add</button></div>
      <div className="hh-lots">
        {homeRow}
        {ownedOthers.map((r) => (
          <div key={r.id} className="hh-lot">
            <a className="row grow" style={{ gap: 12, flexWrap: 'nowrap', color: 'inherit', textDecoration: 'none', minWidth: 0 }} href={lotHref(r.id)}>
              <span className="obj worlds"><MapPin size={18} weight="duotone" /></span>
              <span className="grow"><b>{r.lot.name}</b><span className="s">{lotTypeLine(ctx, r.id)}</span></span>
              <span className="tag outline-soft">Own</span>
            </a>
            <button type="button" className="btn ghost icon sm" aria-label={`${label} doesn’t own ${r.lot.name}`} onClick={() => unown(r.id, r.lot.name)}><X size={15} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 12 }} onClick={() => setDialog('home')}>{home ? 'Move to a new home' : 'Pick a home'}</button>
    </div>
  );
  // Desktop: Sims as rows with each Sim's net worth, and a lots card with one dashed row when there is no home.
  const simRows = (
    <div className="hh-rows">
      {members.map((s) => {
        const age = simAge(s.sim, info.today, info.table, info.track);
        const b = birthdayCell(age, info.cal, view, false);
        return (
          <a key={s.id} className="hh-srow" href={savePath(save.id, `sims/${s.id}`)}>
            <Tile sim={s.sim} />
            <span className="grow"><b>{s.sim.first || fullName(s.sim)}</b><span className="s">{stageLabel(stageOf(age))}{b?.soon && <> · <span className="bd">bday {b.text}</span></>}</span></span>
            {net && <span className="hh-net">{net[s.id]}</span>}
          </a>
        );
      })}
      {members.length === 0 && <p className="muted small" style={{ margin: 0 }}>No Sims yet.</p>}
    </div>
  );
  const lotsCardDesktop = (
    <div className="card">
      <div className="card-head"><h2>Home and lots</h2><button type="button" className="btn ghost sm" style={{ color: 'var(--accent)' }} onClick={() => setDialog('own')}><Plus size={14} weight="bold" /> Add lot</button></div>
      {home ? <div className="hh-lots">{homeRow}{ownedOthers.map((r) => (
        <div key={r.id} className="hh-lot">
          <a className="row grow" style={{ gap: 12, flexWrap: 'nowrap', color: 'inherit', textDecoration: 'none', minWidth: 0 }} href={lotHref(r.id)}>
            <span className="obj worlds"><MapPin size={18} weight="duotone" /></span>
            <span className="grow"><b>{r.lot.name}</b><span className="s">{lotTypeLine(ctx, r.id)}</span></span>
            <span className="tag outline-soft">Own</span>
          </a>
          <button type="button" className="btn ghost icon sm" aria-label={`${label} doesn’t own ${r.lot.name}`} onClick={() => unown(r.id, r.lot.name)}><X size={15} /></button>
        </div>))}
      </div> : <>
        {ownedOthers.length > 0 && <div className="hh-lots" style={{ marginBottom: 10 }}>{ownedOthers.map((r) => (
          <div key={r.id} className="hh-lot">
            <a className="row grow" style={{ gap: 12, flexWrap: 'nowrap', color: 'inherit', textDecoration: 'none', minWidth: 0 }} href={lotHref(r.id)}>
              <span className="obj worlds"><MapPin size={18} weight="duotone" /></span>
              <span className="grow"><b>{r.lot.name}</b><span className="s">{lotTypeLine(ctx, r.id)}</span></span>
              <span className="tag outline-soft">Own</span>
            </a>
            <button type="button" className="btn ghost icon sm" aria-label={`${label} doesn’t own ${r.lot.name}`} onClick={() => unown(r.id, r.lot.name)}><X size={15} /></button>
          </div>))}</div>}
        <button type="button" className="hh-pick" onClick={() => setDialog('home')}><HouseSimple size={18} weight="duotone" /> Pick a home</button>
      </>}
      {home && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 12 }} onClick={() => setDialog('home')}>Move to a new home</button>}
    </div>
  );
  const notes = <AutoText label="Notes" value={hh.data.notes} onSave={(n) => update({ notes: n })} placeholder="Anything worth remembering…" rows={3} />;
  const dialogs = (
    <>
      {dialog === 'home' && <HomePicker ctx={ctx} hh={hh} onClose={() => setDialog(null)} />}
      {dialog === 'rename' && <NewHousehold id={hh.id} start={hh.data.name} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />}
      {dialog === 'sim' && <SimForm info={info} simId={null} householdId={hh.id} onClose={() => setDialog(null)} onSaved={(_, another) => { if (!another) setDialog(null); }} />}
      {dialog === 'movein' && <MoveSimsIn ctx={ctx} hh={hh} onClose={() => setDialog(null)} />}
      {dialog === 'own' && <OwnLot ctx={ctx} hh={hh} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <Confirm title={`Delete ${label}?`} text="Its Sims stay, with no household. It goes to Trash for 7 days." onCancel={() => setDialog(null)}
          actions={[{ label: 'Keep it', run: () => setDialog(null) }, { label: 'Delete', kind: 'danger', run: () => { setDialog(null); go(back); store.moveToTrash(hh.id, label); } }]} />
      )}
    </>
  );
  const moveInBtn = <button type="button" className="btn ghost sm" style={{ color: 'var(--accent)' }} onClick={() => setDialog('movein')}>Move Sims in</button>;

  if (phone) {
    return (
      <div className="m-stack">
        <BackLink href={back} label="Households" />
        <h1 className="m-h1">{label}</h1>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn sm" onClick={() => setDialog('sim')}><Plus size={14} weight="bold" /> New Sim</button>
          {moveInBtn}
          <button type="button" className="btn ghost icon sm" aria-label="Edit household" onClick={() => setDialog('rename')}><PencilSimple size={16} /></button>
          <HhMore onDelete={() => setDialog('delete')} />
        </div>
        <HouseholdRotation save={save} hhId={hh.id} />
        <MoneyStrip save={save} hhId={hh.id} />
        {tiles}
        <ComingUp save={save} simIds={members.map((m) => m.id)} seeAll={`calendar/household/${hh.id}`} showFaces />
        {lotsCard}
        <div className="card"><div className="card-head"><h2>Notes</h2></div>{notes}</div>
        {dialogs}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="crumbs"><a href={back}>Households</a> / {label}</div>
      <div className="page-head">
        <div><h1>{label}</h1><div className="sub">{sub}</div></div>
        <div className="row">
          <button type="button" className="btn" onClick={() => setDialog('movein')}>Move Sims in</button>
          <HhMore onEdit={() => setDialog('rename')} onDelete={() => setDialog('delete')} />
          <button type="button" className="btn primary" onClick={() => setDialog('sim')}><Plus size={18} weight="bold" /> New Sim</button>
        </div>
      </div>
      <HouseholdRotation save={save} hhId={hh.id} />
      <div className="hh-grid">
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <div className="card hh-simscard">
            <div className="card-head"><h2>Sims</h2>{net && <span className="small muted">Net worth</span>}</div>
            {simRows}
          </div>
          <div className="card hh-notescard"><div className="card-head"><h2>Notes</h2></div>{notes}</div>
        </div>
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <MoneyCard save={save} hhId={hh.id} compact />
          <ComingUp save={save} simIds={members.map((m) => m.id)} seeAll={`calendar/household/${hh.id}`} showFaces compact />
          {lotsCardDesktop}
        </div>
      </div>
      {dialogs}
    </div>
  );
}

function lotTypeLine(ctx: HhCtx, lotId: string) {
  const r = ctx.own.find((x) => x.id === lotId);
  if (!r) return '';
  const t = lotTypeName(r.lot.type);
  return [t, r.spot ? ctx.lots.worldName(r.world) : 'Not placed'].filter(Boolean).join(' · ');
}

function Tile({ sim }: { sim: SimData }) {
  return sim.portrait
    ? <PhotoBox photo={sim.portrait} aspect={1} size="thumb" className="hh-tile-img" />
    : <span className="hh-tile-img initials">{initials(sim)}</span>;
}

/** Pick Sims from other households (or none) to join this one. */
function MoveSimsIn({ ctx, hh, onClose }: { ctx: HhCtx; hh: HH; onClose(): void }) {
  const store = useStore();
  const [picked, setPicked] = useState<string[]>([]);
  const options = ctx.sims.filter((s) => s.sim.householdId !== hh.id && !s.sim.deceased)
    .map((s) => ({ id: s.id, label: fullName(s.sim), group: s.sim.householdId ? householdLabel(ctx.nameOf(s.sim.householdId)) : 'No household' }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  const save = () => {
    for (const id of picked) { const cur = store.get(id); if (cur) store.put('sim', { ...cur.data, householdId: hh.id }, id); }
    toast(`${plural(picked.length, 'Sim')} moved in`);
    onClose();
  };
  return (
    <Modal title={`Move Sims into ${householdLabel(hh.data.name)}`} onClose={onClose} dirty={picked.length > 0}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!picked.length} onClick={save}>Move in</button></>}>
      {options.length === 0 ? <p className="muted" style={{ margin: 0 }}>Every Sim already lives here.</p>
        : <Picker multiple options={options} value={picked} onChange={setPicked} placeholder="Type a Sim’s name" />}
    </Modal>
  );
}

/** Add a lot this household owns. Taking one another household owns asks first. */
function OwnLot({ ctx, hh, onClose }: { ctx: HhCtx; hh: HH; onClose(): void }) {
  const store = useStore();
  const [asking, setAsking] = useState<{ id: string; name: string; other: string } | null>(null);
  const label = householdLabel(hh.data.name);
  const list = ctx.own.filter((r) => r.lot.owner !== hh.id && r.lot.type !== APARTMENT)
    .sort((a, b) => a.lot.name.localeCompare(b.lot.name));
  const take = (id: string, name: string) => {
    const cur = store.get(id);
    if (cur) store.put('lot', { ...cur.data, owner: hh.id }, id);
    toast(`${label} owns ${name}`);
    onClose();
  };
  return (
    <Modal title={`Lots ${label} owns`} onClose={onClose} autoFocus={false}
      footer={(close) => <button type="button" className="btn" onClick={close}>Cancel</button>}>
      <div className="hp-body">
        {list.length === 0 ? <p className="muted" style={{ margin: 0 }}>They own every lot you have.</p> : list.map((r) => (
          <button key={r.id} type="button" className="hp-opt" onClick={() => (r.lot.owner && ctx.byId.has(r.lot.owner) ? setAsking({ id: r.id, name: r.lot.name, other: r.lot.owner }) : take(r.id, r.lot.name))}>
            <span className="grow"><b>{r.lot.name}</b><span className="s">{lotTypeLine(ctx, r.id)}</span></span>
            {r.lot.owner && ctx.byId.has(r.lot.owner) && <HhPill name={ctx.nameOf(r.lot.owner)} />}
          </button>
        ))}
      </div>
      {asking && (
        <Confirm title={`${householdLabel(ctx.nameOf(asking.other))} owns ${asking.name}`} text={`Make ${label} the owner instead?`} onCancel={() => setAsking(null)}
          actions={[{ label: 'Cancel', run: () => setAsking(null) }, { label: 'Make them the owner', kind: 'primary', run: () => take(asking.id, asking.name) }]} />
      )}
    </Modal>
  );
}

/** The ⋯ menu on a household (Delete lives here, like on a Sim). */
function HhMore({ onDelete, onEdit }: { onDelete(): void; onEdit?(): void }) {
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
  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn icon hh-more-btn" aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((x) => !x)}><DotsThree size={20} weight="bold" /></button>
      {open && (
        <div className="combo-list more-menu" role="menu" style={{ right: 0, left: 'auto' }}>
          {onEdit && <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }}><PencilSimple size={16} weight="duotone" /> Edit household</button>}
          <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onDelete(); }}><Trash size={16} weight="duotone" /> Delete household</button>
        </div>
      )}
    </span>
  );
}
