import { useMemo } from 'react';
import { DEFAULT_REAL_AGES, realAgeShort, realAgeText, realAgeYears, sanitizeRanges, type RealAgeRanges } from '../../lib/realAges';
import { available, BY_ID, GAME, optionsWithChosen } from '../../data/game';
import { PhotoBox } from '../../components/photo';
import { ownedOf, saveData, tableOf } from '../../lib/saves';
import {
  fullName, householdName, initials, simAge, simData, stageOf, TRAIT_PREFIX, type BirthdayView, type CustomTrait, type SimAge, type SimData, type SimRow,
} from '../../lib/sims';
import { useAccount, useRecords } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { newId } from '../../lib/sync/store';
import type { Option } from '../../components/ui';

/** Everything about the open save that the Sims pages need. */
export function useSaveInfo(save: SaveRow) {
  return useMemo(() => {
    const d = saveData(save);
    return { d, table: tableOf(d), today: d.today, cal: d.calendar, track: d.trackDate, avail: available(ownedOf(d)) };
  }, [save]);
}
export type SaveInfo = ReturnType<typeof useSaveInfo>;

export function useHouseholds() {
  const recs = useRecords('household');
  return useMemo(() => {
    const list = [...recs].sort((a, b) => householdName(a).localeCompare(householdName(b), undefined, { sensitivity: 'base' }));
    return { list, nameOf: (id: string | null) => (id ? householdName(recs.find((r) => r.id === id)) : '') , byId: new Map(recs.map((r) => [r.id, r])) };
  }, [recs]);
}

/** Real-life ages: the ranges (App settings, account-wide) and whether this save shows them. */
export function useRealAgeRanges() {
  const acct = useAccount();
  const ranges = sanitizeRanges((acct.data.prefs as { realAges?: RealAgeRanges } | undefined)?.realAges);
  return {
    ranges,
    isDefault: JSON.stringify(ranges) === JSON.stringify(DEFAULT_REAL_AGES),
    set: (r: RealAgeRanges) => acct.update((d) => ({ ...d, prefs: { ...((d.prefs as object | undefined) ?? {}), realAges: r } })),
  };
}
/** "24 years old" for a Sim, or null when the save doesn't show real-life ages (or doesn't track the date). */
export function useRealAge(info: SaveInfo): (age: SimAge, deceased?: boolean) => { long: string; short: string } | null {
  const { ranges } = useRealAgeRanges();
  const on = info.d.realAges && info.track;
  const key = JSON.stringify(ranges);
  return useMemo(() => (age: SimAge, deceased?: boolean) => {
      if (!on || deceased || age.kind !== 'age') return null;
      const y = realAgeYears(age.age, ranges);
      return { long: realAgeText(y), short: realAgeShort(y) };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [on, key]);
}

/** Every Sim in the save as list rows (deceased included; the filters decide what shows). */
export function useSimRows(info: SaveInfo): SimRow[] {
  const recs = useRecords('sim');
  const hh = useHouseholds();
  const real = useRealAge(info);
  return useMemo(() => recs.map((r) => {
    const sim = simData(r);
    const age = simAge(sim, info.today, info.table, info.track);
    return { id: r.id, sim, name: fullName(sim), household: hh.nameOf(sim.householdId), age, stage: stageOf(age), realAge: real(age, !!sim.deceased)?.long ?? null, realAgeShort: real(age, !!sim.deceased)?.short ?? null };
  }), [recs, hh, info, real]);
}

// ---------- account-wide ----------
type AccountData = { customTraits?: CustomTrait[]; prefs?: { birthdayView?: BirthdayView } };

export function useCustomTraits() {
  const acct = useAccount();
  const list = ((acct.data as AccountData).customTraits ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const set = (next: CustomTrait[]) => acct.update((d) => ({ ...d, customTraits: next }));
  return {
    list,
    add(name: string): string {
      const clean = name.trim();
      const same = list.find((t) => t.name.toLowerCase() === clean.toLowerCase());
      if (same) return `${TRAIT_PREFIX}${same.id}`;
      const t = { id: newId(), name: clean };
      set([...list, t]);
      return `${TRAIT_PREFIX}${t.id}`;
    },
    rename(id: string, name: string) { set(list.map((t) => (t.id === id ? { ...t, name: name.trim() } : t))); },
    remove(id: string) { set(list.filter((t) => t.id !== id)); },
    restore(t: CustomTrait) { set([...list.filter((x) => x.id !== t.id), t]); },
  };
}

/** "In 3 days" or "Spring 11". Follows the account to every device. */
export function useBirthdayView(): [BirthdayView, (v: BirthdayView) => void] {
  const acct = useAccount();
  const v = (acct.data as AccountData).prefs?.birthdayView ?? 'countdown';
  return [v, (next) => acct.update((d) => ({ ...d, prefs: { ...((d as AccountData).prefs ?? {}), birthdayView: next } }))];
}

// ---------- pickers ----------
export function traitOptions(info: SaveInfo, custom: CustomTrait[], chosen: string[]): Option[] {
  const game = optionsWithChosen(info.avail.traits, BY_ID.traits, chosen.filter((c) => !c.startsWith(TRAIT_PREFIX)));
  const groupOf = new Map(GAME.traits.map((t) => [t.id, t.category]));
  const gameOpts = (game as Option[]).map((o) => ({ ...o, group: o.group ?? groupOf.get(o.id) }))
    .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
  return [...custom.map((t) => ({ id: `${TRAIT_PREFIX}${t.id}`, label: t.name, group: 'Your traits' })), ...gameOpts];
}

export function aspirationOptions(info: SaveInfo, chosen: string | null): Option[] {
  const groupOf = new Map(GAME.aspirations.map((t) => [t.id, t.category]));
  return (optionsWithChosen(info.avail.aspirations, BY_ID.aspirations, chosen && !chosen.startsWith('text:') ? [chosen] : []) as Option[])
    .map((o) => ({ ...o, group: o.group ?? groupOf.get(o.id) }))
    .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
}

export function occultOptions(info: SaveInfo, chosen: string | null) {
  const ids = new Set(info.avail.occults.map((o) => o.id));
  const list = info.avail.occults.map((o) => ({ id: o.id, label: o.name }));
  if (chosen && !ids.has(chosen)) list.push({ id: chosen, label: `${BY_ID.occults.get(chosen)?.name ?? chosen} (pack is off)` });
  return list.sort((a, b) => a.label.localeCompare(b.label));
}

// ---------- pieces ----------
/** The round photo (small copy) or initials on one soft tint. */
export function SimAvatar({ sim, size = 34 }: { sim: Pick<SimData, 'first' | 'last' | 'portrait'>; size?: number }) {
  if (sim.portrait) {
    return <PhotoBox photo={sim.portrait} aspect={1} size="thumb" className="sim-avatar" style={{ width: size, height: size }} />;
  }
  return <span className="sim-avatar initials" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">{initials(sim)}</span>;
}

