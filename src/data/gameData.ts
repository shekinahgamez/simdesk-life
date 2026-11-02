// Shared reference data from the simdesk-game-data workbook (see scripts/import-workbook.mjs).
// Loaded once from /game-data/*.json so updates are a data change, not a code change.

import { create } from 'zustand';
import { DEFAULT_STAGE_TABLE, type StageRow } from '../lib/time';

export type PackType = 'base' | 'expansion' | 'game' | 'stuff' | 'kit' | 'free' | string;

export interface Pack { id: string; name: string; type: PackType; year?: number; world?: string; code?: string }
interface Tagged { id: string; name: string; pack: string }
export interface Trait extends Tagged { category?: string; ages?: string; notes?: string }
export interface Aspiration extends Tagged { category?: string; ages?: string; rewardTrait?: string }
export interface Occult extends Tagged { playableInCAS?: boolean; otherWays?: string; inherited?: boolean; powers?: string }
export interface Tradition extends Tagged { howTo?: string }
export interface World extends Tagged { type?: string }
export interface Neighborhood extends Tagged { world: string; lotCount?: number }
export interface GameLot extends Tagged { world: string; neighborhood?: string; size?: string; lotType?: string }
export interface LotType { id: string; name: string; kind: string }

export interface GameData {
  packs: Pack[];
  stages: StageRow[];
  traits: Trait[];
  aspirations: Aspiration[];
  occults: Occult[];
  traditions: Tradition[];
  worlds: World[];
  neighborhoods: Neighborhood[];
  lots: GameLot[];
  lotTypes: LotType[];
  secretAreas: Tagged[];
}

const files = {
  packs: 'packs',
  stages: 'life-stages',
  traits: 'traits',
  aspirations: 'aspirations',
  occults: 'occults',
  traditions: 'traditions',
  worlds: 'worlds',
  neighborhoods: 'neighborhoods',
  lots: 'lots',
  lotTypes: 'lot-types',
  secretAreas: 'secret-areas',
} as const;

interface GameDataState {
  data: GameData | null;
  error: string | null;
  load(): Promise<void>;
}

let loading: Promise<void> | null = null;

export const useGameData = create<GameDataState>((setState) => ({
  data: null,
  error: null,
  load() {
    if (!loading) {
      loading = (async () => {
        try {
          const entries = await Promise.all(
            Object.entries(files).map(async ([k, f]) => {
              const r = await fetch(`${import.meta.env.BASE_URL}game-data/${f}.json`);
              if (!r.ok) return [k, []] as const;
              return [k, await r.json()] as const;
            }),
          );
          const d = Object.fromEntries(entries) as unknown as GameData;
          const stages = (d.stages as StageRow[]).filter((s) => s.normal > 0);
          d.stages = stages.length === 8 ? stages : DEFAULT_STAGE_TABLE;
          setState({ data: d });
        } catch (e) {
          setState({ error: String(e) });
        }
      })();
    }
    return loading;
  },
}));

export const BASE_PACK = 'base-game';

/** Ground rule 8: only the player's packs. Base Game is always in. */
export function ownedFilter(packs: string[]) {
  const owned = new Set([BASE_PACK, ...packs]);
  return <T extends { pack: string }>(rows: T[]) => rows.filter((r) => owned.has(r.pack));
}

export const PACK_TYPE_LABEL: Record<string, string> = {
  expansion: 'Expansions',
  game: 'Game packs',
  stuff: 'Stuff packs',
  kit: 'Kits',
  free: 'Free',
  base: 'Base Game',
};
