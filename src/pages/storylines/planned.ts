import { useMemo } from 'react';
import { beatRows, isDue, sortPlanned, storyRows } from '../../lib/storylines';
import { saveData } from '../../lib/saves';
import { useRecords } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { useStreaming } from '../../lib/streaming';
import { useSaveInfo } from '../sims/shared';

export type PlannedRow = { id: string; day: number; text: string; story: string; storyId: string; due: boolean };

/** Dated planned moments for Today's Coming up. Empty when Storylines is off, the save doesn't track dates, or Streaming mode is on. */
export function usePlannedComing(save: SaveRow, enabled = true): PlannedRow[] {
  const beatRecs = useRecords('beat');
  const storyRecs = useRecords('storyline');
  const info = useSaveInfo(save);
  const [streaming] = useStreaming();
  const on = enabled && !streaming && info.track && !!saveData(save).modules.storylines;
  return useMemo(() => {
    if (!on) return [];
    const stories = new Map(storyRows(storyRecs).map((r) => [r.id, r.s.name]));
    const planned = sortPlanned(beatRows(beatRecs).filter((b) => b.b.planned && b.b.day != null && stories.has(b.b.storyline)), info.today);
    return planned.map((b) => ({ id: b.id, day: b.b.day as number, text: b.b.text, story: stories.get(b.b.storyline) ?? '', storyId: b.b.storyline, due: isDue(b.b, info.today) }));
  }, [on, beatRecs, storyRecs, info.today]);
}
