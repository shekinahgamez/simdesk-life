/**
 * The game's own data (packs, traits, worlds, lots...), built into the app so it can't fail to load
 * and works offline. To update it: edit game-data/simdesk-game-data.xlsx, run `npm run import-workbook`,
 * and upload. See scripts/import-workbook.mjs.
 */
import packsJson from './game/packs.json';
import stagesJson from './game/life-stages.json';
import traitsJson from './game/traits.json';
import aspirationsJson from './game/aspirations.json';
import occultsJson from './game/occults.json';
import traditionsJson from './game/traditions.json';
import worldsJson from './game/worlds.json';
import neighborhoodsJson from './game/neighborhoods.json';
import lotsJson from './game/lots.json';
import lotTypesJson from './game/lot-types.json';
import secretAreasJson from './game/secret-areas.json';
import mapsJson from './game/maps.json';
import about from './game/_about.json';

export type PackType = 'base' | 'expansion' | 'game' | 'stuff' | 'kit' | 'free';
export interface Pack { id: string; name: string; type: PackType; year?: number; world?: string }
interface Tagged { id: string; name: string; pack: string }
export interface Trait extends Tagged { category: string; ages: string; notes: string }
export interface Aspiration extends Tagged { category: string; ages: string; rewardTrait: string; notes: string }
export interface Occult extends Tagged { playableInCAS: boolean; otherWays: string; inherited: boolean; powers: string; notes: string }
export interface Tradition extends Tagged { howTo: string }
export interface World extends Tagged { type: string; notes: string }
export interface Neighborhood extends Tagged { world: string }
export interface StageRow { id: string; name: string; short: number; normal: number; long: number; notes: string }
/**
 * A lot from the game. Only lots the game won't let you change (`locked`) keep a lot type.
 * `secret` lots stay hidden until the save turns them on.
 */
export interface GameLot extends Tagged { world: string; neighborhood: string; size: string; locked?: boolean; lotType?: string; secret?: boolean; note?: string }
export interface LotType { id: string; name: string; pack: string; kind: 'residential' | 'community' | 'special' }
export interface SecretArea extends Tagged { notes: string }
export interface WorldMap { image: string; plots: [number, number][]; pins: Record<string, number> }

export const BASE_PACK = 'base-game';

export const GAME = {
  packs: packsJson as Pack[],
  stages: stagesJson as StageRow[],
  traits: traitsJson as Trait[],
  aspirations: aspirationsJson as Aspiration[],
  occults: occultsJson as Occult[],
  traditions: traditionsJson as Tradition[],
  worlds: worldsJson as World[],
  neighborhoods: neighborhoodsJson as Neighborhood[],
  lots: lotsJson as GameLot[],
  lotTypes: lotTypesJson as LotType[],
  secretAreas: secretAreasJson as SecretArea[],
  maps: Object.fromEntries(Object.entries(mapsJson).filter(([k]) => !k.startsWith('_'))) as Record<string, WorldMap>,
  importedAt: about.importedAt,
};

function index<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((r) => [r.id, r]));
}
/** Look up any game item by id, whether or not its pack is on (so a Sim keeps what they already have). */
export const BY_ID = {
  packs: index(GAME.packs),
  traits: index(GAME.traits),
  aspirations: index(GAME.aspirations),
  occults: index(GAME.occults),
  traditions: index(GAME.traditions),
  worlds: index(GAME.worlds),
  neighborhoods: index(GAME.neighborhoods),
  lots: index(GAME.lots),
  lotTypes: index(GAME.lotTypes),
};

export const PACK_TYPES: { type: PackType; label: string }[] = [
  { type: 'expansion', label: 'Expansions' },
  { type: 'game', label: 'Game packs' },
  { type: 'stuff', label: 'Stuff packs' },
  { type: 'kit', label: 'Kits' },
  { type: 'free', label: 'Free' },
];

/** What a save has turned on. Base Game is always on. */
export type Owned = { packs: ReadonlySet<string>; secretLots: ReadonlySet<string> };
export function ownedFrom(packs: readonly string[] = [], secretLots: readonly string[] = []): Owned {
  return { packs: new Set([BASE_PACK, ...packs]), secretLots: new Set(secretLots) };
}
export const isOn = (owned: Owned, pack: string) => owned.packs.has(pack);

/**
 * Everything a save can choose from: only items from its packs. Secret lots also need turning on.
 * Packs, life stages and maps are never filtered.
 */
export function available(owned: Owned) {
  const on = <T extends { pack: string }>(rows: T[]) => rows.filter((r) => owned.packs.has(r.pack));
  const worlds = on(GAME.worlds);
  return {
    traits: on(GAME.traits),
    aspirations: on(GAME.aspirations),
    occults: on(GAME.occults),
    traditions: on(GAME.traditions),
    worlds,
    neighborhoods: on(GAME.neighborhoods),
    lots: on(GAME.lots).filter((l) => !l.secret || owned.secretLots.has(l.id)),
    /** Secret lots whose pack is on (for the Save settings switches). */
    secretLots: on(GAME.lots).filter((l) => l.secret),
    lotTypes: on(GAME.lotTypes),
    secretAreas: on(GAME.secretAreas),
  };
}
export type Available = ReturnType<typeof available>;

/**
 * Picker options: what can be chosen now, plus anything already chosen whose pack has since been
 * turned off (shown with "pack off", so it stays on the profile until the player removes it).
 * Once removed, it can't be picked again until the pack is back on.
 */
export function optionsWithChosen<T extends Tagged>(choosable: T[], all: Map<string, T>, chosen: readonly string[]) {
  const ids = new Set(choosable.map((x) => x.id));
  const extra = chosen.filter((id) => !ids.has(id)).map((id) => all.get(id)).filter((x): x is T => !!x);
  return [
    ...choosable.map((x) => ({ id: x.id, label: x.name })),
    ...extra.map((x) => ({ id: x.id, label: `${x.name} (${BY_ID.packs.get(x.pack)?.name ?? 'pack'} is off)`, group: 'Pack turned off' })),
  ];
}
