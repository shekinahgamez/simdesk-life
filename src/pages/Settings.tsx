import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarBlank, GearSix, Package, PuzzlePiece, Trash } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { useGameData } from '../data/gameData';
import { useStageTable } from '../store/hooks';
import { formatDate, SEASONS, SEASON_LENGTHS, STAGES, STAGE_LABEL, stageDays } from '../lib/time';
import { MODULES, SAVE_COLORS } from '../lib/modules';
import type { LifespanPreset, SeasonLength } from '../lib/types';
import { Field, Modal, PhotoPicker, Seg, SwitchRow } from '../components/ui';
import { DatePickerRow, JumpAheadButton } from '../components/JumpAhead';
import { PackPicker } from '../components/PackPicker';

export default function SettingsPage() {
  const save = useSave()!;
  const { updateSave, deleteSave, saves } = useStore();
  const packs = useGameData((s) => s.data?.packs ?? []);
  const table = useStageTable();
  const nav = useNavigate();
  const [setDate, setSetDate] = useState(false);
  const [draftDate, setDraftDate] = useState(save.date);
  const [packsOpen, setPacksOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const days = stageDays(save.lifespan, table);

  const setPreset = (preset: LifespanPreset) =>
    updateSave({ lifespan: preset === 'custom' ? { preset, custom: { ...days } } : { preset, custom: save.lifespan.custom } });

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <h1>Save settings</h1>
          <div className="sub">{save.name}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head"><h2><span className="obj berry"><GearSix size={16} weight="duotone" /></span> The basics</h2></div>
        <div className="stack" style={{ gap: 16 }}>
          <Field label="Save name">{(id) => <input id={id} className="input" value={save.name} onChange={(e) => updateSave({ name: e.target.value })} />}</Field>
          <div className="field">
            <span className="label">Cover photo</span>
            <PhotoPicker value={save.cover} onChange={(cover) => updateSave({ cover })} height={140} label="Add a cover photo" />
          </div>
          <div className="field">
            <span className="label">Save color</span>
            <div className="row" role="group" aria-label="Save color">
              {SAVE_COLORS.map((c) => (
                <button key={c.hex} type="button" aria-pressed={save.color === c.hex} aria-label={c.label} onClick={() => updateSave({ color: c.hex })}
                  style={{ width: 36, height: 36, borderRadius: 11, background: c.hex, border: '3px solid var(--surface)', boxShadow: save.color === c.hex ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--line)', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2><span className="obj calendar"><CalendarBlank size={16} weight="duotone" /></span> Time</h2></div>
        <SwitchRow
          title="Track today’s date"
          desc="Keep SimDesk in step with your game’s calendar. Turn it off if logging the day feels like homework."
          on={save.trackDate}
          onChange={(trackDate) => updateSave({ trackDate })}
        />
        {!save.trackDate ? (
          <div className="small" style={{ background: 'var(--field)', borderRadius: 12, padding: '12px 14px', lineHeight: 1.5 }}>
            Countdowns, today markers and Jump ahead are hidden. Age Sims up by hand from their profile, and birthdays and holidays still show on the calendar.
          </div>
        ) : (
          <div className="switch-row" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="grow">
              <div className="bold">Today in your save</div>
              <div className="small muted">{formatDate(save.date)}</div>
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => { setDraftDate(save.date); setSetDate(true); }}>Set date</button>
              <JumpAheadButton className="btn sm primary">Jump ahead</JumpAheadButton>
            </div>
          </div>
        )}
        <div className="divider" />
        <div className="field">
          <span className="label">Season length</span>
          <Seg<SeasonLength> label="Season length" value={save.seasonLength} onChange={(seasonLength) => updateSave({ seasonLength })} options={SEASON_LENGTHS.map((l) => ({ v: l, label: l === 7 ? '1 week' : l === 21 ? '3 weeks (mod)' : `${l / 7} weeks` }))} />
          <span className="hint">Changing this recalculates every age from birthdays. Nothing is lost; dates past the new length show on the last day.</span>
        </div>
        <div className="divider" />
        <div className="field">
          <span className="label">Lifespan</span>
          <Seg<LifespanPreset> label="Lifespan" value={save.lifespan.preset} onChange={setPreset} options={(['short', 'normal', 'long', 'custom'] as const).map((p) => ({ v: p, label: p[0].toUpperCase() + p.slice(1) }))} />
          {save.lifespan.preset === 'custom' && (
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              {STAGES.map((s) => (
                <label key={s} className="field" style={{ width: 92 }}>
                  <span className="tiny bold">{STAGE_LABEL[s]}</span>
                  <input className="input" type="number" min={1} value={days[s]} onChange={(e) => updateSave({ lifespan: { preset: 'custom', custom: { ...days, [s]: Math.max(1, Number(e.target.value) || 1) } } })} />
                </label>
              ))}
            </div>
          )}
          <span className="hint">{STAGES.filter((s) => s !== 'elder').map((s) => `${STAGE_LABEL[s]} ${days[s]}`).join(' · ')} · Elder {days.elder}+ days</span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2><span className="obj households"><Package size={16} weight="duotone" /></span> Packs</h2>
          <button className="btn sm" onClick={() => setPacksOpen(true)}>Change packs</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Base Game + {save.packs.length} packs. {packs.filter((p) => save.packs.includes(p.id) && p.type === 'expansion').map((p) => p.name).slice(0, 6).join(', ')}
          {save.packs.length > 6 ? '…' : ''}
        </p>
      </section>

      <section className="card">
        <div className="card-head"><h2><span className="obj storylines"><PuzzlePiece size={16} weight="duotone" /></span> Modules</h2></div>
        <div className="small muted" style={{ marginBottom: 6 }}>Turn on only what you track. Turning one off hides it without deleting anything.</div>
        {MODULES.map((m) => (
          <SwitchRow key={m.id} title={m.label} desc={m.desc} on={!!save.modules[m.id]} onChange={(on) => updateSave({ modules: { ...save.modules, [m.id]: on } })} />
        ))}
      </section>

      <section className="card" style={{ borderColor: 'color-mix(in srgb, var(--danger) 30%, var(--line))' }}>
        <div className="card-head"><h2>Delete this save</h2></div>
        <p className="small muted" style={{ marginTop: 0 }}>Removes every Sim, household, lot edit, holiday and club in {save.name}. There’s no undo.</p>
        <button className="btn danger" onClick={() => setConfirmDelete(' ')}><Trash size={16} /> Delete save</button>
      </section>

      {setDate && (
        <Modal title="Set today’s date" onClose={() => setSetDate(false)} footer={<><button className="btn" onClick={() => setSetDate(false)}>Cancel</button><button className="btn primary" onClick={() => { updateSave({ date: draftDate }); setSetDate(false); }}>Set date</button></>}>
          <p className="small muted" style={{ marginTop: 0 }}>For fixing the date. Moving forward? Jump ahead shows you what happened along the way.</p>
          <DatePickerRow value={draftDate} onChange={setDraftDate} len={save.seasonLength} />
          <p className="tiny muted">{SEASONS[draftDate.season]}, Day {draftDate.day}, Year {draftDate.year}</p>
        </Modal>
      )}
      {packsOpen && (
        <Modal wide title="Your packs" onClose={() => setPacksOpen(false)} footer={<button className="btn primary" onClick={() => setPacksOpen(false)}>Done</button>}>
          <PackPicker value={save.packs} onChange={(p) => updateSave({ packs: p })} />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title={`Delete ${save.name}?`} onClose={() => setConfirmDelete('')} footer={<><button className="btn" onClick={() => setConfirmDelete('')}>Keep it</button><button className="btn primary" disabled={confirmDelete.trim() !== save.name.trim()} onClick={async () => { await deleteSave(save.id); const next = saves.find((s) => s.id !== save.id); nav(next ? `/s/${next.id}` : '/setup'); }}>Delete forever</button></>}>
          <p style={{ marginTop: 0 }}>Type the save’s name to confirm: <b>{save.name}</b></p>
          <input className="input" aria-label="Save name" value={confirmDelete.trim()} onChange={(e) => setConfirmDelete(e.target.value || ' ')} />
        </Modal>
      )}
    </div>
  );
}
