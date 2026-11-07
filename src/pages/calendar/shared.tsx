import { useMemo } from 'react';
import { AirplaneTilt, Cake, Champagne, Confetti, type Icon } from '@phosphor-icons/react';
import { comingUp, eventData, holidayData, vacationData, type CalItem, type CalState, type Kind } from '../../lib/calendar';
import { daysWord, fullName, householdLabel, simData, type SimData } from '../../lib/sims';
import { householdData } from '../../lib/households';
import { BY_ID } from '../../data/game';
import { savePath } from '../../lib/router';
import { useAccount, useRecords } from '../../lib/sync/react';
import { newId } from '../../lib/sync/store';
import type { SaveRow } from '../../lib/sync/types';
import { dateOf, formatDate, SEASONS, stageName } from '../../lib/time';
import { SimAvatar, useSaveInfo } from '../sims/shared';

/** Everything the calendar pages share for the open save. */
export function useCalCtx(save: SaveRow) {
  const info = useSaveInfo(save);
  const hol = useRecords('holiday');
  const evt = useRecords('event');
  const vac = useRecords('vacation');
  const simRecs = useRecords('sim');
  const hhRecs = useRecords('household');
  return useMemo(() => {
    const sims = simRecs.map((r) => ({ id: r.id, sim: simData(r) }));
    const simById = new Map(sims.map((s) => [s.id, s.sim]));
    const state: CalState = {
      holidays: hol.map((r) => ({ id: r.id, data: holidayData(r) })),
      events: evt.map((r) => ({ id: r.id, data: eventData(r) })),
      vacations: vac.map((r) => ({ id: r.id, data: vacationData(r) })),
      sims: info.track ? sims.filter((s) => s.sim.bornDay !== null && !s.sim.deceased).map((s) => ({ id: s.id, name: s.sim.first || fullName(s.sim), bornDay: s.sim.bornDay!, addedDay: s.sim.addedDay ?? undefined })) : [],
      table: info.table,
      cal: info.cal,
    };
    const nameOf = (id: string) => { const s = simById.get(id); return s ? fullName(s) : 'Removed Sim'; };
    const firstOf = (id: string) => simById.get(id)?.first || nameOf(id);
    const hhOf = (simId: string) => { const id = simById.get(simId)?.householdId; return id ? householdLabel(householdData(hhRecs.find((r) => r.id === id)).name) : ''; };
    return { info, state, sims, simById, nameOf, firstOf, hhOf };
  }, [info, hol, evt, vac, simRecs, hhRecs]);
}
export type CalCtx = ReturnType<typeof useCalCtx>;

/** What a calendar item says, in one line. */
export function itemTitle(_ctx: CalCtx, i: CalItem): string {
  if (i.kind === 'birthday') return `${i.name}’s birthday`;
  return i.name;
}
export const KIND_LABEL: Record<Kind, string> = { holiday: 'Holiday', event: 'Event', birthday: 'Birthday', vacation: 'Vacation' };
const KIND_ICON: Record<Kind, Icon> = { holiday: Confetti, event: Champagne, birthday: Cake, vacation: AirplaneTilt };
/** Each kind's icon in its color (the icon comes from the kind; nobody picks it). */
export function KindIcon({ kind, size = 14 }: { kind: Kind; size?: number }) {
  const I = KIND_ICON[kind];
  return <I size={size} weight="fill" className="kind-ic" aria-hidden="true" />;
}

/** "Spring 18–21" or "Spring 28 – Summer 2". */
export function spanText(ctx: CalCtx, from: number, to: number) {
  const a = dateOf(from, ctx.info.cal);
  const b = dateOf(to, ctx.info.cal);
  if (from === to) return formatDate(a, 'short');
  if (a.season === b.season && a.year === b.year) return `${SEASONS[a.season]} ${a.day}–${b.day}`;
  return `${formatDate(a, 'short')} – ${formatDate(b, 'short')}`;
}

// ---------- custom traditions (account-wide, like custom traits) ----------
export const TRADITION_PREFIX = 'custom:';
type Named = { id: string; name: string };
export function useCustomTraditions() {
  const acct = useAccount();
  const list = (((acct.data as { customTraditions?: Named[] }).customTraditions) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  return {
    list,
    add(name: string): string {
      const clean = name.trim();
      const same = list.find((t) => t.name.toLowerCase() === clean.toLowerCase());
      if (same) return `${TRADITION_PREFIX}${same.id}`;
      const t = { id: newId(), name: clean };
      acct.update((d) => ({ ...d, customTraditions: [...(((d as { customTraditions?: Named[] }).customTraditions) ?? []), t] }));
      return `${TRADITION_PREFIX}${t.id}`;
    },
  };
}

/** A tradition's name: the game's, or one of yours. */
export function useTraditionName() {
  const custom = useCustomTraditions();
  return (id: string) => (id.startsWith(TRADITION_PREFIX) ? custom.list.find((t) => `${TRADITION_PREFIX}${t.id}` === id)?.name ?? 'Removed tradition' : BY_ID.traditions.get(id)?.name ?? id);
}

/** "in 6 days", "tomorrow", "today", "now" (a vacation under way), or nothing for the past or a save with no date. */
export function whenText(ctx: CalCtx, i: Pick<CalItem, 'kind' | 'day' | 'end'>): string {
  if (!ctx.info.track) return '';
  const t = ctx.info.today;
  if (i.kind === 'vacation' && i.day <= t && i.end >= t) return 'now';
  return i.day >= t ? daysWord(i.day - t) : '';
}

// ---------- Coming up (Sim profile, household page) ----------
/** The next 3 things for these Sims, with See all. Hidden when the save doesn't track the date. */
export function ComingUp({ save, simIds, seeAll, showFaces }: { save: SaveRow; simIds: string[]; seeAll: string; showFaces?: boolean }) {
  const ctx = useCalCtx(save);
  if (!ctx.info.track || !simIds.length) return null;
  const today = ctx.info.today;
  const list = comingUp(ctx.state, simIds, today);
  const mine = new Set(simIds);
  return (
    <section className="card">
      <div className="card-head"><h2>Coming up</h2><a className="btn ghost sm" style={{ color: 'var(--accent)' }} href={savePath(save.id, seeAll)}>See all</a></div>
      {list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>Nothing on the calendar yet.</p> : (
        <div className="cal-cu">
          {list.map((i) => {
            const d = dateOf(i.day, ctx.info.cal);
            // On a Sim's page the age block already counts the days, so the birthday just says what's next.
            const sub = i.kind === 'birthday' ? (!showFaces && i.toStage ? `Ages up to ${stageName(i.toStage).toLowerCase()}` : `Birthday · ${daysWord(i.day - today)}`)
              : i.kind === 'vacation' ? `${i.getaway ? 'Getaway' : 'Vacation'} · ${spanText(ctx, i.day, i.end)}`
              : showFaces ? (i.host ? `Hosted by ${ctx.firstOf(i.host)}` : 'Event')
              : i.host && mine.has(i.host) ? 'Event · hosting' : 'Event · going';
            const faces = showFaces && i.kind !== 'birthday' ? i.sims.filter((x) => mine.has(x)) : [];
            return (
              <a key={i.key} className={`cal-cu-row k-${i.kind}`} href={i.kind === 'birthday' ? savePath(save.id, `sims/${i.id}`) : savePath(save.id, `calendar/${i.kind}/${i.id}`)}>
                <span className="cal-when"><b>{d.day}</b><span>{SEASONS[d.season]}</span></span>
                <span className="grow"><b>{itemTitle(ctx, i)}</b><span className="s">{sub}</span></span>
                {faces.length > 0 && <span className="hh-faces" style={{ ['--f' as string]: '28px' }}>{faces.slice(0, 4).map((id) => <span key={id} className="hh-face"><SimAvatar sim={ctx.simById.get(id) as SimData} size={28} /></span>)}</span>}
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
