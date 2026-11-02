import { useMemo, useState } from 'react';
import { useSave, useStore } from '../store/store';
import { simAge, useOwned, useStageTable } from '../store/hooks';
import { nowIso, uid } from '../lib/ids';
import { birthdayFromStage, STAGES, STAGE_LABEL } from '../lib/time';
import type { LifeStageId, Sim, SimDate } from '../lib/types';
import { Field, Modal, PhotoPicker, Picker, Seg, toast, type PickOption } from './ui';
import { DatePickerRow } from './JumpAhead';

export function useTraitOptions(): PickOption[] {
  const owned = useOwned();
  const custom = useStore((s) => s.customTraits);
  return useMemo(() => {
    const g = (owned?.traits ?? []).map((t) => ({ id: t.id, label: t.name, group: t.category || 'Traits', hint: t.ages }));
    g.sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
    const c = custom
      .map((t) => ({ id: t.id, label: t.name, group: t.pack ? `Custom · ${t.pack}` : 'Custom', hint: t.creator }))
      .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
    return [...g, ...c];
  }, [owned, custom]);
}

export function useTraitLabel() {
  const opts = useTraitOptions();
  return useMemo(() => {
    const m = new Map(opts.map((o) => [o.id, o]));
    return (id: string) => m.get(id)?.label ?? id;
  }, [opts]);
}

export const PRONOUNS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they'];
export const ORIENTATIONS = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Aromantic', 'Exploring'];

type AgeMode = 'stage' | 'born';

export function SimForm({ sim, onClose, defaultHouseholdId }: { sim?: Sim; onClose(saved?: Sim): void; defaultHouseholdId?: string }) {
  const save = useSave()!;
  const owned = useOwned();
  const table = useStageTable();
  const { recs, upsert, saveCustomTraits } = useStore();
  const traitOptions = useTraitOptions();
  const existingAge = sim ? simAge(sim, save, table) : null;

  const [s, setS] = useState<Sim>(
    () =>
      sim ?? {
        id: uid(),
        firstName: '',
        lastName: '',
        stagePhotos: [],
        occults: [],
        traits: [],
        householdId: defaultHouseholdId,
        createdAt: nowIso(),
      },
  );
  const [ageMode, setAgeMode] = useState<AgeMode>('stage');
  const [stage, setStage] = useState<LifeStageId>(existingAge?.stage ?? 'youngAdult');
  const [untilUp, setUntilUp] = useState<number | ''>(existingAge?.info?.agesUpIn ?? '');
  const [born, setBorn] = useState<SimDate>(sim?.birthday ?? save.date);
  const [touchedAge, setTouchedAge] = useState(!sim);
  const set = (patch: Partial<Sim>) => setS((x) => ({ ...x, ...patch }));

  const households = Object.values(recs.household).sort((a, b) => a.name.localeCompare(b.name));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.firstName.trim()) {
      toast('Every Sim needs at least a first name.');
      return;
    }
    let next = { ...s, firstName: s.firstName.trim(), lastName: s.lastName.trim() };
    if (touchedAge) {
      if (save.trackDate) {
        next.birthday =
          ageMode === 'born'
            ? born
            : birthdayFromStage(stage, untilUp === '' ? null : Number(untilUp), save.date, save.seasonLength, save.lifespan, table);
        next.manualStage = undefined;
      } else {
        next.manualStage = stage;
      }
    }
    if (!save.trackDate && !next.manualStage && !next.birthday) next.manualStage = stage;
    upsert('sim', next);
    onClose(next);
  };

  const createTrait = (name: string) => {
    const t = { id: uid(), name, createdAt: nowIso() };
    saveCustomTraits([t]);
    return t.id;
  };

  return (
    <Modal
      wide
      title={sim ? `Edit ${sim.firstName}` : 'New Sim'}
      onClose={() => onClose()}
      footer={
        <>
          <button type="button" className="btn" onClick={() => onClose()}>Cancel</button>
          <button type="submit" form="sim-form" className="btn primary">{sim ? 'Save changes' : 'Add Sim'}</button>
        </>
      }
    >
      <form id="sim-form" onSubmit={submit} className="stack" style={{ gap: 18 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
          <PhotoPicker value={s.portrait} onChange={(portrait) => set({ portrait })} width={128} height={160} label="Portrait" maxSide={900} />
          <div className="form-grid grow" style={{ minWidth: 240 }}>
            <Field label="First name">{(id) => <input id={id} className="input" value={s.firstName} onChange={(e) => set({ firstName: e.target.value })} required />}</Field>
            <Field label="Last name">{(id) => <input id={id} className="input" value={s.lastName} onChange={(e) => set({ lastName: e.target.value })} />}</Field>
            <Field label="Household">
              {(id) => (
                <select id={id} className="select" value={s.householdId ?? ''} onChange={(e) => set({ householdId: e.target.value || undefined })}>
                  <option value="">No household</option>
                  {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Pronouns">
              {(id) => (
                <>
                  <input id={id} className="input" list="pronoun-list" value={s.pronouns ?? ''} onChange={(e) => set({ pronouns: e.target.value })} />
                  <datalist id="pronoun-list">{PRONOUNS.map((p) => <option key={p} value={p} />)}</datalist>
                </>
              )}
            </Field>
          </div>
        </div>

        <div className="card tight" style={{ background: 'var(--field)' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="label">Age</span>
            {sim && !touchedAge && (
              <button type="button" className="btn sm" onClick={() => setTouchedAge(true)}>Change age</button>
            )}
          </div>
          {!touchedAge ? (
            <div className="small muted">{existingAge?.stage ? STAGE_LABEL[existingAge.stage] : 'Not set'}{existingAge?.info?.agesUpIn != null ? `, ages up in ${existingAge.info.agesUpIn} days` : ''}</div>
          ) : save.trackDate ? (
            <div className="stack">
              <Seg label="How to set age" value={ageMode} onChange={(v) => setAgeMode(v)} options={[{ v: 'stage', label: 'They’re already a…' }, { v: 'born', label: 'Born on a date' }]} />
              {ageMode === 'stage' ? (
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <label className="field" style={{ width: 170 }}>
                    <span className="label">Life stage</span>
                    <select className="select" value={stage} onChange={(e) => setStage(e.target.value as LifeStageId)}>
                      {STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
                    </select>
                  </label>
                  {stage !== 'elder' && (
                    <label className="field" style={{ width: 170 }}>
                      <span className="label">Days until they age up</span>
                      <input className="input" type="number" min={1} placeholder="Just aged up" value={untilUp} onChange={(e) => setUntilUp(e.target.value === '' ? '' : Number(e.target.value))} />
                    </label>
                  )}
                </div>
              ) : (
                <DatePickerRow value={born} onChange={setBorn} len={save.seasonLength} />
              )}
              <span className="hint">SimDesk works out their birthday from this, so ages stay right when you jump ahead or change lifespans.</span>
            </div>
          ) : (
            <label className="field" style={{ width: 200 }}>
              <span className="label">Life stage</span>
              <select className="select" value={stage} onChange={(e) => setStage(e.target.value as LifeStageId)}>
                {STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="form-grid">
          <div className="field full">
            <span className="label">Traits</span>
            <Picker label="Add a trait" placeholder="Search traits, or type a custom one" multi options={traitOptions} value={s.traits} onChange={(traits) => set({ traits })} allowCreate={createTrait} tagClass="sims" />
          </div>
          <div className="field">
            <span className="label">Aspiration</span>
            <Picker
              label="Aspiration"
              placeholder="Search aspirations"
              options={(owned?.aspirations ?? []).map((a) => ({ id: a.id, label: a.name, group: a.category }))}
              value={s.aspiration ? [s.aspiration] : []}
              onChange={(v) => set({ aspiration: v[0] })}
              allowCreate={(t) => t}
            />
          </div>
          <div className="field">
            <span className="label">Occult types</span>
            <Picker
              label="Occult types"
              placeholder="Human, Vampire…"
              multi
              options={(owned?.occults ?? []).map((o) => ({ id: o.id, label: o.name }))}
              value={s.occults}
              onChange={(occults) => set({ occults })}
              allowCreate={(t) => t}
              tagClass="storylines"
            />
            <span className="hint">More than one is fine, for hybrids.</span>
          </div>
          <Field label="Career">{(id) => <input id={id} className="input" placeholder="Writer, level 6" value={s.career ?? ''} onChange={(e) => set({ career: e.target.value })} />}</Field>
          <Field label="Orientation">
            {(id) => (
              <>
                <input id={id} className="input" list="orient-list" value={s.orientation ?? ''} onChange={(e) => set({ orientation: e.target.value })} />
                <datalist id="orient-list">{ORIENTATIONS.map((p) => <option key={p} value={p} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Notes" full>{(id) => <textarea id={id} className="textarea" value={s.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />}</Field>
        </div>
      </form>
    </Modal>
  );
}
