import type { ReactNode } from 'react';

/** The tones a status can have. Pages pick a tone; they never write their own colors. */
export type Tone = 'neutral' | 'info' | 'warm' | 'hot' | 'done' | 'accent' | 'planned' | 'due';
// planned: transparent with a dashed outline (not happened yet). due: filled accent-soft (the day has come).

/** THE status chip: one word, one size, one of six tones. */
export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`tag p-chip ${tone}`}>{children}</span>;
}
