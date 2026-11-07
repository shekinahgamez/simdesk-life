import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, Plus } from '@phosphor-icons/react';
import { AgeFields, bornDayFromInput, defaultAge, inputFromBornDay, type AgeInput } from '../../components/AgeFields';
import { PhotoField } from '../../components/photo';
import { ChangedElsewhere, DraftNote } from '../../components/sync';
import { Field, Modal, Picker, Seg, TextInput, toast } from '../../components/ui';
import { usePhotos, type PhotoRef } from '../../lib/photos';
import {
  ASPIRATION_TEXT, BLANK_SIM, daysWord, fullName, simAge, simData, type Gender, type GenderSettings, type SimData,
} from '../../lib/sims';
import { useDraft, useEditGuard, useStore } from '../../lib/sync/react';
import { STAGE_IDS, stageName, type StageId } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import {
  aspirationOptions, occultOptions, traitOptions, useCustomTraits, useHouseholds, useRealAgeRanges, type SaveInfo,
} from './shared';

const PRONOUNS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they'];
const ORIENTATIONS = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Exploring'];

type FormState = SimData & { age: AgeInput; changeAge: boolean };

function startState(info: SaveInfo, rec: SimData | null, householdId: string | null): FormState {
  const base = rec ?? { ...BLANK_SIM, householdId };
  const age = rec?.bornDay != null ? inputFromBornDay(rec.bornDay, info.today, info.table) : defaultAge('youngAdult', info.table);
  return { ...base, age, changeAge: !rec };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * New Sim and Edit Sim. The buttons stay pinned at the bottom. Pronouns, orientation, career,
 * game gender settings and notes are tucked under "More details". Drafts save as you type.
 */
export function SimForm({ info, simId, householdId = null, onClose, onSaved }: {
  info: SaveInfo; simId: string | null; householdId?: string | null; onClose(): void; onSaved(id: string, another: boolean): void;
}) {
  const store = useStore();
  const photos = usePhotos();
  const phone = useIsPhone();
  const rec = simId ? store.get(simId) : undefined;
  const editing = !!simId;
  const draftKey = simId ? `sim:${simId}` : 'sim:new';
  const draft = useDraft<FormState>(draftKey);
  const guard = useEditGuard(simId);
  const custom = useCustomTraits();
  const realRanges = useRealAgeRanges().ranges;
  const hh = useHouseholds();
  const ids = { stage: useId() };
  const firstId = useRef('');
  const focusFirst = () => document.getElementById(firstId.current)?.focus();

  const initial = useMemo(() => startState(info, rec ? simData(rec) : null, householdId), [simId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [usedDraft] = useState(() => !!draft.draft);
  const [f, setF] = useState<FormState>(() => (draft.draft ? { ...initial, ...draft.draft } : initial));
  const [more, setMore] = useState(() => !!(f.pronouns || f.orientation || f.career || f.notes || Object.keys(f.genderSettings).length));
  const [newHh, setNewHh] = useState<string | null>(null);
  const [error, setError] = useState('');
  const uploaded = useRef<string[]>([]);
  const dirty = !same(f, initial);

  // Keep the draft up to date while typing.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (dirty) draft.save(f); else draft.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  const set = (patch: Partial<FormState>) => setF((x) => ({ ...x, ...patch }));
  const setPhoto = (p: PhotoRef | null) => {
    if (p && !uploaded.current.includes(p.id) && p.id !== f.portrait?.id) uploaded.current.push(p.id);
    set({ portrait: p });
  };

  const referencedBy = (d: Partial<SimData> | null | undefined) =>
    new Set([d?.portrait?.id, ...(d?.stagePhotos ?? []).map((s) => s.photo.id)].filter(Boolean) as string[]);

  /** Closing without saving: photos picked in this form (and not kept in a draft) are removed. */
  const discard = () => {
    const keep = referencedBy(rec ? simData(rec) : null);
    const extra = uploaded.current.filter((id) => !keep.has(id));
    if (extra.length) void photos.remove(extra);
    draft.clear();
    onClose();
  };

  const save = (another: boolean) => {
    const first = f.first.trim();
    if (!first) { setError('Every Sim needs at least a first name.'); focusFirst(); return; }
    let householdId = f.householdId;
    if (newHh !== null && newHh.trim()) householdId = store.put('household', { name: newHh.trim() });
    const { age, changeAge, ...rest } = f;
    const data: SimData = { ...rest, first, last: f.last.trim(), householdId, pronouns: f.pronouns.trim(), orientation: f.orientation.trim(), career: f.career.trim() };
    if (info.track) {
      if (!editing || changeAge) {
        data.bornDay = bornDayFromInput(age, info.today, info.table);
        data.stage = null;
      }
      if (!editing) data.addedDay = info.today;
    } else if (!data.stage) {
      data.stage = 'youngAdult';
    }
    const id = store.put('sim', data as unknown as Record<string, unknown>, simId ?? undefined);
    // A replaced or removed photo is deleted from storage.
    const before = referencedBy(rec ? simData(rec) : null);
    const after = referencedBy(data);
    const dropped = [...before, ...uploaded.current].filter((x) => !after.has(x));
    if (dropped.length) void photos.remove([...new Set(dropped)]);
    draft.clear();
    toast(editing ? 'Saved' : `${fullName(data)} added`);
    if (another) {
      const keepHh = householdId;
      const next = startState(info, null, keepHh);
      setF({ ...next, age: { ...next.age, stage: f.age.stage }, householdId: keepHh });
      setNewHh(null);
      uploaded.current = [];
      setError('');
      window.setTimeout(focusFirst, 0);
    }
    onSaved(id, another);
  };

  const ageSummary = () => {
    if (!rec) return '';
    const a = simAge(simData(rec), info.today, info.table, info.track);
    if (a.kind === 'age') {
      const st = stageName(a.age.stage);
      if (a.age.stage === 'elder') return a.age.barFull ? `${st} · Age bar full, final chapter` : `${st} · ${a.age.daysAsElder} days as an elder`;
      return `${st}, birthday ${daysWord(a.age.birthdayIn ?? 0)}`;
    }
    if (a.kind === 'manual') return stageName(a.stage);
    if (a.kind === 'notBorn') return `Not born yet (due ${daysWord(a.daysUntilBorn)})`;
    return 'Not set';
  };

  const gs = f.genderSettings;
  const setGs = (patch: Partial<GenderSettings>) => set({ genderSettings: { ...gs, ...patch } });

  const traitOpts = traitOptions(info, custom.list, f.traits);
  const aspOpts = aspirationOptions(info, f.aspiration);
  const occOpts = occultOptions(info, f.occult);

  return (
    <Modal title={editing ? `Edit ${simData(rec).first || 'Sim'}` : 'New Sim'} wide className="pinned sim-form"
      dirty={dirty} onSaveDraft={() => { draft.save(f); onClose(); }} onClose={discard}
      footer={(close) => (
        <>
          {!editing && <button type="button" className="btn ghost add-another" onClick={() => save(true)}>Add &amp; add another</button>}
          <span className="grow" />
          {!phone && <button type="button" className="btn" onClick={close}>Cancel</button>}
          <button type="button" className="btn primary" onClick={() => save(false)}>{editing ? 'Save changes' : 'Add Sim'}</button>
        </>
      )}>
      <div className="stack" style={{ gap: 18 }}>
        {usedDraft && draft.savedAt && draft.daysLeft !== null && (
          <DraftNote savedAt={draft.savedAt} daysLeft={draft.daysLeft} expiringSoon={draft.expiringSoon}
            onDiscard={() => { draft.clear(); setF(initial); }} />
        )}
        {guard.theirs && (
          <ChangedElsewhere what="Sim" theirs={guard.theirs} onKeep={guard.keepMine}
            onTheirs={() => { const t = guard.useTheirs(); if (t) setF(startState(info, simData(t), null)); }} />
        )}

        <div className="sim-form-top">
          <PhotoField value={f.portrait} onChange={setPhoto} aspect={1} saveId={store.openId} label="Portrait" width={phone ? 104 : 128} />
          <div className="sim-form-names">
            <div className="form-grid">
              <Field label="First name">{(id) => { firstId.current = id; return <TextInput kind="name" id={id} value={f.first} onChange={(e) => { set({ first: e.target.value }); setError(''); }} maxLength={60} />; }}</Field>
              <Field label="Last name">{(id) => <TextInput kind="name" id={id} value={f.last} onChange={(e) => set({ last: e.target.value })} maxLength={60} />}</Field>
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="form-grid">
              <div className="field">
                <div className="label-row">
                  <label htmlFor={`${ids.stage}-hh`}>Household</label>
                  {newHh === null && <button type="button" className="link-btn" onClick={() => setNewHh('')}><Plus size={13} weight="bold" /> New household</button>}
                </div>
                {newHh === null ? (
                  <select id={`${ids.stage}-hh`} className="select" value={f.householdId ?? ''} onChange={(e) => set({ householdId: e.target.value || null })}>
                    <option value="">No household</option>
                    {hh.list.map((h) => <option key={h.id} value={h.id}>{hh.nameOf(h.id)}</option>)}
                  </select>
                ) : (
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <TextInput kind="name" id={`${ids.stage}-hh`} placeholder="Household name, like Okafor" value={newHh} autoFocus
                      onChange={(e) => setNewHh(e.target.value)} maxLength={60} />
                    <button type="button" className="btn ghost sm" onClick={() => setNewHh(null)}>Cancel</button>
                  </div>
                )}
                {newHh !== null && <div className="hint">The household is made when you save.</div>}
              </div>
              <div className="field">
                <span className="label">Gender</span>
                <div className="seg" role="group" aria-label="Gender">
                  {(['male', 'female'] as Gender[]).map((g) => (
                    <button key={g} type="button" aria-pressed={f.gender === g} onClick={() => set({ gender: f.gender === g ? null : g })}>
                      {g === 'male' ? 'Male' : 'Female'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="age-box">
          {editing && !f.changeAge ? (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><span className="label">Age</span><div className="muted">{ageSummary()}</div></div>
              <button type="button" className="btn sm" onClick={() => set({ changeAge: true })}>Change age</button>
            </div>
          ) : info.track ? (
            <AgeFields value={f.age} onChange={(age) => set({ age })} table={info.table} today={info.today} calendar={info.cal} realAges={info.d.realAges ? realRanges : null} />
          ) : (
            <div className="field">
              <label htmlFor={ids.stage}>Life stage</label>
              <select id={ids.stage} className="select" value={f.stage ?? 'youngAdult'} onChange={(e) => set({ stage: e.target.value as StageId })}>
                {STAGE_IDS.map((s) => <option key={s} value={s}>{stageName(s)}</option>)}
              </select>
              <div className="hint">Date tracking is off, so you age Sims up by hand from their profile.</div>
            </div>
          )}
        </div>

        <Field label="Traits">
          {(id) => <Picker id={id} multiple options={traitOpts} value={f.traits} onChange={(traits) => set({ traits })}
            placeholder="Search traits, or type your own" onAdd={(label) => custom.add(label)} />}
        </Field>

        <div className="form-grid">
          <Field label="Aspiration">
            {(id) => <Picker id={id} options={f.aspiration?.startsWith(ASPIRATION_TEXT) ? [...aspOpts, { id: f.aspiration, label: f.aspiration.slice(ASPIRATION_TEXT.length) }] : aspOpts}
              value={f.aspiration ? [f.aspiration] : []} onChange={(v) => set({ aspiration: v[0] ?? null })}
              placeholder="Search aspirations" onAdd={(label) => `${ASPIRATION_TEXT}${label}`} />}
          </Field>
          <Field label="Occult">
            {(id) => (
              <select id={id} className="select" value={f.occult ?? ''} onChange={(e) => set({ occult: e.target.value || null })}>
                <option value="">Human</option>
                {occOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            )}
          </Field>
        </div>

        <div className="more-box">
          <button type="button" className="more-head" aria-expanded={more} onClick={() => setMore((m) => !m)}>
            <span><b>More details</b><span className="muted small">Pronouns, orientation, career, game gender settings, notes</span></span>
            <CaretDown size={16} weight="bold" style={{ transform: more ? 'rotate(180deg)' : undefined }} />
          </button>
          {more && (
            <div className="stack" style={{ gap: 16, paddingTop: 14 }}>
              <div className="form-grid">
                <Field label="Pronouns">{(id) => (<><TextInput id={id} list={`${id}-l`} value={f.pronouns} onChange={(e) => set({ pronouns: e.target.value })} maxLength={30} /><datalist id={`${id}-l`}>{PRONOUNS.map((p) => <option key={p} value={p} />)}</datalist></>)}</Field>
                <Field label="Orientation">{(id) => (<><TextInput id={id} list={`${id}-l`} value={f.orientation} onChange={(e) => set({ orientation: e.target.value })} maxLength={30} /><datalist id={`${id}-l`}>{ORIENTATIONS.map((p) => <option key={p} value={p} />)}</datalist></>)}</Field>
              </div>
              <div className="form-grid">
                <Field label="Career">{(id) => <TextInput id={id} placeholder="Business" value={f.career} onChange={(e) => set({ career: e.target.value })} maxLength={60} />}</Field>
                <Field label="Level">
                  {(id) => (
                    <select id={id} className="select" value={f.careerLevel ?? ''} onChange={(e) => set({ careerLevel: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">None</option>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Level {n}</option>)}
                    </select>
                  )}
                </Field>
              </div>
              <div className="field">
                <span className="label">Game gender settings</span>
                <div className="hint" style={{ marginTop: -2 }}>Optional. Match what you set in Create a Sim.</div>
                <div className="gender-settings">
                  <span>Physical frame</span>
                  <Seg label="Physical frame" value={gs.frame ?? ''} onChange={(v) => setGs({ frame: (v || undefined) as GenderSettings['frame'] })}
                    options={[{ v: 'masculine', label: 'Masculine' }, { v: 'feminine', label: 'Feminine' }]} />
                  <span>Clothing preference</span>
                  <Seg label="Clothing preference" value={gs.clothing ?? ''} onChange={(v) => setGs({ clothing: (v || undefined) as GenderSettings['clothing'] })}
                    options={[{ v: 'masculine', label: 'Masculine' }, { v: 'feminine', label: 'Feminine' }]} />
                  <span>Pregnancy</span>
                  <Seg label="Pregnancy" value={gs.pregnancy ?? ''} onChange={(v) => setGs({ pregnancy: (v || undefined) as GenderSettings['pregnancy'] })}
                    options={[{ v: 'canBe', label: 'Can become pregnant' }, { v: 'canGet', label: 'Can get others pregnant' }, { v: 'neither', label: 'Neither' }]} />
                  <span>Toilet use</span>
                  <Seg label="Toilet use" value={gs.toilet ?? ''} onChange={(v) => setGs({ toilet: (v || undefined) as GenderSettings['toilet'] })}
                    options={[{ v: 'stand', label: 'Standing' }, { v: 'sit', label: 'Sitting' }]} />
                </div>
              </div>
              <Field label="Notes">{(id) => <textarea id={id} className="textarea" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
