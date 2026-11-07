import { useMemo, useState } from 'react';
import { CaretRight, HouseSimple, Plus } from '@phosphor-icons/react';
import { BLANK_LOT } from '../../lib/lots';
import { Confirm, Modal, SearchBox, Sheet, TextInput, toast } from '../../components/ui';
import { householdLabel } from '../../lib/sims';
import { moveIn, type HH, type HomeOption } from '../../lib/households';
import { matches } from '../../lib/text';
import { useStore } from '../../lib/sync/react';
import { useIsPhone } from '../../lib/useIsPhone';
import { LotForm } from '../worlds/WorldsHome';
import { applyPlan, Faces, HhPill, useAptsInUse, type HhCtx } from './shared';

/** "Home for Rivera household": tap an empty home to move in; a taken one asks to move them out or merge. */
export function HomePicker({ ctx, hh, onClose }: { ctx: HhCtx; hh: HH; onClose(): void }) {
  const store = useStore();
  const phone = useIsPhone();
  const [q, setQ] = useState('');
  const [showTaken, setShowTaken] = useState(!phone);
  const [showApts, setShowApts] = useState(false);
  const inUse = useAptsInUse();
  const [asking, setAsking] = useState<{ o: HomeOption; them: HH } | null>(null);
  const [merging, setMerging] = useState<{ o: HomeOption; them: HH } | null>(null);
  const [adding, setAdding] = useState(false);
  const label = householdLabel(hh.data.name) || 'this household';
  const mine = hh.data.home ? ctx.homeOf(hh)?.key : null;
  const list = ctx.options.filter((o) => o.key !== mine && (!q.trim() || matches(o.title, q) || matches(ctx.whereOf(o), q)));
  const unusedApt = (o: HomeOption) => o.kind === 'apt' && !inUse.has(o.key.slice(4));
  const empty = list.filter((o) => !ctx.livesIn.has(o.key) && !unusedApt(o));
  const apts = list.filter((o) => !ctx.livesIn.has(o.key) && unusedApt(o));
  const aptsOpen = showApts || (!!q.trim() && apts.length > 0);
  const taken = list.filter((o) => ctx.livesIn.has(o.key));
  // The game's own lots in your worlds that you haven't placed a build on yet. Tap one: it becomes their home, already placed.
  const [showGame, setShowGame] = useState(false);
  const gameLots = useMemo(() => ctx.lots.info.avail.lots.filter((l) => !ctx.lots.bySpot.has(l.id) && !(l.locked && l.lotType && !l.lotType.startsWith('residential'))), [ctx.lots]);
  const gameShown = gameLots.filter((l) => !q.trim() || matches(l.name, q) || matches(ctx.lots.hoodName(l.world, l.neighborhood), q) || matches(ctx.lots.worldName(l.world), q));
  const gameOpen = showGame || (!!q.trim() && gameShown.length > 0);
  const gameGroups = useMemo(() => {
    const m = new Map<string, typeof gameShown>();
    for (const l of gameShown.slice(0, 60)) { const k = `${ctx.lots.worldName(l.world)} · ${ctx.lots.hoodName(l.world, l.neighborhood)}`; m.set(k, [...(m.get(k) ?? []), l]); }
    return [...m.entries()];
  }, [gameShown, ctx.lots]);
  const takeGameLot = (g: (typeof gameLots)[number]) => {
    const id = store.put('lot', { ...BLANK_LOT, name: g.name, type: 'residential', size: g.size, spot: g.id });
    const home = { kind: 'lot' as const, id, unit: null };
    applyPlan(store, moveIn({ ...state(), lots: [...ctx.owned, { id, type: 'residential', owner: null }] }, hh.id, home));
    toast(`${label} moved into ${g.name}`);
    onClose();
  };
  const state = () => ({ households: ctx.households, lots: ctx.owned, sims: ctx.sims.map((s) => ({ id: s.id, householdId: s.sim.householdId })) });

  const moveTo = (o: HomeOption) => {
    applyPlan(store, moveIn(state(), hh.id, o.home));
    toast(`${label} moved into ${o.title}`);
    onClose();
  };
  const pick = (o: HomeOption) => {
    const them = ctx.livesIn.get(o.key);
    if (them) setAsking({ o, them }); else moveTo(o);
  };

  const sub = (o: HomeOption) => {
    const where = ctx.whereOf(o);
    if (o.kind === 'unit' && o.landlord) return <>{where} · Rent from <HhPill name={ctx.nameOf(o.landlord)} /></>;
    if (o.kind === 'apt') return `${where} · Apartment`;
    return [where, o.size].filter(Boolean).join(' · ');
  };
  const opt = (o: HomeOption) => (
    <button key={o.key} type="button" className="hp-opt" onClick={() => pick(o)}>
      <span className="grow"><b>{o.title}</b><span className="s">{sub(o)}</span></span>
      <CaretRight size={16} weight="bold" className="chev" />
    </button>
  );
  const body = (
    <div className="hp-body">
      <SearchBox value={q} onChange={setQ} placeholder="Search homes, streets and game lots" />
      <div className="hp-grp">Empty · {empty.length}</div>
      {empty.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{q.trim() ? 'None of your lots match that.' : 'None of your lots are empty.'}</p> : empty.map(opt)}
      {gameLots.length > 0 && (
        <>
          <button type="button" className="hp-toggle" onClick={() => setShowGame((v) => !v)} aria-expanded={gameOpen}>
            <span>Lots from your worlds · {q.trim() ? gameShown.length : gameLots.length}</span><span>{gameOpen ? 'Hide' : 'Show'}</span>
          </button>
          {gameOpen && gameGroups.map(([where, list]) => (
            <div key={where} className="hp-game">
              <div className="hp-grp">{where}</div>
              {list.map((g) => (
                <button key={g.id} type="button" className="hp-opt" onClick={() => takeGameLot(g)}>
                  <span className="obj worlds" aria-hidden="true"><HouseSimple size={16} weight="duotone" /></span>
                  <span className="grow"><b>{g.name}</b><span className="s">{g.size}</span></span>
                  <CaretRight size={16} weight="bold" className="chev" />
                </button>
              ))}
            </div>
          ))}
          {gameOpen && gameShown.length > 60 && <p className="muted small" style={{ margin: 0 }}>Type to narrow it down.</p>}
          {gameOpen && <p className="muted small" style={{ margin: 0 }}>Picking a game lot adds it as their home, placed on the map. Name, type and build can be filled in later.</p>}
        </>
      )}
      {apts.length > 0 && (
        <>
          <button type="button" className="hp-toggle" onClick={() => setShowApts((v) => !v)} aria-expanded={aptsOpen}>
            <span>Apartments not in use · {apts.length}</span><span>{aptsOpen ? 'Hide' : 'Show'}</span>
          </button>
          {aptsOpen && apts.map(opt)}
        </>
      )}
      {taken.length > 0 && (
        <>
          <button type="button" className="hp-toggle" onClick={() => setShowTaken((v) => !v)} aria-expanded={showTaken}>
            <span>Taken · {taken.length}</span><span>{showTaken ? 'Hide' : 'Show'}</span>
          </button>
          {showTaken && taken.map((o) => (
            <button key={o.key} type="button" className="hp-taken" onClick={() => pick(o)}>
              <span className="grow">{o.title}</span><HhPill name={ctx.nameOf(ctx.livesIn.get(o.key)!.id)} />
            </button>
          ))}
        </>
      )}
      {phone && <button type="button" className="btn ghost hp-add" onClick={() => setAdding(true)}><Plus size={15} weight="bold" /> Add a new lot</button>}
    </div>
  );
  const them = asking && householdLabel(asking.them.data.name);
  const dialogs = (
    <>
      {asking && (
        <Confirm title={`${them} lives here`}
          text={`Merge the two households, or move the ${asking.them.data.name.trim() || 'others'} out? Moving them out leaves them with no home, and they won’t own it anymore.`}
          onCancel={() => setAsking(null)}
          actions={[
            { label: 'Cancel', run: () => setAsking(null) },
            { label: 'Move them out', run: () => { const a = asking; setAsking(null); applyPlan(store, moveIn(state(), hh.id, a.o.home, 'out')); toast(`${them} moved out. ${label} moved in.`); onClose(); } },
            { label: 'Merge', kind: 'primary', run: () => { setMerging(asking); setAsking(null); } },
          ]} />
      )}
      {merging && <MergeModal ctx={ctx} mover={hh} into={merging.them} onBack={() => setMerging(null)}
        onMerge={(name) => { applyPlan(store, moveIn(state(), hh.id, merging.o.home, 'merge', name)); toast(`Merged into ${householdLabel(name)}`); onClose(); }} />}
      {adding && <LotForm ctx={ctx.lots} lotId={null} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />}
    </>
  );

  if (phone) return <Sheet title={`Home for ${hh.data.name.trim() || 'this household'}`} onClose={onClose}>{body}{dialogs}</Sheet>;
  return (
    <Modal title={`Home for ${label}`} onClose={onClose} autoFocus={false} className="pinned"
      footer={(close) => <><button type="button" className="btn ghost" style={{ marginRight: 'auto', color: 'var(--accent)' }} onClick={() => setAdding(true)}><Plus size={15} weight="bold" /> Add a new lot</button><button type="button" className="btn" onClick={close}>Cancel</button></>}>
      {body}{dialogs}
    </Modal>
  );
}

/** Pick which name the merged household keeps, or type a new one. */
function MergeModal({ ctx, mover, into, onBack, onMerge }: { ctx: HhCtx; mover: HH; into: HH; onBack(): void; onMerge(name: string): void }) {
  const [pick, setPick] = useState<'into' | 'mover' | 'new'>('into');
  const [typed, setTyped] = useState('');
  const sims = [...ctx.membersOf(into.id), ...ctx.membersOf(mover.id)];
  const home = ctx.homeOf(into);
  const name = pick === 'into' ? into.data.name : pick === 'mover' ? mover.data.name : typed.trim();
  const opt = (v: typeof pick, text: string) => (
    <label className={`hp-radio ${pick === v ? 'on' : ''}`}>
      <input type="radio" name="merge-name" checked={pick === v} onChange={() => setPick(v)} />
      <b>{text}</b>
    </label>
  );
  return (
    <Modal title="Merge households" onClose={onBack} autoFocus={false}
      footer={<><button type="button" className="btn" onClick={onBack}>Back</button><button type="button" className="btn primary" disabled={!name} onClick={() => onMerge(name)}>Merge</button></>}>
      <div className="stack" style={{ gap: 10 }}>
        <Faces sims={sims} size={40} max={8} />
        <div className="muted small">{sims.length} {sims.length === 1 ? 'Sim' : 'Sims'}{home ? ` · ${home.title}` : ''}</div>
        <div className="hp-grp">Household name</div>
        {opt('into', householdLabel(into.data.name) || 'Unnamed')}
        {opt('mover', householdLabel(mover.data.name) || 'Unnamed')}
        {opt('new', 'New name')}
        {pick === 'new' && <TextInput kind="name" autoFocus placeholder="Household name, like Okafor" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={40} aria-label="New household name" />}
      </div>
    </Modal>
  );
}
