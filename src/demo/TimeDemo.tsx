import { useEffect, useMemo, useState } from 'react';
import { Hourglass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { AgeFields, bornDayFromInput, defaultAge, inputFromBornDay, type AgeInput } from '../components/AgeFields';
import { Field, Modal, Seg, TextInput } from '../components/ui';
import {
  ageOf, birthdaysBetween, changeSeasonLength, dateOf, formatDate, newCalendar, rescaleBornDay, stageName, stageTable,
  type Calendar, type SeasonLength,
} from '../lib/time';
import { plural } from '../lib/text';

/** Test area for step 7 on the style check page: the time engine. Example Sims only, saved on this device. */

type DemoSim = { id: string; name: string; bornDay: number; addedDay: number };
type State = { today: number; calendar: Calendar; lifespan: 'short' | 'normal' | 'long'; sims: DemoSim[] };
const KEY = 'sd:demo-time';

function start(): State {
  const table = stageTable({ preset: 'normal' });
  const today = 227; // Year 3, Spring, Day 4 on 4-week seasons
  const mk = (id: string, name: string, a: AgeInput): DemoSim => ({ id, name, bornDay: bornDayFromInput(a, today, table), addedDay: today });
  return {
    today, calendar: newCalendar(28, 0), lifespan: 'normal',
    sims: [
      mk('ava', 'Ava Ramírez', { stage: 'teen', fresh: false, birthdayIn: 5, daysAsElder: 0 }),
      mk('bella', 'Bella Goth', { stage: 'adult', fresh: true, birthdayIn: 42, daysAsElder: 0 }),
      mk('grandma', 'Agnes Crumplebottom', { stage: 'elder', fresh: false, birthdayIn: 1, daysAsElder: 12 }),
    ],
  };
}
function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null;
    if (s && s.calendar && Array.isArray(s.sims)) return s;
  } catch { /* ignore */ }
  return start();
}

const LENGTHS: { v: SeasonLength; label: string }[] = [
  { v: 7, label: '1 week' }, { v: 14, label: '2 weeks' }, { v: 21, label: '3 weeks' }, { v: 28, label: '4 weeks' },
];
const SPANS: { v: 'short' | 'normal' | 'long'; label: string }[] = [{ v: 'short', label: 'Short' }, { v: 'normal', label: 'Normal' }, { v: 'long', label: 'Long' }];

function SimForm({ sim, s, onSave, onClose }: { sim: DemoSim | null; s: State; onSave(name: string, bornDay: number): void; onClose(): void }) {
  const table = stageTable({ preset: s.lifespan });
  const [name, setName] = useState(sim?.name ?? '');
  const [age, setAge] = useState<AgeInput>(() => (sim ? inputFromBornDay(sim.bornDay, s.today, table) : defaultAge('youngAdult', table)));
  return (
    <Modal title={sim ? 'Edit Sim' : 'New Sim'} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), bornDayFromInput(age, s.today, table))}>{sim ? 'Save changes' : 'Add Sim'}</button></>}>
      <div className="stack">
        <Field label="Name">{(id) => <TextInput kind="name" id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <AgeFields value={age} onChange={setAge} table={table} today={s.today} calendar={s.calendar} />
      </div>
    </Modal>
  );
}

export function TimeDemo() {
  const [s, setS] = useState<State>(load);
  const [editing, setEditing] = useState<DemoSim | 'new' | null>(null);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);
  const table = useMemo(() => stageTable({ preset: s.lifespan }), [s.lifespan]);
  const todayDate = dateOf(s.today, s.calendar);
  const upcoming = birthdaysBetween(s.sims, s.today, s.today + 28, table);
  const nameOf = (id: string) => s.sims.find((x) => x.id === id)?.name ?? '';

  const setLength = (len: SeasonLength) => setS((x) => ({ ...x, calendar: changeSeasonLength(x.calendar, x.today, len) }));
  const setSpan = (span: 'short' | 'normal' | 'long') => setS((x) => {
    const from = stageTable({ preset: x.lifespan });
    const to = stageTable({ preset: span });
    return { ...x, lifespan: span, sims: x.sims.map((m) => ({ ...m, bornDay: rescaleBornDay(m.bornDay, x.today, from, to) })) };
  });
  const move = (days: number) => setS((x) => ({ ...x, today: x.today + days }));

  return (
    <section>
      <h2>Time test (step 7)</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Example Sims on a pretend calendar. Change the season length (ages stay the same), the lifespan (everyone stays in their
        stage, same share of the way through), move the date, and add a Sim with “Are they fresh from Create a Sim?”.
      </p>
      <div className="card stack">
        <div className="time-today">
          <div><div className="muted small">Today</div><b>{formatDate(todayDate)}</b><div className="small">{formatDate(todayDate, 'weekday')}</div></div>
          <div className="row">
            <button type="button" className="btn sm" onClick={() => move(-1)}>Back a day</button>
            <button type="button" className="btn sm" onClick={() => move(1)}>+1 day</button>
            <button type="button" className="btn sm" onClick={() => move(7)}>+1 week</button>
          </div>
        </div>
        <div className="field"><span className="label">Season length</span>
          <Seg<SeasonLength> label="Season length" value={s.calendar.seasonLength} options={LENGTHS} onChange={setLength} /></div>
        <div className="field"><span className="label">Lifespan</span>
          <Seg<'short' | 'normal' | 'long'> label="Lifespan" value={s.lifespan} options={SPANS} onChange={setSpan} /></div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="m-label" style={{ margin: 0 }}>Sims</div>
          <button type="button" className="btn primary sm" onClick={() => setEditing('new')}><Plus size={16} weight="bold" /> New Sim</button>
        </div>
        <div className="trash-list">
          {s.sims.map((m) => {
            const a = ageOf(m.bornDay, s.today, table);
            return (
              <div key={m.id} className="trash-row">
                <div className="trash-txt">
                  <b>{m.name} {a.born && a.barFull && <Hourglass size={16} weight="duotone" className="final-chapter" aria-label="Age bar full" />}</b>
                  {!a.born ? <span>Not born yet</span> : a.stage === 'elder' ? (
                    a.barFull ? <span className="final-chapter">Age bar full · final chapter</span> : <span>Elder · {plural(a.daysAsElder ?? 0, 'day')} as an elder</span>
                  ) : (
                    <span>{stageName(a.stage)} · day {a.dayInStage} of {a.stageDays} · birthday in {plural(a.birthdayIn!, 'day')}, {formatDate(dateOf(a.birthdayDay!, s.calendar), 'weekday')}</span>
                  )}
                </div>
                <button type="button" className="btn sm" onClick={() => setEditing(m)}><PencilSimple size={16} weight="duotone" /> Edit</button>
                <button type="button" className="btn sm ghost icon" aria-label={`Remove ${m.name}`} onClick={() => setS((x) => ({ ...x, sims: x.sims.filter((y) => y.id !== m.id) }))}>
                  <Trash size={18} weight="duotone" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="m-label" style={{ margin: '6px 0 0' }}>Birthdays in the next 28 days</div>
        {upcoming.length === 0 ? <p className="muted small" style={{ margin: 0 }}>None coming up.</p> : (
          <ul className="time-bdays">
            {upcoming.map((b) => (
              <li key={b.simId + b.day}><b>{formatDate(dateOf(b.day, s.calendar), 'weekday')}</b> · {nameOf(b.simId)} ages up to {stageName(b.toStage).toLowerCase()}</li>
            ))}
          </ul>
        )}
        <div><button type="button" className="btn sm ghost danger" onClick={() => setS(start())}>Reset this test</button></div>
      </div>
      {editing && (
        <SimForm sim={editing === 'new' ? null : editing} s={s} onClose={() => setEditing(null)}
          onSave={(name, bornDay) => {
            setS((x) => editing === 'new'
              ? { ...x, sims: [...x.sims, { id: `sim-${Date.now()}`, name, bornDay, addedDay: x.today }] }
              : { ...x, sims: x.sims.map((y) => (y.id === editing.id ? { ...y, name, bornDay } : y)) });
            setEditing(null);
          }} />
      )}
    </section>
  );
}
