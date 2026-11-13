import { useState } from 'react';
import { ArrowCounterClockwise, ArrowRight, CalendarBlank, FastForward } from '@phosphor-icons/react';
import { saveData, todayOf } from '../lib/saves';
import { useStore } from '../lib/sync/react';
import type { SaveRow } from '../lib/sync/types';
import { dateOf, dayOf, formatDate, type SimDate } from '../lib/time';
import { plural } from '../lib/text';
import { DateFrame, DateGrid } from './SeasonPicker';
import { Sheet, toast } from './ui';

/** Moves the save's "today" by n days (back when n is negative). Sims' ages follow on their own. Undo puts it back. */
export function useMoveDays(save: SaveRow) {
  const store = useStore();
  return (n: number) => {
    if (!n) return;
    const d = saveData(store.saves.get(save.id) ?? save);
    const from = d.today;
    const to = Math.max(0, from + n);
    store.updateSave(save.id, { today: to });
    const when = formatDate(dateOf(to, d.calendar), 'weekday');
    const text = n === 1 ? `It’s ${when}` : n > 0 ? `Jumped ahead ${plural(to - from, 'day')} to ${when}` : `Went back ${plural(from - to, 'day')} to ${when}`;
    toast(text, { label: 'Undo', run: () => store.updateSave(save.id, { today: from }) });
  };
}

export function NextDayButton({ save, className = 'btn primary' }: { save: SaveRow; className?: string }) {
  const move = useMoveDays(save);
  return <button type="button" className={className} onClick={() => move(1)}>Next day <ArrowRight size={16} weight="bold" /></button>;
}

/** The calendar for Jump ahead (only later days) or Go back (only earlier days). */
export function JumpDialog({ save, mode, onClose }: { save: SaveRow; mode: 'ahead' | 'back'; onClose(): void }) {
  const d = saveData(save);
  const today = todayOf(d);
  const move = useMoveDays(save);
  const [pick, setPick] = useState<SimDate | null>(null);
  const [view, setView] = useState({ year: today.year, season: today.season });
  const n = pick ? dayOf(pick, d.calendar) - d.today : 0;
  const ahead = mode === 'ahead';
  const isOff = (x: SimDate) => {
    const day = dayOf(x, d.calendar);
    return ahead ? day <= d.today : day >= d.today || day < 0;
  };
  const days = Math.abs(n);
  return (
    <DateFrame title={ahead ? 'Jump ahead to' : 'Go back to'} onClose={onClose}>
      <DateGrid view={view} setView={setView} seasonLength={d.calendar.seasonLength} today={today}
        isSel={(x) => !!pick && x.year === pick.year && x.season === pick.season && x.day === pick.day}
        isOff={isOff} onPick={setPick} />
      {pick ? (
        ahead
          ? <p className="jump-note">{formatDate(pick, 'short')} · {plural(days, 'day')} ahead. Sims age {plural(days, 'day')}, and birthdays along the way show up in Coming up.</p>
          : <p className="jump-note back"><b>Back to {formatDate(pick, 'short')}</b>, {plural(days, 'day')} earlier. Sims get {plural(days, 'day')} younger. Nothing you logged gets deleted.</p>
      ) : <p className="jump-note muted">{ahead ? 'Tap the day your game is on now.' : 'Tap the day to go back to.'}</p>}
      <div className="row jump-foot">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!pick} onClick={() => { move(n); onClose(); }}>
          {pick ? (ahead ? `Jump ahead ${plural(days, 'day')}` : `Go back ${plural(days, 'day')}`) : ahead ? 'Jump ahead' : 'Go back'}
        </button>
      </div>
    </DateFrame>
  );
}

/** Next day, Jump ahead and Go back side by side (Today page). */
export function DayButtons({ save, phone }: { save: SaveRow; phone?: boolean }) {
  const [jump, setJump] = useState<null | 'ahead' | 'back'>(null);
  return (
    <>
      <div className={`day-btns${phone ? ' phone' : ''}`}>
        {phone && <button type="button" className="btn icon" aria-label="Go back" title="Go back" onClick={() => setJump('back')}><ArrowCounterClockwise size={20} /></button>}
        {phone && <button type="button" className="btn icon" aria-label="Jump ahead" title="Jump ahead" onClick={() => setJump('ahead')}><FastForward size={20} weight="duotone" /></button>}
        <NextDayButton save={save} className={`btn primary${phone ? '' : ' sm'}`} />
        {!phone && <button type="button" className="btn sm" onClick={() => setJump('ahead')}><CalendarBlank size={16} weight="duotone" /> Jump ahead</button>}
        {!phone && <button type="button" className="btn ghost sm day-back" onClick={() => setJump('back')}><ArrowCounterClockwise size={16} /> Go back</button>}
      </div>
      {jump && <JumpDialog save={save} mode={jump} onClose={() => setJump(null)} />}
    </>
  );
}

/** Phone: tapping the date pill opens this. */
export function DateSheet({ save, onClose }: { save: SaveRow; onClose(): void }) {
  const d = saveData(save);
  const move = useMoveDays(save);
  const [jump, setJump] = useState<null | 'ahead' | 'back'>(null);
  if (jump) return <JumpDialog save={save} mode={jump} onClose={onClose} />;
  return (
    <Sheet title={formatDate(todayOf(d), 'weekday')} onClose={onClose}>
      <div className="stack" style={{ gap: 10, paddingBottom: 8 }}>
        <button type="button" className="btn primary" onClick={() => { move(1); onClose(); }}>Next day <ArrowRight size={16} weight="bold" /></button>
        <button type="button" className="btn" onClick={() => { move(7); onClose(); }}>Next week</button>
        <button type="button" className="btn" onClick={() => setJump('ahead')}><CalendarBlank size={16} weight="duotone" /> Pick a date</button>
        <button type="button" className="btn ghost" onClick={() => setJump('back')}><ArrowCounterClockwise size={16} /> Go back</button>
      </div>
    </Sheet>
  );
}
