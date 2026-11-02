import { useState } from 'react';
import { useStore } from '../store/store';
import { useGameData } from '../data/gameData';
import type { MergedLot, MergedWorld } from '../store/hooks';
import { nowIso, uid } from '../lib/ids';
import { lotRec } from '../lib/lots';
import type { LotRecord } from '../lib/types';
import { Field, Modal } from './ui';

export const LOT_SIZES = ['20x15', '20x20', '30x20', '30x30', '40x30', '40x40', '50x50', '64x64'];

/** Edit any lot, or add a custom one to a world. */
export function LotForm({ lot, world, neighborhoods, onClose }: { lot?: MergedLot; world: MergedWorld; neighborhoods: string[]; onClose(rec?: LotRecord): void }) {
  const { upsert } = useStore();
  const lotTypes = useGameData((s) => s.data?.lotTypes ?? []);
  const [r, setR] = useState<LotRecord>(() =>
    lot ? { ...lotRec(lot) } : { id: uid(), worldId: world.id, photos: [], lotTraits: [], history: [], originalName: '', createdAt: nowIso() },
  );
  const isCustom = !lot?.game;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCustom && !(r.originalName?.trim() || r.name?.trim())) return;
    upsert('lot', r);
    onClose(r);
  };
  return (
    <Modal
      title={lot ? `Edit ${lot.name}` : `Add a lot to ${world.name}`}
      onClose={() => onClose()}
      footer={<><button className="btn" onClick={() => onClose()}>Cancel</button><button className="btn primary" form="lot-form">{lot ? 'Save changes' : 'Add lot'}</button></>}
    >
      <form id="lot-form" className="form-grid" onSubmit={submit}>
        {isCustom && (
          <Field label="Lot name in the game" full>{(id) => <input id={id} className="input" required value={r.originalName ?? ''} onChange={(e) => setR({ ...r, originalName: e.target.value })} />}</Field>
        )}
        <Field label="Your name for it" full hint={lot?.game ? `In the game it’s ${lot.game.name}.` : 'Leave blank to use the game’s name.'}>
          {(id) => <input id={id} className="input" placeholder={lot?.game?.name ?? r.originalName ?? ''} value={r.name ?? ''} onChange={(e) => setR({ ...r, name: e.target.value || undefined })} />}
        </Field>
        <Field label="Your lot type" hint="Your own label, like “Corner bakery” or “Old money estate”.">
          {(id) => <input id={id} className="input" value={r.lotType ?? ''} onChange={(e) => setR({ ...r, lotType: e.target.value || undefined })} />}
        </Field>
        <Field label="Game lot type">
          {(id) => (
            <select id={id} className="select" value={r.gameLotType ?? lot?.game?.lotType ?? ''} onChange={(e) => setR({ ...r, gameLotType: e.target.value || undefined })}>
              <option value="">Not set</option>
              {lotTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Neighborhood">
          {(id) => (
            <>
              <input id={id} className="input" list="hood-list" value={r.neighborhood ?? lot?.game?.neighborhood ?? ''} onChange={(e) => setR({ ...r, neighborhood: e.target.value || undefined })} />
              <datalist id="hood-list">{neighborhoods.map((n) => <option key={n} value={n} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Size">
          {(id) => (
            <>
              <input id={id} className="input" list="size-list" placeholder={lot?.game?.size || '30x20'} value={r.size ?? ''} onChange={(e) => setR({ ...r, size: e.target.value || undefined })} />
              <datalist id="size-list">{LOT_SIZES.map((n) => <option key={n} value={n} />)}</datalist>
            </>
          )}
        </Field>
      </form>
    </Modal>
  );
}
