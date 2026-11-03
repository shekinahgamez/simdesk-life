import { CalendarBlank, HouseSimple, MapPin, Path, User, UsersThree, type Icon } from '@phosphor-icons/react';

export type CategoryId = 'sims' | 'households' | 'worlds' | 'calendar' | 'clubs' | 'storylines';

/** Each main section's name, icon and color. (Pages and nudge text get added as each section is built.) */
export const CATEGORIES: { id: CategoryId; label: string; icon: Icon }[] = [
  { id: 'sims', label: 'Sims', icon: User },
  { id: 'households', label: 'Households', icon: HouseSimple },
  { id: 'worlds', label: 'Worlds & lots', icon: MapPin },
  { id: 'calendar', label: 'Calendar', icon: CalendarBlank },
  { id: 'clubs', label: 'Clubs', icon: UsersThree },
  { id: 'storylines', label: 'Storylines', icon: Path },
];

export function ObjIcon({ cat, size = 'md' }: { cat: CategoryId; size?: 'md' | 'lg' }) {
  const I = CATEGORIES.find((x) => x.id === cat)!.icon;
  return (
    <span className={`obj ${cat} ${size === 'lg' ? 'lg' : ''}`} aria-hidden="true">
      <I size={size === 'lg' ? 24 : 16} weight="duotone" />
    </span>
  );
}
