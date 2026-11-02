import { useMemo } from 'react';
import { useGameData, ownedFilter, type GameData, type GameLot, type World } from '../data/gameData';
import { ageInfo, DEFAULT_STAGE_TABLE, type AgeInfo } from '../lib/time';
import type { LifeStageId, LotRecord, Save, Sim, WorldRecord } from '../lib/types';
import { useSave, useStore } from './store';

export const simName = (s: Pick<Sim, 'firstName' | 'lastName'>) => `${s.firstName} ${s.lastName}`.trim() || 'Unnamed Sim';

/** Game data filtered to the save's packs. */
export function useOwned() {
  const data = useGameData((s) => s.data);
  const save = useSave();
  return useMemo(() => {
    if (!data || !save) return null;
    const f = ownedFilter(save.packs);
    return {
      ...data,
      traits: f(data.traits),
      aspirations: f(data.aspirations),
      occults: f(data.occults),
      traditions: f(data.traditions),
      worlds: f(data.worlds),
      neighborhoods: f(data.neighborhoods),
      lots: f(data.lots),
      secretAreas: f(data.secretAreas),
    } satisfies GameData;
  }, [data, save]);
}

export function useStageTable() {
  return useGameData((s) => s.data?.stages ?? DEFAULT_STAGE_TABLE);
}

export interface SimAge {
  info: AgeInfo | null;
  stage: LifeStageId | null;
}

export function simAge(sim: Sim, save: Save, table = DEFAULT_STAGE_TABLE): SimAge {
  if (!save.trackDate || !sim.birthday) return { info: null, stage: sim.manualStage ?? null };
  const info = ageInfo(sim.birthday, save.date, save.seasonLength, save.lifespan, table);
  return { info, stage: info.notBornYet ? null : info.stage };
}

export function useSimAge(sim: Sim | undefined): SimAge {
  const save = useSave();
  const table = useStageTable();
  return useMemo(() => (sim && save ? simAge(sim, save, table) : { info: null, stage: null }), [sim, save, table]);
}

// ---------- worlds & lots: game reference data merged with the player's edits ----------

export interface MergedWorld {
  id: string;
  game?: World;
  rec?: WorldRecord;
  name: string;
  originalName?: string;
  pack?: string;
  custom: boolean;
}

export interface MergedLot {
  id: string;
  game?: GameLot;
  rec?: LotRecord;
  name: string;
  originalName?: string;
  worldId: string;
  neighborhood?: string;
  size?: string;
  lotType?: string; // player's
  gameLotType?: string;
  photos: string[];
  pin?: { x: number; y: number };
  custom: boolean;
}

export function useWorlds(): MergedWorld[] {
  const owned = useOwned();
  const recs = useStore((s) => s.recs.world);
  return useMemo(() => {
    const out: MergedWorld[] = [];
    for (const g of owned?.worlds ?? []) {
      const r = recs[g.id];
      if (r?.hidden) continue;
      out.push({ id: g.id, game: g, rec: r, name: r?.name || g.name, originalName: g.name, pack: g.pack, custom: false });
    }
    for (const r of Object.values(recs)) {
      if (!r.gameId && !r.hidden && !out.some((w) => w.id === r.id))
        out.push({ id: r.id, rec: r, name: r.name || 'Untitled world', custom: true });
    }
    return out;
  }, [owned, recs]);
}

export function mergeLot(g: GameLot | undefined, r: LotRecord | undefined): MergedLot {
  return {
    id: (r?.id ?? g?.id)!,
    game: g,
    rec: r,
    name: r?.name || g?.name || r?.originalName || 'Untitled lot',
    originalName: g?.name ?? r?.originalName,
    worldId: g?.world ?? r!.worldId,
    neighborhood: r?.neighborhood ?? g?.neighborhood,
    size: r?.size || g?.size,
    lotType: r?.lotType,
    gameLotType: r?.gameLotType ?? g?.lotType,
    photos: r?.photos ?? [],
    pin: r?.pin,
    custom: !g,
  };
}

export function useLots(): MergedLot[] {
  const owned = useOwned();
  const recs = useStore((s) => s.recs.lot);
  return useMemo(() => {
    const out: MergedLot[] = [];
    const seen = new Set<string>();
    for (const g of owned?.lots ?? []) {
      out.push(mergeLot(g, recs[g.id]));
      seen.add(g.id);
    }
    for (const r of Object.values(recs)) if (!seen.has(r.id)) out.push(mergeLot(undefined, r));
    return out;
  }, [owned, recs]);
}

export function useLot(id: string | undefined): MergedLot | null {
  const lots = useLots();
  return useMemo(() => lots.find((l) => l.id === id) ?? null, [lots, id]);
}

/** Which household (if any) lives on each lot. */
export function useLotResidents() {
  const households = useStore((s) => s.recs.household);
  return useMemo(() => {
    const m = new Map<string, string[]>();
    for (const h of Object.values(households)) if (h.homeLotId) m.set(h.homeLotId, [...(m.get(h.homeLotId) ?? []), h.id]);
    return m;
  }, [households]);
}
