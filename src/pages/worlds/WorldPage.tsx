import { useMemo, useState } from 'react';
import { CaretDown, CaretRight, PencilSimple, Plus } from '@phosphor-icons/react';
import { BY_ID, type GameLot } from '../../data/game';
import { BackLink } from '../../components/Shell';
import { Confirm, Field, Modal, TextInput, toast } from '../../components/ui';
import { APARTMENT, BLANK_LOT, fitOf, lotData, lotTypeName, spotsOf, BLANK_WORLD, type LotRow } from '../../lib/lots';
import { MoreApts, useAptsInUse, useHouseholdCell } from '../households/shared';
import { go, savePath } from '../../lib/router';
import { useStore } from '../../lib/sync/react';
import { plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { LotForm } from './WorldsHome';
import { applyPlace, useLotsCtx, WorldPicture, type LotsCtx } from './shared';

/** One world: its scene, then every lot in it by neighborhood (the game's lots, with yours on them). */
export function WorldPage({ save, worldId }: { save: SaveRow; worldId: string }) {
  const ctx = useLotsCtx(save);
  const phone = useIsPhone();
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [spotMenu, setSpotMenu] = useState<GameLot | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  // Phone: neighborhoods with nothing filled start folded.
  const [hoodOpen, setHoodOpen] = useState<Record<string, boolean>>({});
  const game = BY_ID.worlds.get(worldId);
  const spots = useMemo(() => spotsOf(ctx.info.avail, worldId), [ctx.info.avail, worldId]);
  const apts = ctx.apartments.filter((a) => a.world === worldId);
  const hoods = useMemo(() => {
    const m = new Map<string, GameLot[]>();
    for (const s of spots) m.set(s.neighborhood || 'Other', [...(m.get(s.neighborhood || 'Other') ?? []), s]);
    return [...m.entries()].sort((a, b) => (a[0] === 'Other' ? 1 : b[0] === 'Other' ? -1 : a[0].localeCompare(b[0])))
      .map(([name, list]) => ({ name, list: list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) }));
  }, [spots]);
  if (!game || !ctx.worlds.some((w) => w.id === worldId)) {
    return <div className="page"><p>That world isn’t in this save.</p><a className="btn" href={savePath(save.id, 'worlds')}>Back to Worlds &amp; lots</a></div>;
  }
  const w = ctx.world(worldId);
  const name = ctx.worldName(worldId);
  const pack = BY_ID.packs.get(game.pack)?.name ?? '';
  const inUse = spots.filter((s) => ctx.bySpot.has(s.id)).length;
  const putWorld = (patch: Partial<typeof BLANK_WORLD>) => {
    const rec = ctx.recOfWorld.get(worldId);
    store.put('world', { ...BLANK_WORLD, ...(rec?.data ?? {}), gameId: worldId, ...patch }, rec?.id);
  };
  const openSpot = (s: GameLot) => { const r = ctx.bySpot.get(s.id); if (r) go(savePath(save.id, `worlds/lot/${r.id}`)); else setSpotMenu(s); };
  const sub = [w.name.trim() && w.name.trim() !== game.name ? game.name : '', pack, plural(spots.length, 'lot'), `${inUse} in use`].filter(Boolean).join(' · ');

  const banner = (
    <div className="world-banner">
      <WorldPicture worldId={worldId} className="world-banner-pic" banner />
      <div className="world-banner-name"><h1>{name}</h1><div className="sub">{sub}</div></div>
      <button type="button" className="btn fog sm world-banner-edit" onClick={() => setEditing(true)}><PencilSimple size={16} /> Edit</button>
    </div>
  );
  const cards = (
    <div className="hood-cols">
      {hoods.map((h) => {
        const placed = h.list.filter((s) => ctx.bySpot.has(s.id)).length;
        const open = !phone || (hoodOpen[h.name] ?? placed > 0);
        return (
          <section key={h.name} className={`card hood-card${phone ? ' hood-fold' : ''}${open ? '' : ' folded'}`}>
            <HoodHead game={h.name} name={ctx.hoodName(worldId, h.name)} editing={renaming === h.name} canRename={h.name !== 'Other'}
              count={`${placed} of ${h.list.length} filled`}
              fold={phone ? { open, toggle: () => setHoodOpen((m) => ({ ...m, [h.name]: !open })) } : undefined} onEdit={() => setRenaming(h.name)} onCancel={() => setRenaming(null)}
              onSave={(v) => { putWorld({ hoodNames: { ...w.hoodNames, [h.name]: v === h.name ? '' : v } }); setRenaming(null); toast('Saved'); }} />
            {open && <div className="hood-rows">
              {h.list.map((s) => {
                const r = ctx.bySpot.get(s.id);
                return r ? (
                  <button key={s.id} type="button" className="hood-row placed" onClick={() => openSpot(s)}>
                    <span className="grow"><b>{r.lot.name}</b><span className="muted small">On {s.name}{s.size && ` · ${s.size}`}</span></span>
                    <span className="tag lot-type">{lotTypeName(r.lot.type)}</span>
                  </button>
                ) : (
                  <button key={s.id} type="button" className="hood-row open" onClick={() => openSpot(s)} aria-label={`${s.name}, empty lot`}>
                    <span className="grow"><span className="open-name">{s.name}</span><span className="small">Empty{s.size && ` · ${s.size}`}</span></span>
                    <span className="open-add" title="Place a lot"><Plus size={14} weight="bold" aria-hidden="true" /></span>
                  </button>
                );
              })}
            </div>}
          </section>
        );
      })}
    </div>
  );
  const dialogs = (
    <>
      {editing && <EditWorld name={w.name} gameName={game.name} inspiredBy={w.inspiredBy} vibe={w.vibe} onClose={() => setEditing(false)}
        onSave={(p) => { putWorld(p); setEditing(false); toast('Saved'); }} />}
      {spotMenu && <SpotMenu ctx={ctx} spot={spotMenu} onClose={() => setSpotMenu(null)} />}
    </>
  );
  const vibe = w.vibe && <p className="world-vibe">{w.inspiredBy && <b>Inspired by {w.inspiredBy}. </b>}{w.vibe}</p>;

  if (phone) {
    return (
      <div className="m-stack">
        <BackLink href={savePath(save.id, 'worlds')} label="Worlds & lots" />
        {banner}
        {vibe}
        {cards}
        {apts.length > 0 && <AptGroup ctx={ctx} save={save} apts={apts} phone />}
        {dialogs}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="crumbs"><a href={savePath(save.id, 'worlds')}>Worlds &amp; lots</a> / {name}</div>
      {banner}
      {vibe}
      {cards}
      {apts.length > 0 && <AptGroup ctx={ctx} save={save} apts={apts} />}
      {dialogs}
    </div>
  );
}

function AptGroup({ ctx, save, apts: every, phone }: { ctx: LotsCtx; save: SaveRow; apts: GameLot[]; phone?: boolean }) {
  const hhCell = useHouseholdCell();
  const inUse = useAptsInUse();
  const [more, setMore] = useState(false);
  if (!every.length) return null;
  const unused = every.filter((a) => !inUse.has(a.id));
  const apts = [...every.filter((a) => inUse.has(a.id)), ...(more ? unused : [])];
  const fold = <MoreApts count={unused.length} open={more} onToggle={() => setMore((v) => !v)} label="Not in use" />;
  const open = (a: GameLot) => go(savePath(save.id, `worlds/apt/${a.id}`));
  if (phone) {
    return (
      <>
        <div className="m-label">Apartments · {every.length - unused.length} in use</div>
        {apts.length > 0 && <div className="m-group">
          {apts.map((a) => (
            <button key={a.id} type="button" className="m-row" onClick={() => open(a)}>
              <span className="grow"><span className="t" style={{ display: 'block' }}>{a.name}</span><span className="s" style={{ display: 'block' }}>{[ctx.hoodName(a.world, a.neighborhood), ctx.bySpot.get(a.id)?.lot.name].filter(Boolean).join(' · ')}</span></span>
            </button>
          ))}
        </div>}
        {fold}
      </>
    );
  }
  return (
    <>
      <h2 className="section-h">Apartments <span className="muted small">{every.length - unused.length} in use</span></h2>
      {apts.length > 0 && <div className="table-wrap">
        <table className="table world-lots">
          <thead><tr><th>Apartment</th><th>Neighborhood</th><th>Using</th><th>Lives here</th></tr></thead>
          <tbody>
            {apts.map((a) => (
              <tr key={a.id} tabIndex={0} onClick={() => open(a)} onKeyDown={(e) => e.key === 'Enter' && open(a)}>
                <td><b className="cell-main">{a.name}</b></td><td>{ctx.hoodName(a.world, a.neighborhood)}</td><td>{ctx.bySpot.get(a.id)?.lot.name ?? ''}</td><td>{hhCell({ id: `apt:${a.id}`, lot: { ...BLANK_LOT, type: APARTMENT, spot: a.id } })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {fold}
    </>
  );
}

/** A neighborhood card's heading. The pencil renames it (your name; the game's name stays as a hint). */
function HoodHead({ game, name, count, fold, editing, canRename, onEdit, onCancel, onSave }: {
  game: string; name: string; count: string; fold?: { open: boolean; toggle(): void }; editing: boolean; canRename: boolean; onEdit(): void; onCancel(): void; onSave(v: string): void;
}) {
  const [v, setV] = useState(name);
  if (editing) {
    return (
      <header className="hood-edit">
        <form className="row" style={{ gap: 8, flexWrap: 'nowrap', width: '100%' }} onSubmit={(e) => { e.preventDefault(); onSave(v.trim() || game); }}>
          <TextInput autoFocus aria-label="Neighborhood name" value={v} placeholder={game} maxLength={50} onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} style={{ flex: 1, minWidth: 0 }} />
          <button type="submit" className="btn primary sm">Save</button>
          <button type="button" className="btn ghost sm" onClick={onCancel}>Cancel</button>
        </form>
        <span className="hood-game small muted">Game name: {game}</span>
      </header>
    );
  }
  return (
    <header>
      {fold && <button type="button" className="hood-caret" aria-expanded={fold.open} aria-label={`${fold.open ? 'Fold' : 'Open'} ${name}`} onClick={fold.toggle}>
        {fold.open ? <CaretDown size={20} weight="bold" /> : <CaretRight size={20} weight="bold" />}
      </button>}
      <h2>{name}{canRename && <button type="button" className="hood-pencil" aria-label={`Rename ${name}`} title="Rename" onClick={() => { setV(name); onEdit(); }}><PencilSimple size={18} /></button>}</h2>
      <span className="hood-count">{count}</span>
    </header>
  );
}

function EditWorld({ name, gameName, inspiredBy, vibe, onClose, onSave }: {
  name: string; gameName: string; inspiredBy: string; vibe: string; onClose(): void; onSave(p: { name: string; inspiredBy: string; vibe: string }): void;
}) {
  const [f, setF] = useState({ name, inspiredBy, vibe });
  const dirty = f.name !== name || f.inspiredBy !== inspiredBy || f.vibe !== vibe;
  return (
    <Modal title={`Edit ${name.trim() || gameName}`} onClose={onClose} dirty={dirty}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={() => onSave({ name: f.name.trim(), inspiredBy: f.inspiredBy.trim(), vibe: f.vibe.trim() })}>Save</button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <Field label="Your name for this world" hint={`In the game it’s ${gameName}.`}>{(id) => <TextInput id={id} value={f.name} placeholder={gameName} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={50} />}</Field>
        <Field label="Inspired by">{(id) => <TextInput id={id} value={f.inspiredBy} placeholder="New Orleans" onChange={(e) => setF({ ...f, inspiredBy: e.target.value })} maxLength={60} />}</Field>
        <Field label="Vibe notes">{(id) => <textarea id={id} className="textarea" rows={3} value={f.vibe} placeholder="Humid and musical. Porches everywhere." onChange={(e) => setF({ ...f, vibe: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
}

/** Tapping an empty lot: put one of your lots here, or add a new one. */
function SpotMenu({ ctx, spot, onClose }: { ctx: LotsCtx; spot: GameLot; onClose(): void }) {
  const store = useStore();
  const [step, setStep] = useState<'menu' | 'pick' | 'new'>('menu');
  const [big, setBig] = useState<LotRow | null>(null);
  const candidates = ctx.rows.filter((r) => !r.spot && r.lot.type !== 'apartment')
    .map((r) => ({ r, fit: fitOf(r.lot.size, spot.size) }))
    .sort((a, b) => (a.fit === 'too-big' ? 1 : 0) - (b.fit === 'too-big' ? 1 : 0) || a.r.lot.name.localeCompare(b.r.lot.name));
  const place = (r: LotRow) => {
    applyPlace(store, ctx.rows, r.id, spot.id);
    toast(`${r.lot.name} placed`);
    onClose();
  };
  const tryPlace = (r: LotRow) => (fitOf(r.lot.size, spot.size) === 'too-big' ? setBig(r) : place(r));
  const sub = [ctx.hoodName(spot.world, spot.neighborhood), spot.size, 'Empty lot'].filter(Boolean).join(' · ');

  if (step === 'new') {
    return <LotForm ctx={ctx} lotId={null} onClose={onClose} onSaved={(id) => {
      const fresh: LotRow = { id, lot: lotData(store.get(id)), spot: null, world: null };
      if (fitOf(fresh.lot.size, spot.size) === 'too-big') { setBig(fresh); setStep('menu'); } else place(fresh);
    }} />;
  }
  return (
    <>
      {step === 'menu' && !big && (
        <Confirm title={spot.name} text={sub} onCancel={onClose}
          actions={[
            { label: 'Put a lot here', kind: 'primary', disabled: candidates.length === 0, run: () => setStep('pick') },
            { label: <><Plus size={16} weight="bold" /> Add a new lot</>, run: () => setStep('new') },
          ]} />
      )}
      {step === 'pick' && !big && (
        <Modal title={`Put a lot on ${spot.name}`} onClose={onClose} autoFocus={false}>
          <div className="spot-list">
            {candidates.map(({ r, fit }) => (
              <button key={r.id} type="button" className="spot-row" onClick={() => tryPlace(r)}>
                <span className="grow"><b>{r.lot.name}</b><span className="muted small"> · {[lotTypeName(r.lot.type), r.lot.size].filter(Boolean).join(' · ')}</span></span>
                <span className={`spot-state ${fit === 'too-big' ? 'small' : 'fit'}`}>{fit === 'too-big' ? 'Too big' : 'Fits'}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {big && (
        <Confirm title={`Too big for ${spot.name}`} text="Some of it may get deleted in game." onCancel={onClose}
          actions={[{ label: 'Place anyway', kind: 'primary', run: () => place(big) }, { label: 'Cancel', run: onClose }]} />
      )}
    </>
  );
}
