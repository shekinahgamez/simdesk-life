import { useState } from 'react';
import { CalendarBlank, FlowerTulip, Leaf, Snowflake, Sun } from '@phosphor-icons/react';
import { approxDay, dateOf, dayOf, SEASONS, yearText, type Calendar, type Season } from '../lib/time';
import type { Precision } from '../lib/storylines';
import { DateFrame, DateGrid } from './SeasonPicker';

/**
 * "When" for something that already happened: an exact day, just a season, just a year, or no date.
 * Years go below 1 for the time before the save began (Year 0, Year −1 …).
 */
export type When = { day: number | null; precision: Precision };
type Mode = Precision | 'none';
const ICONS = [FlowerTulip, Sun, Leaf, Snowflake];
const MODES: { v: Mode; label: string }[] = [{ v: 'day', label: 'Exact day' }, { v: 'season', label: 'Season' }, { v: 'year', label: 'Year only' }, { v: 'none', label: 'Don’t know' }];
const MIN_YEAR = -99;

export function whenText(w: When, cal: Calendar): string {
  if (w.day == null) return 'No date';
  const d = dateOf(w.day, cal);
  if (w.precision === 'year') return `Year ${yearText(d.year)}`;
  if (w.precision === 'season') return `${SEASONS[d.season]} · Year ${yearText(d.year)}`;
  return `${SEASONS[d.season]} ${d.day} · Year ${yearText(d.year)}`;
}

export function WhenField({ value, onChange, cal, today, label = 'When' }: { value: When; onChange(w: When): void; cal: Calendar; today: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const now = dateOf(today, cal);
  const cur = dateOf(value.day ?? today, cal);
  const [mode, setMode] = useState<Mode>('day');
  const [view, setView] = useState({ year: cur.year, season: cur.season });
  const text = whenText(value, cal);
  const openIt = () => { setMode(value.day == null ? 'none' : value.precision); setView({ year: cur.year, season: cur.season }); setOpen(true); };
  const commit = (w: When) => { onChange(w); setOpen(false); };
  const setYear = (y: number) => setView((v) => ({ ...v, year: Math.max(MIN_YEAR, y) }));
  return (
    <>
      <button type="button" className="select dp-field" aria-label={`${label}: ${text}. Change`} onClick={openIt}>
        <span>{text}</span><CalendarBlank size={18} weight="duotone" aria-hidden="true" />
      </button>
      {open && (
        <DateFrame title={label} onClose={() => setOpen(false)}>
          <div className="when-pick">
            <div className="when-seg" role="group" aria-label="How exact">
              {MODES.map((m) => <button key={m.v} type="button" aria-pressed={mode === m.v} onClick={() => setMode(m.v)}>{m.label}</button>)}
            </div>
            {mode === 'day' && (
              <DateGrid view={view} setView={setView} seasonLength={cal.seasonLength} today={now} minYear={MIN_YEAR}
                isSel={(d) => value.day != null && value.precision === 'day' && dayOf(d, cal) === value.day}
                onPick={(d) => commit({ day: dayOf(d, cal), precision: 'day' })} />
            )}
            {(mode === 'season' || mode === 'year') && (
              <>
                {mode === 'season' && (
                  <div className="when-ssn" role="group" aria-label="Season">
                    {SEASONS.map((n, i) => { const I = ICONS[i]; return (
                      <button key={n} type="button" aria-pressed={view.season === i} onClick={() => setView((v) => ({ ...v, season: i as Season }))}><I size={24} weight="duotone" aria-hidden="true" />{n}</button>
                    ); })}
                  </div>
                )}
                <div className="when-yr">
                  <button type="button" className="btn icon" aria-label="Earlier year" onClick={() => setYear(view.year - 1)}>−</button>
                  <b>Year {yearText(view.year)}</b>
                  <button type="button" className="btn icon" aria-label="Later year" onClick={() => setYear(view.year + 1)}>+</button>
                </div>
                <p className="muted small">{view.year >= 1 ? 'Year 1 is where your save started.' : `${1 - view.year} year${view.year === 0 ? '' : 's'} before the save began. Year 1 is where you started.`}</p>
                <button type="button" className="btn primary" onClick={() => commit({ day: approxDay(mode, view.year, view.season, cal), precision: mode })}>Done</button>
              </>
            )}
            {mode === 'none' && (
              <>
                <p className="muted small">It still shows on the timeline, with an Add date nudge.</p>
                <button type="button" className="btn primary" onClick={() => commit({ day: null, precision: 'day' })}>Done</button>
              </>
            )}
          </div>
        </DateFrame>
      )}
    </>
  );
}
