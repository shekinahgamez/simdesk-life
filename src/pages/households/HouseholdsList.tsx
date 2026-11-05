import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { ObjIcon } from '../../components/categories';
import { Field, Modal, SearchBox, TextInput } from '../../components/ui';
import { householdTags, type HH } from '../../lib/households';
import { householdLabel } from '../../lib/sims';
import { go, savePath } from '../../lib/router';
import { matches, plural } from '../../lib/text';
import { useStore } from '../../lib/sync/react';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { HomePicker } from './HomePicker';
import { Faces, useHhCtx, type HhCtx } from './shared';

/** Sims | Households, at the top of both views of the Sims tab. */
export function SimsSwitch({ saveId, on }: { saveId: string; on: 'sims' | 'households' }) {
  return (
    <div className="hh-switch" role="tablist" aria-label="Show">
      <a role="tab" aria-selected={on === 'sims'} href={savePath(saveId, 'sims')}>Sims</a>
      <a role="tab" aria-selected={on === 'households'} href={savePath(saveId, 'households')}>Households</a>
    </div>
  );
}

/** The Households view of the Sims tab: one card per household, faces first. */
export function HouseholdsList({ save }: { save: SaveRow }) {
  const ctx = useHhCtx(save);
  const phone = useIsPhone();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState<HH | null>(null);
  const living = ctx.sims.filter((s) => !s.sim.deceased).length;
  const shown = ctx.households.filter((h) => !q.trim() || matches(h.data.name, q) || ctx.membersOf(h.id).some((s) => matches(`${s.sim.first} ${s.sim.last}`, q)));
  const open = (id: string) => go(savePath(save.id, `households/${id}`));

  const cards = ctx.households.length === 0 ? (
    <div className="empty">
      <ObjIcon cat="households" size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>No households yet</h2>
      <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New household</button>
    </div>
  ) : shown.length === 0 ? <p className="muted">No households match that.</p> : (
    <div className="hh-cards">
      {shown.map((h) => <HhCard key={h.id} ctx={ctx} h={h} onOpen={() => open(h.id)} onPick={() => setPicking(h)} />)}
    </div>
  );
  const dialogs = (
    <>
      {adding && <NewHousehold onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); open(id); }} />}
      {picking && <HomePicker ctx={ctx} hh={picking} onClose={() => setPicking(null)} />}
    </>
  );
  const search = ctx.households.length > 0 && <SearchBox value={q} onChange={setQ} placeholder={`Search ${plural(ctx.households.length, 'household')}`} />;

  if (phone) {
    return (
      <div className="m-stack">
        <h1 className="m-h1" style={{ paddingTop: 6 }}>Sims</h1>
        <SimsSwitch saveId={save.id} on="households" />
        {search && <div className="m-search">{search}</div>}
        {cards}
        <button type="button" className="m-fab" aria-label="New household" onClick={() => setAdding(true)}><Plus size={26} weight="bold" /></button>
        {dialogs}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <ObjIcon cat="sims" size="lg" />
          <div><h1>Sims</h1><div className="sub">{plural(living, 'Sim')} · {plural(ctx.households.length, 'household')}</div></div>
        </div>
        <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={18} weight="bold" /> New household</button>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <SimsSwitch saveId={save.id} on="households" />
        {search && <div style={{ flex: '0 1 380px' }}>{search}</div>}
      </div>
      {cards}
      {dialogs}
    </div>
  );
}

function HhCard({ ctx, h, onOpen, onPick }: { ctx: HhCtx; h: HH; onOpen(): void; onPick(): void }) {
  const home = ctx.homeOf(h);
  const members = ctx.membersOf(h.id);
  const tags = householdTags(h, ctx.owned, home);
  const world = home ? ctx.lots.worldName(home.world) : '';
  return (
    <div className="hh-card" onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      {members.length > 0 ? <Faces sims={members} /> : <span className="muted small">No Sims yet</span>}
      <h3>{householdLabel(h.data.name) || 'Unnamed'}</h3>
      <div className="ln">{home ? [home.title, world].filter(Boolean).join(' · ') : 'No home yet'}</div>
      {(tags.length > 0 || !home) && (
        <div className="row" style={{ gap: 6 }}>
          {tags.map((t) => <span key={t} className="tag outline-soft">{t}</span>)}
          {!home && <button type="button" className="btn sm" onClick={(e) => { e.stopPropagation(); onPick(); }}>Pick a home</button>}
        </div>
      )}
    </div>
  );
}

/** Name a new household. */
export function NewHousehold({ onClose, onSaved, id: editId, start = '' }: { onClose(): void; onSaved(id: string): void; id?: string; start?: string }) {
  const store = useStore();
  const [name, setName] = useState(start);
  const [tried, setTried] = useState(false);
  const save = () => {
    setTried(true);
    if (!name.trim()) return;
    const cur = editId ? store.get(editId) : undefined;
    const id = store.put('household', { home: null, notes: '', ...(cur?.data ?? {}), name: name.trim() }, editId);
    onSaved(id);
  };
  return (
    <Modal title={editId ? 'Edit household' : 'New household'} onClose={onClose} dirty={name !== start}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={save}>{editId ? 'Save' : 'Add household'}</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Household name" hint={tried && !name.trim() ? <span className="field-err">Give it a name.</span> : undefined}>
          {(id) => <TextInput kind="name" id={id} placeholder="Like Okafor" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />}
        </Field>
      </form>
    </Modal>
  );
}
