import { useState } from 'react';
import { Check, LockSimple, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { GAME } from '../../data/game';
import { Confirm, Modal, TextInput, toast } from '../../components/ui';
import { CUSTOM_TYPE_PREFIX, lotData } from '../../lib/lots';
import { useRecords } from '../../lib/sync/react';
import { plural } from '../../lib/text';
import { useCustomLotTypes } from './shared';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Your own lot types (like Hotel): add, rename, remove. The game's own types are listed but locked.
 * A type that lots are using can't be removed until those lots change.
 */
export function ManageLotTypes({ onClose }: { onClose(): void }) {
  const types = useCustomLotTypes();
  const lots = useRecords('lot');
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [showGame, setShowGame] = useState(false);
  const usedBy = (id: string) => lots.filter((r) => lotData(r).type === `${CUSTOM_TYPE_PREFIX}${id}`).length;
  const taken = (name: string, except?: string) => GAME.lotTypes.some((t) => same(t.name, name)) || types.list.some((t) => t.id !== except && same(t.name, name));

  const add = () => {
    const name = adding.trim();
    if (!name) return;
    if (taken(name)) { setError(`There’s already a lot type called “${name}”.`); return; }
    types.add(name); setAdding(''); setError('');
  };
  const saveRename = (id: string) => {
    const name = draft.trim();
    if (!name) { setEditing(null); return; }
    if (taken(name, id)) { setError(`There’s already a lot type called “${name}”.`); return; }
    types.rename(id, name); setEditing(null); setError(''); toast('Renamed');
  };
  const gone = removing ? types.list.find((t) => t.id === removing) : undefined;

  return (
    <Modal title="Your lot types" onClose={onClose}
      footer={(close) => <button type="button" className="btn primary" onClick={close}>Done</button>}>
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted small" style={{ margin: 0 }}>Add types the game doesn’t have, like Hotel. They count as regular community lots.</p>
        <div className="lt-note"><b>A tip:</b> only add a lot type if you’ve added a mod that creates it in your game. That keeps SimDesk matching what you see when you play.</div>
        <form className="row" style={{ gap: 8, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); add(); }}>
          <TextInput value={adding} onChange={(e) => { setAdding(e.target.value); setError(''); }} maxLength={40} placeholder="Add a lot type" aria-label="Add a lot type" />
          <button type="submit" className="btn" disabled={!adding.trim()}><Plus size={16} weight="bold" /> Add</button>
        </form>
        {error && <div className="field-err" role="alert">{error}</div>}
        {types.list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>None yet.</p> : (
          <div className="lt-list">
            {types.list.map((t) => {
              const n = usedBy(t.id);
              return (
                <div key={t.id} className="lt-row">
                  {editing === t.id ? (
                    <>
                      <TextInput value={draft} autoFocus maxLength={40} aria-label={`Rename ${t.name}`} onChange={(e) => { setDraft(e.target.value); setError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRename(t.id); } if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); setError(''); } }} />
                      <button type="button" className="btn icon" aria-label="Save name" onClick={() => saveRename(t.id)}><Check size={18} weight="bold" /></button>
                    </>
                  ) : (
                    <>
                      <div className="grow"><b>{t.name}</b><span className="muted small"> · {n ? `used by ${plural(n, 'lot')}` : 'not used yet'}</span></div>
                      <button type="button" className="btn icon ghost" aria-label={`Rename ${t.name}`} onClick={() => { setEditing(t.id); setDraft(t.name); setError(''); }}><PencilSimple size={17} weight="duotone" /></button>
                      <button type="button" className="btn icon ghost" aria-label={`Remove ${t.name}`} disabled={n > 0} title={n > 0 ? 'Change those lots first' : undefined} onClick={() => setRemoving(t.id)}><Trash size={17} weight="duotone" /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {types.list.some((t) => usedBy(t.id) > 0) && <p className="muted small" style={{ margin: 0 }}>A type can’t be removed while lots use it. Change those lots to another type first.</p>}
        <div>
          <button type="button" className="lt-game" aria-expanded={showGame} onClick={() => setShowGame(!showGame)}><LockSimple size={14} weight="bold" /> From the game ({GAME.lotTypes.length}) · can’t be changed</button>
          {showGame && <div className="lt-gamelist">{[...GAME.lotTypes].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <span key={t.id} className="chip">{t.name}</span>)}</div>}
        </div>
      </div>
      {gone && (
        <Confirm title={`Remove ${gone.name}?`} text="Nothing uses it, so no lot changes." onCancel={() => setRemoving(null)}
          actions={[{ label: 'Keep it', run: () => setRemoving(null) }, { label: 'Remove', kind: 'danger', run: () => { types.remove(gone.id); setRemoving(null); } }]} />
      )}
    </Modal>
  );
}
