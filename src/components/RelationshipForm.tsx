import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { simName } from '../store/hooks';
import { nowIso, uid } from '../lib/ids';
import { REL_TYPES } from '../lib/relationships';
import type { Relationship, RelationshipType, Sim } from '../lib/types';
import { Field, Modal, Picker, Seg, Toggle } from './ui';

export function RelationshipForm({ sim, rel, onClose }: { sim: Sim; rel?: Relationship; onClose(): void }) {
  const { recs, upsert, remove } = useStore();
  const others = useMemo(
    () => Object.values(recs.sim).filter((s) => s.id !== sim.id).map((s) => ({ id: s.id, label: simName(s) })).sort((a, b) => a.label.localeCompare(b.label)),
    [recs.sim, sim.id],
  );
  const initialOther = rel ? (rel.a === sim.id ? rel.b : rel.a) : '';
  const [other, setOther] = useState(initialOther);
  const [type, setType] = useState<RelationshipType>(rel?.type ?? 'friend');
  // for parent: is the other Sim my parent, or my child?
  const [dir, setDir] = useState<'theirParent' | 'theirChild'>(rel && rel.type === 'parent' && rel.a === sim.id ? 'theirParent' : 'theirChild');
  const [label, setLabel] = useState(rel?.label ?? '');
  const [secret, setSecret] = useState(rel?.secret ?? false);
  const otherName = others.find((o) => o.id === other)?.label ?? 'them';

  const save = () => {
    if (!other) return;
    let a = sim.id;
    let b = other;
    if (type === 'parent') {
      // a is the parent of b
      if (dir === 'theirChild') [a, b] = [other, sim.id];
    }
    upsert('relationship', { id: rel?.id ?? uid(), a, b, type, label: label.trim() || undefined, secret, createdAt: rel?.createdAt ?? nowIso() });
    onClose();
  };

  return (
    <Modal
      title={rel ? 'Edit relationship' : `Add a relationship for ${sim.firstName}`}
      onClose={onClose}
      footer={
        <>
          {rel && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => { remove('relationship', rel.id); onClose(); }}>Remove</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!other}>Save</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div className="field">
          <span className="label">Who</span>
          {others.length ? (
            <Picker label="Pick a Sim" placeholder="Search Sims" options={others} value={other ? [other] : []} onChange={(v) => setOther(v[0] ?? '')} />
          ) : (
            <p className="small muted" style={{ margin: 0 }}>Add another Sim first, then link them here.</p>
          )}
        </div>
        <Field label="Relationship">
          {(id) => (
            <select id={id} className="select" value={type} onChange={(e) => setType(e.target.value as RelationshipType)}>
              {REL_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          )}
        </Field>
        {type === 'parent' && (
          <Seg
            label="Direction"
            value={dir}
            onChange={(v) => setDir(v)}
            options={[
              { v: 'theirChild', label: `${otherName} is ${sim.firstName}’s parent` },
              { v: 'theirParent', label: `${otherName} is ${sim.firstName}’s child` },
            ]}
          />
        )}
        <Field label="Label (optional)" hint="Shown instead of the type, like “Biological father” or “Godmother”.">
          {(id) => <input id={id} className="input" value={label} onChange={(e) => setLabel(e.target.value)} />}
        </Field>
        <div className="switch-row" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="grow">
            <div className="bold">Secret</div>
            <div className="small muted">Only the people in the story don’t know. A Sim can have a public parent and a secret biological one.</div>
          </div>
          <Toggle on={secret} onChange={setSecret} label="Secret" />
        </div>
      </div>
    </Modal>
  );
}
