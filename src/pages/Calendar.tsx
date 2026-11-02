import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Cake, CaretLeft, CaretRight, Confetti, FastForward, Plus, UsersThree } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { useStageTable } from '../store/hooks';
import { eventsBetween, type CalEvent } from '../lib/events';
import { SEASONS, WEEKDAYS, STAGE_LABEL, toIndex, formatSeasonDay } from '../lib/time';
import type { Holiday, SeasonIndex } from '../lib/types';
import { ObjIcon } from '../components/categories';
import { HolidayForm } from '../components/HolidayForm';
import { JumpAheadButton } from '../components/JumpAhead';
import { Modal } from '../components/ui';

export default function CalendarPage() {
  const save = useSave()!;
  const table = useStageTable();
  const { recs } = useStore();
  const len = save.seasonLength;
  const [view, setView] = useState({ year: save.date.year, season: save.date.season });
  const [holidayEdit, setHolidayEdit] = useState<Holiday | { season: SeasonIndex; day: number; year: number } | null>(null);
  const [dayOpen, setDayOpen] = useState<number | null>(null);

  const events = useMemo(
    () =>
      eventsBetween(
        save,
        { year: view.year, season: view.season as SeasonIndex, day: 1 },
        { year: view.year, season: view.season as SeasonIndex, day: len },
        { sims: Object.values(recs.sim), holidays: Object.values(recs.holiday), clubs: Object.values(recs.club) },
        table,
      ),
    [save, view, len, recs, table],
  );
  const byDay = useMemo(() => {
    const m = new Map<number, CalEvent[]>();
    for (const e of events) m.set(e.date.day, [...(m.get(e.date.day) ?? []), e]);
    return m;
  }, [events]);

  const isToday = (day: number) => save.trackDate && view.year === save.date.year && view.season === save.date.season && day === save.date.day;
  const shift = (n: number) => {
    const i = view.year * 4 + view.season + n;
    setView({ year: Math.floor(i / 4), season: ((i % 4) + 4) % 4 as SeasonIndex });
  };
  const holidays = Object.values(recs.holiday).sort((a, b) => a.season - b.season || a.day - b.day);
  const atToday = view.year === save.date.year && view.season === save.date.season;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 12 }}><ObjIcon cat="calendar" size="lg" /> Calendar</h1>
          <div className="sub">{save.trackDate ? `Today is ${SEASONS[save.date.season]}, Day ${save.date.day}, Year ${save.date.year}` : 'Date tracking is off. Birthdays and holidays still show.'}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setHolidayEdit({ season: view.season as SeasonIndex, day: 1, year: view.year })}><Plus size={16} weight="bold" /> Add holiday</button>
          {save.trackDate && <JumpAheadButton className="btn primary"><FastForward size={16} weight="duotone" /> Jump ahead</JumpAheadButton>}
        </div>
      </div>

      <section className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="row">
            <button className="btn icon sm" aria-label="Previous season" onClick={() => shift(-1)}><CaretLeft size={16} weight="bold" /></button>
            <h2 style={{ fontSize: 22, minWidth: 170, textAlign: 'center' }}>{SEASONS[view.season]} · Year {view.year}</h2>
            <button className="btn icon sm" aria-label="Next season" onClick={() => shift(1)}><CaretRight size={16} weight="bold" /></button>
          </div>
          <div className="row small">
            {!atToday && <button className="btn sm" onClick={() => setView({ year: save.date.year, season: save.date.season })}>Back to today</button>}
            <span className="muted">{len} days</span>
          </div>
        </div>
        <div className="cal-grid" role="grid" aria-label={`${SEASONS[view.season]}, Year ${view.year}`}>
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd" role="columnheader"><span className="wd-long">{w}</span><span className="wd-short">{w.slice(0, 3)}</span></div>)}
          {Array.from({ length: len }, (_, i) => {
            const day = i + 1;
            const ev = byDay.get(day) ?? [];
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                className={`cal-day ${isToday(day) ? 'today' : ''}`}
                aria-label={`${SEASONS[view.season]} ${day}${ev.length ? `, ${ev.length} events` : ''}`}
                onClick={() => setDayOpen(day)}
              >
                <span className="cal-num">{day}</span>
                <span className="cal-tags">
                  {ev.slice(0, 3).map((e, k) => <EventTag key={k} e={e} />)}
                  {ev.length > 3 && <span className="tiny muted bold">+{ev.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="row tiny muted" style={{ marginTop: 12, gap: 14 }}>
          <span className="row" style={{ gap: 6 }}><span className="tag calendar" style={{ height: 18 }}><Confetti size={11} /></span>Holiday</span>
          <span className="row" style={{ gap: 6 }}><span className="tag sims" style={{ height: 18 }}><Cake size={11} /></span>Birthday</span>
          {save.trackDate && <span className="row" style={{ gap: 6 }}><span className="tag sims" style={{ height: 18 }}><ArrowUp size={11} /></span>Ages up</span>}
          <span className="row" style={{ gap: 6 }}><span className="tag clubs" style={{ height: 18 }}><UsersThree size={11} /></span>Club meets</span>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2><ObjIcon cat="calendar" /> Holidays</h2><span className="small muted">{holidays.length}</span></div>
        {holidays.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>A clean slate. Add the holidays your town actually celebrates.</p>
        ) : (
          <div className="stack" style={{ gap: 2 }}>
            {holidays.map((h) => (
              <button key={h.id} type="button" className="list-item" style={{ border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => setHolidayEdit(h)}>
                <span className="obj calendar"><Confetti size={16} weight="duotone" /></span>
                <span className="grow">
                  <span className="bold" style={{ display: 'block' }}>{h.name}</span>
                  <span className="tiny muted">{h.traditions.join(' · ') || 'No traditions yet'}</span>
                </span>
                <span className="small muted">{formatSeasonDay(h.season, Math.min(h.day, len))}{h.repeats ? '' : `, Year ${h.year}`}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {holidayEdit && <HolidayForm holiday={'id' in holidayEdit ? holidayEdit : undefined} initial={'id' in holidayEdit ? undefined : holidayEdit} onClose={() => setHolidayEdit(null)} />}
      {dayOpen != null && (
        <Modal
          title={`${SEASONS[view.season]}, Day ${dayOpen}`}
          onClose={() => setDayOpen(null)}
          footer={<><button className="btn" onClick={() => setDayOpen(null)}>Close</button><button className="btn primary" onClick={() => { setHolidayEdit({ season: view.season as SeasonIndex, day: dayOpen, year: view.year }); setDayOpen(null); }}><Plus size={14} weight="bold" /> Add holiday here</button></>}
        >
          <DayList events={byDay.get(dayOpen) ?? []} onHoliday={(id) => { setDayOpen(null); setHolidayEdit(recs.holiday[id]); }} />
          {save.trackDate && (() => {
            const diff = toIndex({ year: view.year, season: view.season as SeasonIndex, day: dayOpen }, len) - toIndex(save.date, len);
            return <p className="tiny muted" style={{ marginBottom: 0 }}>{diff === 0 ? 'That’s today.' : diff > 0 ? `${diff} day${diff === 1 ? '' : 's'} from today.` : `${-diff} day${diff === -1 ? '' : 's'} ago.`}</p>;
          })()}
        </Modal>
      )}
      <style>{`
        .cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
        .cal-wd{font-size:12px;font-weight:600;color:var(--muted);padding:0 6px 4px}
        .wd-short{display:none}
        .cal-day{min-height:104px;border:1px solid var(--line);background:var(--field);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;text-align:left;cursor:pointer;min-width:0}
        .cal-day:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line))}
        .cal-day.today{border:2px solid var(--accent);background:var(--surface)}
        .cal-day.today .cal-num{background:var(--accent);color:var(--accent-ink);border-radius:8px;padding:0 7px}
        .cal-num{font-weight:700;font-size:13px;align-self:flex-start}
        .cal-tags{display:flex;flex-direction:column;gap:4px;min-width:0}
        .cal-tags .tag{height:22px;font-size:11px;padding:0 8px;justify-content:flex-start}
        @media (max-width:760px){.wd-long{display:none}.wd-short{display:inline}.cal-day{min-height:64px;padding:5px;gap:3px}.cal-tags .tag{font-size:0;padding:0;width:100%;height:6px;border-radius:3px}.cal-tags .tag svg{display:none}.cal-tags .tiny{display:none}}
      `}</style>
    </div>
  );
}

function EventTag({ e }: { e: CalEvent }) {
  const cls = e.kind === 'holiday' ? 'calendar' : e.kind === 'club' ? 'clubs' : 'sims';
  const Icon = e.kind === 'holiday' ? Confetti : e.kind === 'club' ? UsersThree : e.kind === 'ageUp' ? ArrowUp : Cake;
  return (
    <span className={`tag ${cls}`} title={e.label}>
      <Icon size={11} weight="bold" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</span>
    </span>
  );
}

function DayList({ events, onHoliday }: { events: CalEvent[]; onHoliday(id: string): void }) {
  if (!events.length) return <p className="small muted" style={{ marginTop: 0 }}>Nothing planned. Perfect day for chaos.</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {events.map((e, i) => (
        <div key={i} className="row small" style={{ flexWrap: 'nowrap' }}>
          <EventTag e={e} />
          <span className="grow">
            {e.kind === 'ageUp' && <>Ages up to {STAGE_LABEL[e.stage!].toLowerCase()}</>}
            {e.kind === 'birthday' && 'Birthday'}
            {e.kind === 'club' && 'Club meeting'}
            {e.kind === 'holiday' && 'Holiday'}
          </span>
          {e.kind === 'holiday' ? (
            <button className="btn ghost sm" onClick={() => onHoliday(e.refId)}>Edit</button>
          ) : (
            <Link className="btn ghost sm" to={e.kind === 'club' ? `../clubs/${e.refId}` : `../sims/${e.refId}`}>Open</Link>
          )}
        </div>
      ))}
    </div>
  );
}
