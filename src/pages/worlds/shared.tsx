import { useMemo, useState, type ReactNode } from 'react';
import { CaretLeft, MapPin } from '@phosphor-icons/react';
import { BY_ID, type GameLot } from '../../data/game';
import { WORLD_SCENES } from '../../components/worldScenes';
import { Confirm, Modal, toast } from '../../components/ui';
import {
  APARTMENT, apartmentsOf, CUSTOM_TYPE_PREFIX, fitOf, lotRows, setCustomLotTypes, type CustomLotType, lotsBySpot, placeChanges, spotsOf, worldData, type Fit, type LotRow, type WorldData,
} from '../../lib/lots';
import { useAccount, useRecords, useStore } from '../../lib/sync/react';
import { plural } from '../../lib/text';
import type { SaveRow } from '../../lib/sync/types';
import { newId, type SyncStore } from '../../lib/sync/store';
import { useSaveInfo } from '../sims/shared';

/** Everything the Worlds & lots pages share about the open save. */
export function useLotsCtx(save: SaveRow) {
  const info = useSaveInfo(save);
  const lotRecs = useRecords('lot');
  const worldRecs = useRecords('world');
  const customTypes = useCustomLotTypes().list; // so lot type names redraw when you rename one
  return useMemo(() => {
    const rows = lotRows(lotRecs);
    const recOfWorld = new Map(worldRecs.map((r) => [(r.data as { gameId?: string }).gameId ?? '', r]));
    const world = (gameId: string): WorldData => worldData(recOfWorld.get(gameId), gameId);
    const worldName = (gameId: string | null) => (gameId ? world(gameId).name.trim() || BY_ID.worlds.get(gameId)?.name || 'Unknown world' : '');
    const worlds = info.avail.worlds.map((w) => ({ id: w.id, name: worldName(w.id), pack: BY_ID.packs.get(w.pack)?.name ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { info, rows, bySpot: lotsBySpot(rows), world, worldName, worlds, recOfWorld, apartments: apartmentsOf(info.avail) };
  }, [info, lotRecs, worldRecs, customTypes]);
}
export type LotsCtx = ReturnType<typeof useLotsCtx>;

/** A world's scene picture (flat pastel art), or a plain tile with a pin for worlds that don't have one yet. */
export function WorldPicture({ worldId, className, children }: { worldId: string; className?: string; children?: ReactNode }) {
  const scene = WORLD_SCENES[worldId];
  if (scene) {
    return (
      <div className={`${className ?? ''} world-pic`}>
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: scene }} />
        {children}
      </div>
    );
  }
  return <div className={`${className ?? ''} world-pic none`}><MapPin size={30} weight="duotone" />{children}</div>;
}

// ---------- asking to place a new lot ----------
const STREAK = 'sd:placeAskStreak';
const OFF_NOW = 'sd:placeAskOff';
const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};
type Prefs = { askToPlace?: boolean };
/** "Place it now?" after adding a lot. Can be turned off for now (this visit) or for good (App settings). */
export function useAskToPlace(): [boolean, (v: boolean) => void] {
  const acct = useAccount();
  const on = ((acct.data.prefs as Prefs | undefined)?.askToPlace ?? true);
  return [on, (v) => acct.update((d) => ({ ...d, prefs: { ...((d.prefs as Prefs | undefined) ?? {}), askToPlace: v } }))];
}
export function useShouldAsk() {
  const [on] = useAskToPlace();
  return on && ss.get(OFF_NOW) !== '1';
}

export function PlaceAsk({ name, onPlace, onClose }: { name: string; onPlace(): void; onClose(): void }) {
  const [, setOn] = useAskToPlace();
  const streak = Number(ss.get(STREAK) ?? '0');
  const notNow = () => { ss.set(STREAK, String(streak + 1)); onClose(); };
  return (
    <Confirm title={`Place ${name} now?`} onCancel={notNow}
      actions={[
        { label: 'Place it', kind: 'primary', run: () => { ss.set(STREAK, '0'); onPlace(); } },
        { label: 'Not now', run: notNow },
      ]}
      after={streak >= 2 && (
        <div className="stop-asking">
          Stop asking:
          <button type="button" onClick={() => { ss.set(OFF_NOW, '1'); notNow(); }}>For now</button>
          <button type="button" onClick={() => { setOn(false); notNow(); }}>For good</button>
        </div>
      )} />
  );
}

// ---------- placing ----------
/** Puts a lot on a spot (null = take it off). Whatever was on that spot goes back to Not placed. */
export function applyPlace(store: SyncStore, rows: LotRow[], lotId: string, spot: string | null) {
  for (const c of placeChanges(rows, lotId, spot)) {
    const r = store.get(c.id);
    if (r) store.put('lot', { ...r.data, spot: c.spot }, c.id);
  }
}

type SpotState = { spot: GameLot; fit: Fit; taken: LotRow | null };

/** Place a lot: pick the world, then the lot it goes on. Taken asks to swap; too big asks first. */
export function PlaceFlow({ ctx, lotId, onClose }: { ctx: LotsCtx; lotId: string; onClose(): void }) {
  const store = useStore();
  const row = ctx.rows.find((r) => r.id === lotId);
  const apt = row?.lot.type === APARTMENT;
  const startWorld = apt ? (row?.lot.meantFor ? BY_ID.lots.get(row.lot.meantFor)?.world : null) ?? null : row?.world ?? null;
  const [worldId, setWorldId] = useState<string | null>(startWorld);
  const [picked, setPicked] = useState<string | null>(apt ? row?.lot.meantFor ?? null : null);
  const [ask, setAsk] = useState<null | 'swap' | 'big'>(null);
  if (!row) return null;
  const { lot } = row;

  const statesFor = (w: string): SpotState[] => {
    const spots = apt ? ctx.apartments.filter((a) => a.world === w) : spotsOf(ctx.info.avail, w);
    return spots.map((spot) => {
      const t = ctx.bySpot.get(spot.id);
      return { spot, fit: apt ? 'fits' : fitOf(lot.size, spot.size), taken: t && t.id !== lotId ? t : null };
    });
  };
  const worlds = ctx.worlds.map((w) => {
    const s = statesFor(w.id);
    return { ...w, total: s.length, fits: s.filter((x) => !x.taken && x.fit !== 'too-big').length };
  }).filter((w) => w.total > 0);

  const place = () => {
    applyPlace(store, ctx.rows, lotId, picked);
    toast(`${lot.name} placed`);
    onClose();
  };
  const sel = picked && worldId ? statesFor(worldId).find((s) => s.spot.id === picked) ?? null : null;
  const tryPlace = () => {
    if (!sel) return;
    if (sel.taken) return setAsk('swap');
    if (sel.fit === 'too-big') return setAsk('big');
    place();
  };
  const sizeNote = !apt && lot.size ? ` · ${lot.size}` : '';

  return (
    <Modal title={<>Place {lot.name}<span className="muted title-note">{sizeNote}</span></>} onClose={onClose} wide className="place-modal" autoFocus={false}
      footer={(close) => worldId ? (
        <>
          {sel && <div className="place-sel"><b>{sel.spot.name}</b><span className="muted small">{[sel.spot.neighborhood, !apt && sel.spot.size].filter(Boolean).join(' · ')}</span></div>}
          <span className="grow" />
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn primary" disabled={!sel} onClick={tryPlace}>Place here</button>
        </>
      ) : <><span className="grow" /><button type="button" className="btn" onClick={close}>Cancel</button></>}>
      {!worldId ? (
        worlds.length === 0 ? <p className="muted">{apt ? 'None of your packs have apartments.' : 'No worlds yet. Add packs in Save settings.'}</p> : (
          <div className="place-worlds">
            {worlds.map((w) => (
              <button key={w.id} type="button" className="place-world" onClick={() => { setWorldId(w.id); setPicked(null); }}>
                <WorldPicture worldId={w.id} className="place-world-pic" />
                <b>{w.name}</b>
                <span className="small">{apt ? plural(w.fits, 'empty apartment') : `${w.fits} empty ${w.fits === 1 ? 'lot fits' : 'lots fit'}`}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label-caps">{ctx.worldName(worldId)}</span>
            <button type="button" className="btn ghost sm" onClick={() => { setWorldId(null); setPicked(null); }}><CaretLeft size={14} weight="bold" /> Other world</button>
          </div>
          <SpotPicker states={statesFor(worldId)} picked={picked} onPick={setPicked} apt={apt} />
        </div>
      )}
      {ask === 'swap' && sel?.taken && (
        <Confirm title={`${sel.spot.name} already has a lot`} text={`Swap it for ${lot.name}?`} onCancel={() => setAsk(null)}
          actions={[{ label: 'Swap', kind: 'primary', run: () => { setAsk(null); if (sel.fit === 'too-big') setAsk('big'); else place(); } }, { label: 'Cancel', run: () => setAsk(null) }]} />
      )}
      {ask === 'big' && sel && (
        <Confirm title={`Too big for ${sel.spot.name}`} text="Some of it may get deleted in game." onCancel={() => setAsk(null)}
          actions={[{ label: 'Place anyway', kind: 'primary', run: () => { setAsk(null); place(); } }, { label: 'Cancel', run: () => setAsk(null) }]} />
      )}
    </Modal>
  );
}

/** The world's lots to pick from, by neighborhood. */
function SpotPicker({ states, picked, onPick, apt }: {
  states: SpotState[]; picked: string | null; onPick(id: string): void; apt: boolean;
}) {
  const cls = (s: SpotState) => (s.taken ? 'taken' : s.fit === 'too-big' ? 'small' : 'fit');
  const label = (s: SpotState) => (s.taken ? `Has ${s.taken.lot.name}` : s.fit === 'too-big' ? 'Too small' : apt ? 'Empty' : 'Fits');
  const groups = useMemo(() => {
    const m = new Map<string, SpotState[]>();
    for (const s of states) m.set(s.spot.neighborhood || 'Other', [...(m.get(s.spot.neighborhood || 'Other') ?? []), s]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [states]);
  return (
    <>
      <div className="spot-list">
        {groups.map(([hood, list]) => (
          <div key={hood} className="spot-group">
            <div className="label-caps">{hood}</div>
            {list.map((s) => (
              <button key={s.spot.id} type="button" className={`spot-row ${picked === s.spot.id ? 'on' : ''}`} aria-pressed={picked === s.spot.id} onClick={() => onPick(s.spot.id)}>
                <span className="grow"><b>{s.spot.name}</b>{!apt && s.spot.size && <span className="muted small"> · {s.spot.size}</span>}</span>
                <span className={`spot-state ${cls(s)}`}>{label(s)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- the player's own lot types (like Hotel), kept on the account ----------
export function useCustomLotTypes() {
  const acct = useAccount();
  const raw = (acct.data as { customLotTypes?: CustomLotType[] }).customLotTypes;
  const list = useMemo(() => (raw ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [raw]);
  setCustomLotTypes(list); // read straight away by lotTypeName
  return {
    list,
    /** Adds one (or finds the same name) and returns the lot type id to use. */
    add(name: string): string {
      const clean = name.trim();
      const same = list.find((t) => t.name.toLowerCase() === clean.toLowerCase());
      if (same) return `${CUSTOM_TYPE_PREFIX}${same.id}`;
      const t = { id: newId(), name: clean };
      acct.update((d) => ({ ...d, customLotTypes: [...(((d as { customLotTypes?: CustomLotType[] }).customLotTypes) ?? []), t] }));
      setCustomLotTypes([...list, t]);
      return `${CUSTOM_TYPE_PREFIX}${t.id}`;
    },
    rename(id: string, name: string) {
      const next = list.map((t) => (t.id === id ? { ...t, name: name.trim() } : t));
      acct.update((d) => ({ ...d, customLotTypes: next }));
      setCustomLotTypes(next);
    },
    remove(id: string) {
      const next = list.filter((t) => t.id !== id);
      acct.update((d) => ({ ...d, customLotTypes: next }));
      setCustomLotTypes(next);
    },
  };
}
/** Renders nothing; just keeps custom lot type names ready before the page draws. */
export function LotTypeRegistry() { useCustomLotTypes(); return null; }
