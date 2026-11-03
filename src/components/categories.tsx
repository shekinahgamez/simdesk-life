import { CalendarBlank, HouseSimple, MapPin, Path, User, UsersThree, type Icon } from '@phosphor-icons/react';

export type CategoryId = 'sims' | 'households' | 'worlds' | 'calendar' | 'clubs' | 'storylines';

/** Each main section's name, icon, color, address and setup-deck nudge. */
export const CATEGORIES: { id: CategoryId; label: string; icon: Icon; path: string; nudge: string; module?: 'storylines' }[] = [
  { id: 'sims', label: 'Sims', icon: User, path: 'sims', nudge: 'Add your first Sim and their photo.' },
  { id: 'households', label: 'Households', icon: HouseSimple, path: 'households', nudge: 'Group Sims into homes.' },
  { id: 'worlds', label: 'Worlds & lots', icon: MapPin, path: 'worlds', nudge: 'Rename worlds and give every lot a job.' },
  { id: 'calendar', label: 'Calendar', icon: CalendarBlank, path: 'calendar', nudge: 'Clear the slate and add your holidays.' },
  { id: 'clubs', label: 'Clubs', icon: UsersThree, path: 'clubs', nudge: 'Set up clubs, roles and meeting spots.' },
  { id: 'storylines', label: 'Storylines', icon: Path, path: 'storylines', nudge: 'Thread drama through your Sims.', module: 'storylines' },
];

/** Sections that are built. Deck cards for anything else are grayed out with "Coming soon". Add each one as it lands. */
export const BUILT = new Set<CategoryId>((globalThis as { __SD_BUILT__?: CategoryId[] }).__SD_BUILT__ ?? []); // the global is only for tests

export function ObjIcon({ cat, size = 'md' }: { cat: CategoryId; size?: 'md' | 'lg' }) {
  const I = CATEGORIES.find((x) => x.id === cat)!.icon;
  return (
    <span className={`obj ${cat} ${size === 'lg' ? 'lg' : ''}`} aria-hidden="true">
      <I size={size === 'lg' ? 24 : 16} weight="duotone" />
    </span>
  );
}
