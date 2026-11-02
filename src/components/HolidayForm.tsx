import { useState } from 'react';
import { useSave, useStore } from '../store/store';
import { useOwned } from '../store/hooks';
import { nowIso, uid } from '../lib/ids';
import { SEASONS } from '../lib/time';
import type { Holiday, SeasonIndex } from '../lib/types';
import { Field, Modal, Picker, SwitchRow } from './ui';

export function HolidayForm({ holiday, initial, onClose }: { holiday?: Holiday; initial?: { season: SeasonIndex; day: number; year: number }; onClose(): void }) {
  const save = useSave()!;
  const owned = useOwned();
  const { upsert, remove } = useStore();
  const [h, setH] = useState<Holiday>(
    holiday ?? {
      id: uid(),
      name: '',
      season: initial?.season ?? save.date.season,
      day: initial?.day ?? save.date.day,
      traditions: [],
      repeats: true,
      year: initial?.year ?? save.date.year,
      createdAt: nowIso(),
    },
  );
  const options = (owned?.traditions ?? []).map((t) => ({ id: t.name, label: t.name }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!h.name.trim()) return;
    upsert('holiday', { ...h, name: h.name.trim(), day: Math.min(h.day, save.seasonLength) });
    onClose();
  };
  return (
    <Modal
      title={holiday ? `Edit ${holiday.name}` : 'Add holiday'}
      onClose={onClose}
      footer={
        <>
          {holiday && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => { remove('holiday', holiday.id); onClose(); }}>Delete</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" form="holiday-form">{holiday ? 'Save changes' : 'Add holiday'}</button>
        </>
      }
    >
      <form id="holiday-form" className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <Field label="Name">{(id) => <input id={id} className="input" required placeholder="Founders’ Day" value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} />}</Field>
        <div className="row">
          <label className="field" style={{ width: 160 }}>
            <span className="label">Season</span>
            <select className="select" value={h.season} onChange={(e) => setH({ ...h, season: Number(e.target.value) as SeasonIndex })}>
              {SEASONS.map((s, i) => <option key={s} value={i}>{s}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 100 }}>
            <span className="label">Day</span>
            <input className="input" type="number" min={1} max={save.seasonLength} value={h.day} onChange={(e) => setH({ ...h, day: Math.min(save.seasonLength, Math.max(1, Number(e.target.value) || 1)) })} />
          </label>
        </div>
        <div className="field">
          <span className="label">Traditions <span className="muted">({h.traditions.length} of 5)</span></span>
          <Picker label="Traditions" multi max={5} placeholder="Search traditions, or type your own" options={options} value={h.traditions} onChange={(traditions) => setH({ ...h, traditions })} allowCreate={(t) => t} tagClass="calendar" />
          <span className="hint">Up to 5, like the game.{!save.packs.includes('seasons') && ' Game traditions need Seasons, so only your own show here.'}</span>
        </div>
        <SwitchRow title="Repeats every year" on={h.repeats} onChange={(repeats) => setH({ ...h, repeats })} desc={h.repeats ? undefined : `Just once, in Year ${h.year ?? save.date.year}.`} />
        {!h.repeats && (
          <label className="field" style={{ width: 120 }}>
            <span className="label">Year</span>
            <input className="input" type="number" value={h.year ?? save.date.year} onChange={(e) => setH({ ...h, year: Number(e.target.value) || 1 })} />
          </label>
        )}
        <Field label="Notes">{(id) => <textarea id={id} className="textarea" value={h.notes ?? ''} onChange={(e) => setH({ ...h, notes: e.target.value })} />}</Field>
      </form>
    </Modal>
  );
}
