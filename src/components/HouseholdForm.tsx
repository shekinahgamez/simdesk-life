import { useMemo, useState } from 'react';
import { useSave, useStore } from '../store/store';
import { useLots, useWorlds } from '../store/hooks';
import { nowIso, uid } from '../lib/ids';
import type { Household } from '../lib/types';
import { Field, Modal, Picker } from './ui';

export const ROTATION_LABEL: Record<NonNullable<Household['rotation']>, string> = {
  active: 'Playing now',
  next: 'Up next',
  paused: 'Paused',
  none: 'Not in rotation',
};

export function HouseholdForm({ household, onClose }: { household?: Household; onClose(h?: Household): void }) {
  const save = useSave()!;
  const { upsert } = useStore();
  const lots = useLots();
  const worlds = useWorlds();
  const [h, setH] = useState<Household>(household ?? { id: uid(), name: '', rotation: 'none', createdAt: nowIso() });
  const worldName = useMemo(() => new Map(worlds.map((w) => [w.id, w.name])), [worlds]);
  const lotOptions = useMemo(
    () =>
      lots
        .map((l) => ({ id: l.id, label: l.name, group: worldName.get(l.worldId) ?? 'Other', hint: [l.neighborhood, l.size].filter(Boolean).join(' · ') }))
        .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)),
    [lots, worldName],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!h.name.trim()) return;
    const next = { ...h, name: h.name.trim() };
    upsert('household', next);
    onClose(next);
  };

  return (
    <Modal
      title={household ? `Edit ${household.name}` : 'New household'}
      onClose={() => onClose()}
      footer={<><button className="btn" onClick={() => onClose()}>Cancel</button><button className="btn primary" form="hh-form">{household ? 'Save changes' : 'Create household'}</button></>}
    >
      <form id="hh-form" className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <Field label="Household name">{(id) => <input id={id} className="input" placeholder="Okafor household" required value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} />}</Field>
        <div className="field">
          <span className="label">Home lot</span>
          {lotOptions.length ? (
            <Picker label="Home lot" placeholder="Search lots" options={lotOptions} value={h.homeLotId ? [h.homeLotId] : []} onChange={(v) => setH({ ...h, homeLotId: v[0] })} />
          ) : (
            <span className="small muted">No lots yet. Add lots from a world page, then come back.</span>
          )}
        </div>
        {save.modules.rotation && (
          <Field label="Rotation">
            {(id) => (
              <select id={id} className="select" value={h.rotation ?? 'none'} onChange={(e) => setH({ ...h, rotation: e.target.value as Household['rotation'] })}>
                {Object.entries(ROTATION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
          </Field>
        )}
      </form>
    </Modal>
  );
}
