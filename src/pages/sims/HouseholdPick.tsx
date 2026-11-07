import { useStore } from '../../lib/sync/react';
import { householdLabel, NO_HOUSEHOLD } from '../../lib/sims';
import { plural } from '../../lib/text';
import { toast } from '../../components/ui';
import { ChoiceList, RowPop } from './RowEdit';
import { useHouseholds } from './shared';

/**
 * Pick a household for one Sim or several, right where you are. Typing a name that isn't there yet
 * offers "New household …", made on the spot. Saves straight away, with Undo.
 */
export function HouseholdPick({ simIds, current, anchor, phone, onClose, onDone }: {
  simIds: string[]; current: string | null | undefined; anchor: HTMLElement | null; phone: boolean; onClose(): void; onDone?(): void;
}) {
  const store = useStore();
  const hh = useHouseholds();
  const title = simIds.length === 1 ? 'Household' : `Move ${plural(simIds.length, 'Sim')} to`;
  const move = (target: string | null) => {
    const before = simIds.map((id) => ({ id, hh: ((store.get(id)?.data ?? {}) as { householdId?: string | null }).householdId ?? null }));
    const put = (id: string, householdId: string | null) => { const r = store.get(id); if (r) store.put('sim', { ...r.data, householdId }, id); };
    for (const id of simIds) put(id, target);
    const name = target ? String(((store.get(target)?.data ?? {}) as { name?: string }).name ?? '') : '';
    const where = target ? householdLabel(name || 'the household') : 'no household';
    toast(simIds.length === 1 ? `Moved to ${where}` : `Moved ${plural(simIds.length, 'Sim')} to ${where}`, {
      label: 'Undo', run: () => before.forEach((b) => put(b.id, b.hh)),
    });
    onClose();
    onDone?.();
  };
  const make = (name: string) => store.put('household', { name, home: null, notes: '' });
  return (
    <RowPop anchor={anchor} title={title} phone={phone} onClose={onClose}>
      <ChoiceList
        value={current}
        options={hh.list.map((r) => ({ id: r.id, label: hh.nameOf(r.id), group: 'Households' }))}
        none="No household"
        onPick={(id) => move(id === NO_HOUSEHOLD ? null : id)}
        onAdd={make}
        addLabel={(t) => `New household “${t}”`} />
    </RowPop>
  );
}
