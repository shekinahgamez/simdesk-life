import { useMemo } from 'react';
import { beatRows, type Precision, feelRows, secretRows, sortBeats, storyRows, type BeatRow, type FeelRow, type SecretRow, type StoryRow } from '../../lib/storylines';
import { dateOf, formatDate, SEASONS, yearText } from '../../lib/time';
import { useRecords } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { fullName, simData, type SimData } from '../../lib/sims';
import { useHouseholds, useSaveInfo } from '../sims/shared';

/** Everything the Storylines pages need to know about the open save. */
export function useStories(save: SaveRow) {
  const storyRecs = useRecords('storyline');
  const beatRecs = useRecords('beat');
  const secretRecs = useRecords('secret');
  const feelRecs = useRecords('feeling');
  const simRecs = useRecords('sim');
  const hh = useHouseholds();
  const info = useSaveInfo(save);
  return useMemo(() => {
    const stories = storyRows(storyRecs);
    const byId = new Map<string, StoryRow>(stories.map((r) => [r.id, r]));
    const beats: BeatRow[] = sortBeats(beatRows(beatRecs)).filter((b) => byId.has(b.b.storyline));
    const secrets: SecretRow[] = secretRows(secretRecs);
    const feelings: FeelRow[] = feelRows(feelRecs);
    const sims = new Map<string, SimData>(simRecs.map((r) => [r.id, simData(r)]));
    const nameOf = (id: string) => (sims.has(id) ? fullName(sims.get(id)!) : 'Removed Sim');
    const firstOf = (id: string) => sims.get(id)?.first || nameOf(id);
    const householdOf = (id: string) => sims.get(id)?.householdId ?? null;
    const faces = (ids: string[]) => ids.filter((id) => sims.has(id)).map((id) => ({ id, sim: sims.get(id)! }));
    /** A beat's date in words: "Spring 14", "Fall", or "Year −3", with the year only when it isn't this year. Empty when it has no date or the save doesn't track dates. */
    const dayText = (day: number | null, precision: Precision = 'day') => {
      if (!info.track || day == null) return '';
      const d = dateOf(day, info.cal);
      const now = dateOf(info.today, info.cal);
      const here = d.year === now.year;
      if (precision === 'year') return `Year ${yearText(d.year)}`;
      if (precision === 'season') return here ? SEASONS[d.season] : `${SEASONS[d.season]} · Year ${yearText(d.year)}`;
      return here ? formatDate(d, 'short') : `${formatDate(d, 'short')} · Year ${yearText(d.year)}`;
    };
    return { stories, byId, beats, secrets, feelings, sims, nameOf, firstOf, householdOf, faces, dayText, hh, info };
  }, [storyRecs, beatRecs, secretRecs, feelRecs, simRecs, hh, info]);
}
export type StoriesCtx = ReturnType<typeof useStories>;

/** "Nov 7" for a real date. */
export const realDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
