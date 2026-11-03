import { useId } from 'react';
import { ArrowRight, Hourglass } from '@phosphor-icons/react';
import { Seg, Stepper } from './ui';
import {
  ageOf, birthdayInRange, bornDayFor, dateOf, formatDate, STAGE_IDS, stageName,
  type Calendar, type StageId, type StageRow,
} from '../lib/time';

/** What the Add / Edit Sim form asks about age. */
export type AgeInput = { stage: StageId; fresh: boolean; birthdayIn: number; daysAsElder: number };

export function defaultAge(stage: StageId, table: StageRow[]): AgeInput {
  return { stage, fresh: true, birthdayIn: birthdayInRange(stage, table).max, daysAsElder: 0 };
}

/** The day they were born, from the form. */
export function bornDayFromInput(a: AgeInput, today: number, table: StageRow[]): number {
  return a.fresh
    ? bornDayFor({ stage: a.stage, fresh: true }, today, table)
    : bornDayFor({ stage: a.stage, fresh: false, birthdayIn: a.birthdayIn, daysAsElder: a.daysAsElder }, today, table);
}

/** For editing: fills the form from a Sim's birth day. Day 1 of a stage reads as "fresh". */
export function inputFromBornDay(bornDay: number, today: number, table: StageRow[]): AgeInput {
  const a = ageOf(bornDay, today, table);
  if (!a.born) return defaultAge('newborn', table);
  return { stage: a.stage, fresh: a.dayInStage === 1, birthdayIn: a.birthdayIn ?? 1, daysAsElder: a.daysAsElder ?? 0 };
}

const lower = (id: StageId) => stageName(id).toLowerCase();
const plural = (id: StageId) => (id === 'child' ? 'Children' : `${stageName(id)}s`);

export function AgeFields({ value, onChange, table, today, calendar }: {
  value: AgeInput; onChange(v: AgeInput): void; table: StageRow[]; today: number; calendar: Calendar;
}) {
  const ids = { stage: useId(), fresh: useId(), num: useId(), hint: useId() };
  const range = birthdayInRange(value.stage, table);
  const elder = value.stage === 'elder';
  const row = table.find((r) => r.id === value.stage)!;
  const preview = ageOf(bornDayFromInput(value, today, table), today, table);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="field">
        <label htmlFor={ids.stage}>Life stage</label>
        <select id={ids.stage} className="select" value={value.stage}
          onChange={(e) => onChange(defaultAge(e.target.value as StageId, table))}>
          {STAGE_IDS.map((id) => <option key={id} value={id}>{stageName(id)}</option>)}
        </select>
      </div>
      <div className="field">
        <span className="label" id={ids.fresh}>Are they fresh from Create a Sim?</span>
        <Seg<'yes' | 'no'> label="Are they fresh from Create a Sim?" value={value.fresh ? 'yes' : 'no'}
          onChange={(v) => onChange({ ...value, fresh: v === 'yes' })}
          options={[{ v: 'yes', label: 'Yes, just made' }, { v: 'no', label: 'No, already playing them' }]} />
      </div>
      {!value.fresh && (
        <div className="field">
          <label htmlFor={ids.num}>{elder ? 'Days as an elder' : 'Birthday in'}</label>
          {elder ? (
            <Stepper id={ids.num} label="Days as an elder" unit="days" min={0} max={9999} value={value.daysAsElder}
              onChange={(n) => onChange({ ...value, daysAsElder: n })} />
          ) : (
            <Stepper id={ids.num} label="Birthday in" unit="days" min={range.min} max={range.max} value={value.birthdayIn}
              onChange={(n) => onChange({ ...value, birthdayIn: n })} />
          )}
          <div className="hint" id={ids.hint}>
            Match the number on their age bar in the game.
            {!elder && ` ${plural(value.stage)} last ${row.days} days on your lifespan.`}
          </div>
          {preview.born && !elder && preview.birthdayDay !== undefined && preview.nextStage && (
            <div className="age-preview" aria-live="polite">
              <ArrowRight size={14} weight="bold" /> Ages up to {lower(preview.nextStage)} on {formatDate(dateOf(preview.birthdayDay, calendar), 'weekday')}
            </div>
          )}
          {preview.born && elder && preview.barFull && (
            <div className="final-chapter" aria-live="polite"><Hourglass size={16} weight="duotone" /> Age bar full · final chapter</div>
          )}
        </div>
      )}
    </div>
  );
}
