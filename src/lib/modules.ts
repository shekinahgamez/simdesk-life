import { ArrowsClockwise, Briefcase, Coins, Crown, Lightbulb, Notebook, Path, Storefront, type Icon } from '@phosphor-icons/react';
import type { ModuleId } from './types';

// The on/off switches. In version 1 these are switches only, so each module slots in as it launches.
export interface ModuleDef {
  id: ModuleId;
  label: string;
  desc: string;
  icon: Icon;
  tint: string; // css var name prefix
}

export const MODULES: ModuleDef[] = [
  { id: 'funds', label: 'Household funds', desc: 'Simoleons for every household', icon: Coins, tint: 'households' },
  { id: 'careers', label: 'Careers', desc: 'Career, level and workplace', icon: Briefcase, tint: 'calendar' },
  { id: 'rotation', label: 'Rotation', desc: 'Who’s up next and for how long', icon: ArrowsClockwise, tint: 'worlds' },
  { id: 'venues', label: 'Businesses & venues', desc: 'Owners, employees and customer activities', icon: Storefront, tint: 'sims' },
  { id: 'storylines', label: 'Storylines', desc: 'Threads that link Sims together', icon: Path, tint: 'storylines' },
  { id: 'journal', label: 'Play journal', desc: 'Day-by-day notes', icon: Notebook, tint: 'clubs' },
  { id: 'legacy', label: 'Legacy progress', desc: 'Generations, heirs and challenge rules', icon: Crown, tint: 'households' },
  { id: 'prompts', label: 'Story prompts', desc: 'A nudge when you’re stuck on what’s next', icon: Lightbulb, tint: 'storylines' },
];

export const SAVE_COLORS: { label: string; hex: string }[] = [
  { label: 'Blush', hex: '#F4B6CF' },
  { label: 'Berry', hex: '#B83C76' },
  { label: 'Coral', hex: '#F59A82' },
  { label: 'Butter', hex: '#F2C25C' },
  { label: 'Mint', hex: '#6FCFB9' },
  { label: 'Sky', hex: '#8DB0FF' },
  { label: 'Lilac', hex: '#ADA2FF' },
  { label: 'Ink', hex: '#24191F' },
];
