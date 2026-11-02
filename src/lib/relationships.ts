import type { Relationship, RelationshipType } from './types';

export const REL_TYPES: { v: RelationshipType; label: string }[] = [
  { v: 'parent', label: 'Parent / child' },
  { v: 'sibling', label: 'Sibling' },
  { v: 'spouse', label: 'Spouse' },
  { v: 'partner', label: 'Partner' },
  { v: 'fiance', label: 'Engaged' },
  { v: 'ex', label: 'Ex' },
  { v: 'bestFriend', label: 'Best friend' },
  { v: 'friend', label: 'Friend' },
  { v: 'enemy', label: 'Enemy' },
  { v: 'roommate', label: 'Roommate' },
  { v: 'cousin', label: 'Cousin' },
  { v: 'other', label: 'Something else' },
];

/** How a relationship reads from one Sim's side ("Father", "Best friend"). */
export function relLabelFor(r: Relationship, me: string): string {
  if (r.label) return r.label;
  switch (r.type) {
    case 'parent':
      return r.a === me ? 'Child' : 'Parent';
    case 'sibling': return 'Sibling';
    case 'spouse': return 'Spouse';
    case 'partner': return 'Partner';
    case 'fiance': return 'Engaged';
    case 'ex': return 'Ex';
    case 'bestFriend': return 'Best friend';
    case 'friend': return 'Friend';
    case 'enemy': return 'Enemy';
    case 'roommate': return 'Roommate';
    case 'cousin': return 'Cousin';
    default: return 'Connected';
  }
}

export const REL_ORDER: RelationshipType[] = ['parent', 'spouse', 'fiance', 'partner', 'sibling', 'cousin', 'bestFriend', 'friend', 'roommate', 'ex', 'enemy', 'other'];
