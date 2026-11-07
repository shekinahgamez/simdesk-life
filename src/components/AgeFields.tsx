import { useId, useState } from 'react';
import { ArrowRight, Hourglass } from '@phosphor-icons/react';
import { Seg, Stepper } from './ui';
import {
  ageOf, birthdayInRange, bornDayFor, dateOf, formatDate, STAGE_IDS, stageName,
  type Calendar, type StageId, type StageRow,
} from '../lib/time';
import { rangeText, realAgeLimits, realAgeYears, stageForRealAge, type RealAgeRanges } from '../lib/realAges';

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

/** The age input for a real-life age in whole years. */
export function inputFromRealAge(years: number, ranges: RealAgeRanges, table: StageRow[]): AgeInput {
  const { stage, inStage } = stageForRealAge(years, ranges, table.map((r) => r.days));
  const row = table.find((r) => r.id === stage)!;
  return { stage, fresh: false, birthdayIn: stage === 'elder' ? 1 : row.days - inStage, daysAsElder: stage === 'elder' ? inStage : 0 };
}

/**
 * Life stage and age bar. With `realAges` (the save shows real-life ages), a switch lets the player
 * set the age in years instead; SimDesk works out the stage and the age bar from it.
 */
export function AgeFields({ value, onChange, table, today, calendar, realAges }: {
  value: AgeInput; onChange(v: AgeInput): void; table: StageRow[]; today: number; calendar: Calendar; realAges?: RealAgeRanges | null;
}) {
  const ids = { stage: useId(), fresh: useId(), num: useId(), hint: useId(), years: useId() };
  const [byReal, setByReal] = useState(false);
  const range = birthdayInRange(value.stage, table);
  const elder = value.stage === 'elder';
  const row = table.find((r) => r.id === value.stage)!;
  const preview = ageOf(bornDayFromInput(value, today, table), today, table);
  const years = realAges && preview.born ? Math.floor(realAgeYears(preview, realAges) + 1e-9) : 0;
  const limits = realAges ? realAgeLimits(realAges) : { min: 0, max: 0 };

  const mode = realAges && (
    <Seg<'bar' | 'real'> label="Set age by" value={byReal ? 'real' : 'bar'} onChange={(v) => setByReal(v === 'real')}
      options={[{ v: 'bar', label: 'Age bar' }, { v: 'real', label: 'Real age' }]} />
  );

  if (realAges && byReal) {
    return (
      <div className="stack" style={{ gap: 14 }}>
        {mode}
        <div className="field">
          <label htmlFor={ids.years}>Real age</label>
          <Stepper id={ids.years} label="Real age" unit="years" min={limits.min} max={limits.max} value={years}
            onChange={(n) => onChange(inputFromRealAge(n, realAges, table))} />
          {preview.born && <div className="hint">{plural(preview.stage)} are {rangeText(preview.stage, realAges)} on your real-age settings.</div>}
          {preview.born && !elder && preview.birthdayDay !== undefined && preview.nextStage && (
            <div className="age-preview" aria-live="polite">
              <ArrowRight size={14} weight="bold" /> {stageName(preview.stage)}, ages up to {lower(preview.nextStage)} on {formatDate(dateOf(preview.birthdayDay, calendar), 'short')} · Year {dateOf(preview.birthdayDay, calendar).year}
            </div>
          )}
          {preview.born && elder && <div className="age-preview" aria-live="polite"><ArrowRight size={14} weight="bold" /> Elder, {preview.daysAsElder} days as an elder</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {mode}
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
