// Core data shapes. Everything belongs to a save; a save belongs to an account.

export type SeasonIndex = 0 | 1 | 2 | 3;
export type SeasonLength = 7 | 14 | 21 | 28;

/** A date in the save's calendar. day is 1-based. year can be 0 or negative for Sims born before the save began. */
export interface SimDate {
  year: number;
  season: SeasonIndex;
  day: number;
}

export type LifeStageId =
  | 'newborn'
  | 'infant'
  | 'toddler'
  | 'child'
  | 'teen'
  | 'youngAdult'
  | 'adult'
  | 'elder';

export type LifespanPreset = 'short' | 'normal' | 'long' | 'custom';

export interface LifespanRules {
  preset: LifespanPreset;
  /** Days per stage when preset is custom. Elder days = minimum before old age. */
  custom?: Partial<Record<LifeStageId, number>>;
}

export type ModuleId =
  | 'funds'
  | 'careers'
  | 'rotation'
  | 'venues'
  | 'storylines'
  | 'journal'
  | 'legacy'
  | 'prompts';

export interface Save {
  id: string;
  name: string;
  cover?: string;
  color: string;
  packs: string[]; // pack ids the player owns (Base Game is always implied)
  date: SimDate;
  startSeason: SeasonIndex;
  seasonLength: SeasonLength;
  lifespan: LifespanRules;
  trackDate: boolean;
  modules: Partial<Record<ModuleId, boolean>>;
  createdAt: string;
  updatedAt?: string;
}

export interface StagePhoto {
  stage: LifeStageId;
  url: string;
}

export interface Sim {
  id: string;
  firstName: string;
  lastName: string;
  portrait?: string;
  stagePhotos: StagePhoto[];
  /** Birth date in the save's calendar. Ages are never stored; they're worked out from this. */
  birthday?: SimDate;
  /** Used when date tracking is off: the stage the player set by hand. */
  manualStage?: LifeStageId;
  pronouns?: string;
  orientation?: string;
  occults: string[]; // occult ids; more than one allowed for hybrids
  traits: string[]; // game trait ids or custom trait ids
  aspiration?: string;
  career?: string;
  notes?: string;
  householdId?: string;
  deceased?: { date?: SimDate; cause?: string; notes?: string };
  createdAt: string;
}

export interface Household {
  id: string;
  name: string;
  homeLotId?: string;
  rotation?: 'active' | 'next' | 'paused' | 'none';
  notes?: string;
  createdAt: string;
}

export type RelationshipType =
  | 'parent'
  | 'sibling'
  | 'spouse'
  | 'partner'
  | 'fiance'
  | 'ex'
  | 'bestFriend'
  | 'friend'
  | 'enemy'
  | 'roommate'
  | 'cousin'
  | 'other';

export interface Relationship {
  id: string;
  /** For parent: a is the parent of b. Everything else is two-way. */
  a: string;
  b: string;
  type: RelationshipType;
  label?: string; // e.g. "Biological father", "Godmother"
  secret: boolean;
  createdAt: string;
}

/** Player's version of a world. id = game world id for EA worlds, or a uuid for custom ones. */
export interface WorldRecord {
  id: string;
  gameId?: string;
  name?: string; // the player's name; falls back to the game's
  inspiredBy?: string;
  vibe?: string;
  mapImage?: string;
  customNeighborhoods?: string[];
  hidden?: boolean;
  createdAt: string;
}

export interface BuildCredits {
  creator?: string;
  eaId?: string;
  buildName?: string;
  edited?: string;
  link?: string;
}

export interface LotHistoryEntry {
  id: string;
  when: string; // free text like "Year 2, Fall" so players can be as loose as they like
  text: string;
}

export interface LotRecord {
  id: string;
  gameId?: string;
  worldId: string;
  neighborhood?: string;
  name?: string; // player's name
  originalName?: string; // for custom lots
  size?: string;
  lotType?: string; // the player's own lot type label
  gameLotType?: string; // lot type id used in game
  photos: string[];
  credits?: BuildCredits;
  lotTraits: string[];
  history: LotHistoryEntry[];
  pin?: { x: number; y: number };
  notes?: string;
  createdAt: string;
}

export interface Holiday {
  id: string;
  name: string;
  season: SeasonIndex;
  day: number;
  traditions: string[]; // up to 5, like the game
  repeats: boolean;
  year?: number; // only when repeats is false
  notes?: string;
  createdAt: string;
}

export interface ClubMember {
  simId: string;
  role?: string;
}

export interface Club {
  id: string;
  name: string;
  purpose?: string; // player's own label
  roles: string[];
  members: ClubMember[];
  activities: string[];
  lotId?: string;
  meets?: { weekday: number; time?: string } | null; // 0 = Sunday
  linkedClubIds: string[];
  notes?: string;
  createdAt: string;
}

export interface CustomTrait {
  id: string;
  name: string;
  pack?: string; // trait pack name (player's own grouping)
  creator?: string;
  notes?: string;
  createdAt: string;
}

export type RecordKind = 'sim' | 'household' | 'relationship' | 'world' | 'lot' | 'holiday' | 'club';

export interface RecordMap {
  sim: Sim;
  household: Household;
  relationship: Relationship;
  world: WorldRecord;
  lot: LotRecord;
  holiday: Holiday;
  club: Club;
}
