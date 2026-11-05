import { useMemo } from 'react';
import { clubRows, type ClubRow, type Place } from '../../lib/clubs';
import { lotTypeName } from '../../lib/lots';
import type { SaveRow } from '../../lib/sync/types';
import { useRecords } from '../../lib/sync/react';
import { fullName, simAge, simData, stageOf, type SimData } from '../../lib/sims';
import { stageName, type StageId } from '../../lib/time';
import { useLotsCtx } from '../worlds/shared';
import { useHouseholds } from '../sims/shared';

/** Everything the Clubs pages need to know about the open save: its clubs, Sims, lots and household names. */
export function useClubs(save: SaveRow) {
  const clubRecs = useRecords('club');
  const simRecs = useRecords('sim');
  const lots = useLotsCtx(save);
  const hh = useHouseholds();
  const { info } = lots;
  return useMemo(() => {
    const rows = clubRows(clubRecs);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const sims = new Map<string, SimData>(simRecs.map((r) => [r.id, simData(r)]));
    const nameOf = (id: string) => (sims.has(id) ? fullName(sims.get(id)!) : 'Removed Sim');
    const firstOf = (id: string) => sims.get(id)?.first || nameOf(id);
    const stageFor = (id: string): StageId | null => { const s = sims.get(id); return s ? stageOf(simAge(s, info.today, info.table, info.track)) : null; };
    const householdOf = (id: string) => (sims.get(id)?.householdId ? hh.nameOf(sims.get(id)!.householdId) : '');
    const lotRow = (id: string) => lots.rows.find((r) => r.id === id) ?? null;
    /** A place in words, and the small line under it. */
    const placeOf = (p: Place | null): { text: string; sub: string; lot: string | null } => {
      if (!p) return { text: '', sub: '', lot: null };
      if (p.kind === 'type') return { text: `Any ${lotTypeName(p.id) || 'lot'}`, sub: 'Lot type', lot: null };
      const r = lotRow(p.id);
      return r ? { text: r.lot.name || 'Unnamed lot', sub: lots.worldName(r.world), lot: r.id } : { text: 'A removed lot', sub: '', lot: null };
    };
    return { rows, byId, sims, nameOf, firstOf, stageFor, householdOf, placeOf, lots, info };
  }, [clubRecs, simRecs, lots, hh, info]);
}
export type ClubsCtx = ReturnType<typeof useClubs>;
export type { ClubRow };

/** The Get Together pack has to be on for clubs to show. */
export const clubsOn = (d: { packs: string[] }) => d.packs.includes('get-together');
export const traitNames = (info: { avail: { traits: { id: string; name: string }[] } }) => [...info.avail.traits].map((t) => t.name).sort((a, b) => a.localeCompare(b));
/** The life stages a club can ask for (clubs are for Child Sims and older). */
export const AGE_STAGES: { id: StageId; label: string }[] = (['child', 'teen', 'youngAdult', 'adult', 'elder'] as StageId[]).map((id) => ({ id, label: stageName(id) }));
