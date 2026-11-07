import { useState } from 'react';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useIsPhone } from '../lib/useIsPhone';
import { dateIndex, SEASONS, WEEKDAYS, type Season, type SeasonLength, type SimDate } from '../lib/time';
import { SeasonBanner } from './SeasonArt';
import { Modal, Sheet } from './ui';

/**
 * The calendar picker used wherever a date is chosen. One season at a time, with the season's scene on top.
 * Every season starts on a Sunday, so the grid needs no calendar to line up. No typing; just tap a day.
 */
type Shared = {
  seasonLength: SeasonLength;
  /** Today in the game, drawn with a ring. Left out when the save doesn't track the date. */
  today?: SimDate | null;
  /** Holidays repeat every year, so they pick a season and day only. */
  yearless?: boolean;
  label: string;
};

const shift = (v: { year: number; season: Season }, step: 1 | -1) => {
  const i = (v.year - 1) * 4 + v.season + step;
  return { year: Math.max(1, Math.floor(i / 4) + 1), season: (((i % 4) + 4) % 4) as Season };
};
const seasonDay = (d: SimDate) => `${SEASONS[d.season]} ${d.day}`;
const fieldText = (d: SimDate, yearless?: boolean) => (yearless ? seasonDay(d) : `${seasonDay(d)} · Year ${d.year}`);

function Trigger({ label, text, onOpen }: { label: string; text: string; onOpen(): void }) {
  return (
    <button type="button" className="select dp-field" aria-label={`${label}: ${text}. Change`} onClick={onOpen}>
      <span>{text}</span><CalendarBlank size={18} weight="duotone" aria-hidden="true" />
    </button>
  );
}

/** The pop-up: a bottom sheet on phones, a small window elsewhere. */
export function DateFrame({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  const phone = useIsPhone();
  if (phone) return <Sheet title={title} onClose={onClose}>{children}</Sheet>;
  return <Modal title={title} onClose={onClose} autoFocus={false} className="dp-modal">{children}</Modal>;
}

export function DateGrid({ view, setView, seasonLength, today, yearless, isSel, inRange, onPick, note, isOff }: {
  view: { year: number; season: Season }; setView(v: { year: number; season: Season }): void; seasonLength: SeasonLength; today?: SimDate | null; yearless?: boolean;
  isSel(d: SimDate): boolean; inRange?(d: SimDate): boolean; onPick(d: SimDate): void; note?: string;
  /** Days that can't be picked (greyed out), like past days for Jump ahead. */
  isOff?(d: SimDate): boolean;
}) {
  const isToday = (d: SimDate) => !!today && today.year === d.year && today.season === d.season && today.day === d.day;
  return (
    <div className="dp">
      <SeasonBanner season={view.season} className="sm">
        <div><h2>{SEASONS[view.season]}</h2>{!yearless && <div className="s">Year {view.year}</div>}</div>
        <div className="cal-nav">
          <button type="button" className="btn icon fog" aria-label="Previous season" onClick={() => setView(shift(view, -1))}><CaretLeft size={18} weight="bold" /></button>
          <button type="button" className="btn icon fog" aria-label="Next season" onClick={() => setView(shift(view, 1))}><CaretRight size={18} weight="bold" /></button>
        </div>
      </SeasonBanner>
      <div className="dp-grid" role="grid" aria-label={`${SEASONS[view.season]}${yearless ? '' : ` year ${view.year}`}`}>
        {WEEKDAYS.map((w) => <span key={w} className="dp-wd" aria-hidden="true">{w.slice(0, 1)}</span>)}
        {Array.from({ length: seasonLength }, (_, i) => {
          const d: SimDate = { year: view.year, season: view.season, day: i + 1 };
          const sel = isSel(d);
          const off = !!isOff?.(d);
          return (
            <button key={i} type="button" className={`dp-day ${sel ? 'sel' : ''} ${!sel && inRange?.(d) ? 'mid' : ''} ${isToday(d) ? 'today' : ''} ${off ? 'off' : ''}`} disabled={off} aria-pressed={sel} aria-label={`${seasonDay(d)}${isToday(d) ? ', today' : ''}`} onClick={() => onPick(d)}>{i + 1}</button>
          );
        })}
      </div>
      {note && <p className="dp-note" role="status">{note}</p>}
    </div>
  );
}

/** One date. */
export function DateField({ value, onChange, label, ...s }: Shared & { value: SimDate; onChange(d: SimDate): void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: value.year, season: value.season });
  const day = Math.min(value.day, s.seasonLength);
  return (
    <>
      <Trigger label={label} text={fieldText({ ...value, day }, s.yearless)} onOpen={() => { setView({ year: value.year, season: value.season }); setOpen(true); }} />
      {open && (
        <DateFrame title={label} onClose={() => setOpen(false)}>
          <DateGrid view={view} setView={setView} seasonLength={s.seasonLength} today={s.today} yearless={s.yearless}
            isSel={(d) => d.year === value.year && d.season === value.season && d.day === day}
            onPick={(d) => { onChange(s.yearless ? { ...d, year: value.year } : d); setOpen(false); }} />
        </DateFrame>
      )}
    </>
  );
}

/**
 * The range calendar on its own, to sit inside another sheet or window: tap the first day, then the last.
 * `onPick` fires once both are chosen. `from` and `to` are drawn as the current range (null: nothing picked yet).
 */
export function RangePanel({ from, to, onPick, seasonLength, today, start, hint = 'Tap the first day.' }: {
  from: SimDate | null; to: SimDate | null; onPick(from: SimDate, to: SimDate): void; seasonLength: SeasonLength; today?: SimDate | null; start: SimDate; hint?: string;
}) {
  const [view, setView] = useState({ year: (from ?? start).year, season: (from ?? start).season });
  const [first, setFirst] = useState<SimDate | null>(null);
  const [note, setNote] = useState(hint);
  const idx = (d: SimDate) => dateIndex(d, seasonLength);
  const same = (a: SimDate, b: SimDate) => idx(a) === idx(b);
  const pick = (d: SimDate) => {
    if (!first) { setFirst(d); setNote('Now tap the last day. Same day for a single day.'); return; }
    if (idx(d) < idx(first)) { setNote('That’s before the first day. Tap a later day.'); return; }
    onPick(first, d);
  };
  const [a, b] = first ? [first, first] : [from, to];
  return (
    <DateGrid view={view} setView={setView} seasonLength={seasonLength} today={today}
      isSel={(d) => (!!a && same(d, a)) || (!!b && same(d, b))} inRange={(d) => !!a && !!b && idx(d) > idx(a) && idx(d) < idx(b)} onPick={pick} note={note} />
  );
}

/** A span of days: tap the first day, then the last. */
export function RangeField({ from, to, onChange, label, ...s }: Shared & { from: SimDate; to: SimDate; onChange(from: SimDate, to: SimDate): void }) {
  const [open, setOpen] = useState(false);
  const same = (a: SimDate, b: SimDate) => dateIndex(a, s.seasonLength) === dateIndex(b, s.seasonLength);
  const text = same(from, to) ? fieldText(from) : from.year === to.year ? `${seasonDay(from)} → ${seasonDay(to)} · Year ${from.year}` : `${fieldText(from)} → ${fieldText(to)}`;
  return (
    <>
      <Trigger label={label} text={text} onOpen={() => setOpen(true)} />
      {open && (
        <DateFrame title={label} onClose={() => setOpen(false)}>
          <RangePanel from={from} to={to} start={from} seasonLength={s.seasonLength} today={s.today} onPick={(a, b) => { onChange(a, b); setOpen(false); }} />
        </DateFrame>
      )}
    </>
  );
}
