import { useMemo, type ReactNode } from 'react';
import { HouseSimple } from '@phosphor-icons/react';
import { householdData, homeKey, homeOptions, moveIn, residentsOf, type HH, type Home, type HomeOption, type OwnedLot, type Plan } from '../../lib/households';
import { householdLabel, simData, type SimData } from '../../lib/sims';
import { Modal, toast } from '../../components/ui';
import { APARTMENT, RESIDENTIAL_RENTAL, type LotData } from '../../lib/lots';
import { BY_ID } from '../../data/game';
import { useRecords, useStore } from '../../lib/sync/react';
import type { SyncStore } from '../../lib/sync/store';
import type { SaveRow } from '../../lib/sync/types';
import { useLotsCtx } from '../worlds/shared';
import { SimAvatar } from '../sims/shared';

/** Everything the Households pages share: households, their Sims, homes and lots. */
export function useHhCtx(save: SaveRow) {
  const lots = useLotsCtx(save);
  const hhRecs = useRecords('household');
  const simRecs = useRecords('sim');
  return useMemo(() => {
    const households: HH[] = hhRecs.map((r) => ({ id: r.id, data: householdData(r) }))
      .sort((a, b) => a.data.name.localeCompare(b.data.name, undefined, { sensitivity: 'base' }));
    const byId = new Map(households.map((h) => [h.id, h]));
    const sims = simRecs.map((r) => ({ id: r.id, sim: simData(r) }));
    const membersOf = (id: string) => sims.filter((s) => s.sim.householdId === id && !s.sim.deceased);
    const own = lots.rows.filter((r) => !r.id.startsWith('apt:'));
    const owned: OwnedLot[] = own.map((r) => ({ id: r.id, type: r.lot.type, owner: r.lot.owner }));
    const options = homeOptions(own, lots.apartments);
    const optionByKey = new Map(options.map((o) => [o.key, o]));
    const homeOf = (h: HH): HomeOption | null => (h.data.home ? optionByKey.get(homeKey(h.data.home)) ?? null : null);
    const nameOf = (id: string | null) => (id ? byId.get(id)?.data.name.trim() || 'Unnamed' : '');
    const livesIn = new Map<string, HH>();
    for (const h of households) if (h.data.home && optionByKey.has(homeKey(h.data.home))) livesIn.set(homeKey(h.data.home), h);
    /** "Willow Creek · Garden Essence · 40x30" style line for a home. */
    const whereOf = (o: HomeOption) => {
      const row = o.lotId ? own.find((r) => r.id === o.lotId) : null;
      const apt = o.kind === 'apt' ? lots.apartments.find((a) => `apt:${a.id}` === o.key) : null;
      const world = lots.worldName(o.world);
      if (apt) return [world, apt.neighborhood].filter(Boolean).join(' · ');
      if (!row?.spot) return 'Not placed';
      return [world, row.spot.name].filter(Boolean).join(' · ');
    };
    return { lots, households, byId, sims, membersOf, own, owned, options, optionByKey, homeOf, nameOf, livesIn, whereOf };
  }, [lots, hhRecs, simRecs]);
}
export type HhCtx = ReturnType<typeof useHhCtx>;

/** Puts a move, move-out or merge into the save. */
export function applyPlan(store: SyncStore, plan: Plan) {
  for (const h of plan.households) {
    const cur = store.get(h.id);
    store.put('household', { ...(cur?.data ?? {}), ...h.data }, h.id);
  }
  for (const l of plan.lots) {
    const cur = store.get(l.id);
    if (cur) store.put('lot', { ...cur.data, owner: l.owner }, l.id);
  }
  for (const s of plan.sims) {
    const cur = store.get(s.id);
    if (cur) store.put('sim', { ...cur.data, householdId: s.householdId }, s.id);
  }
  if (plan.trash.length) store.moveManyToTrash(plan.trash, '', true);
}

/** A household's name as a yellow pill. */
export function HhPill({ name, href }: { name: string; href?: string }) {
  const inner = <><HouseSimple size={12} weight="fill" aria-hidden="true" />{name}</>;
  return href ? <a className="tag households ink hh-pill" href={href}>{inner}</a> : <span className="tag households ink hh-pill">{inner}</span>;
}

/** Overlapping Sim faces. */
export function Faces({ sims, size = 44, max = 6 }: { sims: { id: string; sim: SimData }[]; size?: number; max?: number }) {
  const shown = sims.slice(0, max);
  return (
    <span className="hh-faces" style={{ ['--f' as string]: `${size}px` }}>
      {shown.map((s) => <span key={s.id} className="hh-face"><SimAvatar sim={s.sim} size={size} /></span>)}
      {sims.length > max && <span className="hh-face more">+{sims.length - max}</span>}
    </span>
  );
}

/** The Household cell in the lots tables: who lives there (yellow pills) and who owns it. */
export function useHouseholdCell() {
  const hhRecs = useRecords('household');
  return useMemo(() => {
    const hhs: HH[] = hhRecs.map((r) => ({ id: r.id, data: householdData(r) }));
    const ids = new Set(hhs.map((h) => h.id));
    const name = (id: string) => hhs.find((h) => h.id === id)?.data.name.trim() || 'Unnamed';
    return (row: { id: string; lot: LotData }): ReactNode => {
      const synthetic = row.id.startsWith('apt:');
      const aptId = row.lot.type === APARTMENT ? row.lot.spot : null;
      const residents = [...(synthetic ? [] : residentsOf(hhs, row.id)), ...(aptId ? residentsOf(hhs, '', aptId) : [])];
      const owner = !synthetic && row.lot.owner && ids.has(row.lot.owner) ? row.lot.owner : null;
      const rental = row.lot.type === RESIDENTIAL_RENTAL;
      const home = synthetic || row.lot.type === APARTMENT || BY_ID.lotTypes.get(row.lot.type)?.kind === 'residential';
      const pills = residents.length ? residents.map((h) => h.id) : owner ? [owner] : [];
      const subs: string[] = [];
      if (residents.length && owner && residents.some((h) => h.id === owner) && !rental) subs.push('Live here · own it');
      else if (!residents.length && owner) subs.push('Own it');
      else if (owner) subs.push(`${name(owner)} own it`);
      if (rental && row.lot.units.length) {
        const taken = new Set(residents.map((h) => (h.data.home?.kind === 'lot' ? h.data.home.unit : null)));
        const free = row.lot.units.filter((u) => !taken.has(u.id)).length;
        if (free) subs.push(`${free} ${free === 1 ? 'unit' : 'units'} empty`);
      }
      if (!pills.length) return home && !synthetic ? <span className="muted">Empty</span> : null;
      return (
        <>
          <span className="hh-pills">{pills.map((id) => <HhPill key={id} name={name(id)} />)}</span>
          {subs.length > 0 && <span className="cell-sub">{subs.join(' · ')}</span>}
        </>
      );
    };
  }, [hhRecs]);
}

/** Move a household into one empty home (a rental unit's Move in). Households with no home come first. */
export function PickHousehold({ ctx, home, onClose }: { ctx: HhCtx; home: Home; onClose(): void }) {
  const store = useStore();
  const list = [...ctx.households].sort((a, b) => Number(!!ctx.homeOf(a)) - Number(!!ctx.homeOf(b)));
  const pick = (h: HH) => {
    applyPlan(store, moveIn({ households: ctx.households, lots: ctx.owned, sims: ctx.sims.map((s) => ({ id: s.id, householdId: s.sim.householdId })) }, h.id, home));
    toast(`${householdLabel(h.data.name)} moved in`);
    onClose();
  };
  return (
    <Modal title="Who moves in?" onClose={onClose} autoFocus={false} footer={(close) => <button type="button" className="btn" onClick={close}>Cancel</button>}>
      <div className="hp-body">
        {list.length === 0 ? <p className="muted" style={{ margin: 0 }}>No households yet.</p> : list.map((h) => {
          const o = ctx.homeOf(h);
          return (
            <button key={h.id} type="button" className="hp-opt" onClick={() => pick(h)}>
              <span className="grow"><b>{householdLabel(h.data.name) || 'Unnamed'}</b><span className="s">{o ? `Lives in ${o.title}` : 'No home yet'}</span></span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** The game apartments this save uses: a household lives there, or one of your apartment builds is placed in it. */
export function useAptsInUse(): Set<string> {
  const hhRecs = useRecords('household');
  const lotRecs = useRecords('lot');
  return useMemo(() => {
    const s = new Set<string>();
    for (const r of hhRecs) { const h = householdData(r).home; if (h?.kind === 'apt') s.add(h.id); }
    for (const r of lotRecs) { const d = r.data as { type?: string; spot?: string | null }; if (d.type === APARTMENT && d.spot) s.add(d.spot); }
    return s;
  }, [hhRecs, lotRecs]);
}

/** "Apartments not in use · 19 · Show": the folded row under every list of lots. */
export function MoreApts({ count, open, onToggle, label = 'Apartments not in use' }: { count: number; open: boolean; onToggle(): void; label?: string }) {
  if (!count) return null;
  return (
    <button type="button" className="hp-toggle more-apts" onClick={onToggle} aria-expanded={open}>
      <span>{label} · {count}</span><span>{open ? 'Hide' : 'Show'}</span>
    </button>
  );
}
