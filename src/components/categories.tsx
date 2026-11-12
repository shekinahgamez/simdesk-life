import { CalendarBlank, GlobeHemisphereWest, HouseSimple, Images, Path, User, UsersThree, type Icon } from '@phosphor-icons/react';

export type CategoryId = 'sims' | 'households' | 'worlds' | 'calendar' | 'clubs' | 'storylines' | 'photos';

/** Each main section's name, icon, color, address and setup-deck nudge. */
export const CATEGORIES: { id: CategoryId; label: string; icon: Icon; path: string; nudge: string; /** What the card says once there's something in the section. */ after?: string; pack?: string; module?: 'storylines'; inSims?: true; /** No card in the setup deck (a new save has nothing to put there yet). */ noDeck?: true }[] = [
  { id: 'sims', label: 'Sims', icon: User, path: 'sims', nudge: 'Add your first Sim.', after: 'Your Sims.' },
  { id: 'households', label: 'Households', icon: HouseSimple, path: 'households', nudge: 'Group Sims into homes.', after: 'Who lives where.', inSims: true },
  { id: 'worlds', label: 'Worlds & lots', icon: GlobeHemisphereWest, path: 'worlds', nudge: 'Add your lots and place them.', after: 'Your lots, placed in their worlds.' },
  { id: 'calendar', label: 'Calendar', icon: CalendarBlank, path: 'calendar', nudge: 'Clear the slate and add your holidays.', after: 'Holidays, events, birthdays and trips.' },
  { id: 'clubs', label: 'Clubs', icon: UsersThree, path: 'clubs', nudge: 'Set up clubs, roles and meeting spots.', after: 'Who’s in which club.', pack: 'get-together' },
  { id: 'photos', label: 'Photos', icon: Images, path: 'photos', nudge: '', noDeck: true },
  { id: 'storylines', label: 'Storylines', icon: Path, path: 'storylines', nudge: 'Thread drama through your Sims.', module: 'storylines' },
];

/** The cards in the setup deck and the home deck. */
export const DECK = CATEGORIES.filter((c) => !c.noDeck);

/** The sections with their own sidebar link. Households lives inside the Sims tab (it keeps its deck card as a shortcut). */
export const SECTIONS = CATEGORIES.filter((c) => !c.inSims);

/** Sections that are built. Deck cards for anything else are grayed out with "Coming soon". Add each one as it lands. */
export const BUILT = new Set<CategoryId>((globalThis as { __SD_BUILT__?: CategoryId[] }).__SD_BUILT__ ?? ['sims', 'households', 'worlds', 'calendar', 'photos', 'clubs', 'storylines']); // the global is only for tests

/** Sections that need a pack (clubs need Get Together) only show for saves that have it. */
export const needsPack = (c: { pack?: string }, packs: string[]) => !c.pack || packs.includes(c.pack);

export function ObjIcon({ cat, size = 'md' }: { cat: CategoryId; size?: 'md' | 'lg' }) {
  const I = CATEGORIES.find((x) => x.id === cat)!.icon;
  return (
    <span className={`obj ${cat} ${size === 'lg' ? 'lg' : ''}`} aria-hidden="true">
      <I size={size === 'lg' ? 24 : 16} weight="duotone" />
    </span>
  );
}
