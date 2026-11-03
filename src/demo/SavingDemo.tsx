import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, PencilSimple, Plus, Trash, User } from '@phosphor-icons/react';
import { ChangedElsewhere, DeleteSaveDialog, DraftNote, SaveTrash, SyncCloud, SyncLine, TrashList } from '../components/sync';
import { Field, Modal, TextInput, Toggle, toast } from '../components/ui';
import { MemoryBackend } from '../lib/sync/memoryBackend';
import { SyncProvider, useDraft, useEditGuard, useRecords, useSaves, useStore, useStoreVersion, useTrash } from '../lib/sync/react';
import { SyncStore } from '../lib/sync/store';
import type { SaveRow } from '../lib/sync/types';

/**
 * Test area for step 5 on the style check page. It uses a pretend account kept in this browser
 * (the preview can't reach Supabase), with the same saving engine the real app uses.
 */

const FIRST = ['Bella', 'Mortimer', 'José', 'Zoë', 'Renée', 'Chloé', 'Søren', 'Ana María', 'Malcolm', 'Nancy'];
const LAST = ['Goth', 'Landgraab', 'Ramírez', 'Lindqvist', 'Dubois', 'Okafor', 'Berg', 'Núñez', 'Caliente', 'Pancakes'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
type SimData = { first: string; last: string };
const simName = (d: Record<string, unknown>) => `${String(d.first ?? '')} ${String(d.last ?? '')}`.trim() || 'Unnamed Sim';
const SimIcon = () => <span className="obj sims" aria-hidden="true"><User size={16} weight="duotone" /></span>;

function SimForm({ id, onClose }: { id: string | null; onClose(): void }) {
  const store = useStore();
  const saveId = store.openId!;
  const original = (id ? store.get(id)?.data : null) as SimData | null;
  const draftKey = `${saveId}:sim:${id ?? 'new'}`;
  const draft = useDraft<SimData>(draftKey);
  const [fromDraft] = useState(() => draft.draft);
  const [form, setForm] = useState<SimData>(() => fromDraft ?? original ?? { first: '', last: '' });
  const [showDraftNote, setShowDraftNote] = useState(!!fromDraft);
  const guard = useEditGuard(id);
  const base = original ?? { first: '', last: '' };
  const dirty = form.first !== base.first || form.last !== base.last;

  const set = (patch: Partial<SimData>) => {
    const next = { ...form, ...patch };
    setForm(next);
    // Kept as a draft while typing, so nothing is lost if the page closes.
    if (next.first !== base.first || next.last !== base.last) draft.save(next);
    else draft.clear();
  };
  const save = () => {
    const newId = store.put('sim', form, id ?? undefined);
    draft.clear();
    onClose();
    toast(id ? 'Sim saved' : `${simName(form)} added`);
    return newId;
  };
  const theirs = guard.theirs;

  return (
    <Modal title={id ? 'Edit Sim' : 'New Sim'} onClose={() => { draft.clear(); onClose(); }} dirty={dirty}
      onSaveDraft={() => { draft.save(form); onClose(); toast('Draft saved. It’s kept for 14 days.'); }}
      footer={(close) => <>
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <button type="button" className="btn primary" disabled={!form.first.trim()} onClick={save}>{id ? 'Save changes' : 'Add Sim'}</button>
      </>}>
      <div className="stack">
        {theirs && (
          <ChangedElsewhere what="Sim" theirs={theirs} onKeep={guard.keepMine}
            onTheirs={() => { const r = guard.useTheirs(); if (r) { setForm(r.data as SimData); draft.clear(); } }} />
        )}
        {showDraftNote && draft.savedAt && draft.daysLeft !== null && (
          <DraftNote savedAt={draft.savedAt} daysLeft={draft.daysLeft} expiringSoon={draft.expiringSoon}
            onDiscard={() => { draft.clear(); setForm(base); setShowDraftNote(false); }} />
        )}
        <div className="form-grid">
          <Field label="First name">{(fid) => <TextInput kind="name" id={fid} value={form.first} onChange={(e) => set({ first: e.target.value })} />}</Field>
          <Field label="Last name">{(fid) => <TextInput kind="name" id={fid} value={form.last} onChange={(e) => set({ last: e.target.value })} />}</Field>
        </div>
      </div>
    </Modal>
  );
}

function OpenSave({ backend }: { backend: MemoryBackend }) {
  const store = useStore();
  const sims = useRecords('sim');
  const trash = useTrash();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const save = store.saves.get(store.openId!);
  const sorted = useMemo(() => [...sims].sort((a, b) => simName(a.data).localeCompare(simName(b.data))), [sims]);
  const newDraft = store.getDraft(`${store.openId}:sim:new`);

  const otherDevice = () => {
    const target = sorted[0];
    if (!target) return toast('Add a Sim first.');
    toast(`In 5 seconds your other device renames ${simName(target.data)}. Open their Edit form to see what happens.`);
    setTimeout(() => renameElsewhere(target.id), 5000);
  };
  const renameElsewhere = (id: string) => {
    const target = store.openId ? store.records.get(id) : undefined;
    if (!target || !store.openId) return;
    const last = pick(LAST.filter((l) => l !== target.data.last));
    const ok = backend.otherDeviceEdit(store.openId!, target.id, (d) => ({ ...d, last }));
    toast(ok ? (backend.offline ? 'Your other device changed a Sim. You’ll see it once you’re back online.' : `Your other device renamed ${String(target.data.first)} to ${String(target.data.first)} ${last}.`) : 'That Sim hasn’t synced yet. Wait for “All changes synced”.');
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>{save?.data.name}</b>
        <button type="button" className="btn sm" onClick={() => store.closeSave()}>Close save</button>
      </div>
      <div className="row">
        <button type="button" className="btn primary sm" onClick={() => setEditing('new')}><Plus size={16} weight="bold" /> {newDraft ? 'New Sim (draft waiting)' : 'New Sim'}</button>
        <button type="button" className="btn sm" onClick={() => store.put('sim', { first: pick(FIRST), last: pick(LAST) })}>Add a random Sim</button>
      </div>
      <div className="notice" role="note">
        <div className="notice-body">
          <b>Two-device test</b>
          <span>1. Tap the button below. 2. Within 5 seconds, tap Edit on {sorted[0] ? <b>{simName(sorted[0].data)}</b> : 'the first Sim'} (the top one). 3. Your “other device” renames them while the form is open, and you get to pick Keep mine or Use theirs.</span>
          <div className="row">
            <button type="button" className="btn sm primary" disabled={sorted.length === 0} onClick={otherDevice}>Rename the top Sim from my other device in 5 seconds</button>
          </div>
          {sorted.length === 0 && <span className="muted">Add a Sim first.</span>}
        </div>
      </div>
      {sorted.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No Sims yet.</p> : (
        <div className="trash-list">
          {sorted.map((r) => (
            <div key={r.id} className="trash-row">
              <SimIcon />
              <div className="trash-txt"><b>{simName(r.data)}</b>{store.getDraft(`${store.openId}:sim:${r.id}`) && <span>Has a draft</span>}</div>
              <button type="button" className="btn sm" onClick={() => setEditing(r.id)}><PencilSimple size={16} weight="duotone" /> Edit</button>
              <button type="button" className="btn sm ghost icon" aria-label={`Delete ${simName(r.data)}`} onClick={() => store.moveToTrash(r.id, simName(r.data))}>
                <Trash size={18} weight="duotone" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="m-label" style={{ margin: '6px 0 0' }}>Trash</div>
      <TrashList items={trash} describe={(r) => ({ name: simName(r.data), icon: <SimIcon /> })} />
      {editing && <SimForm id={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SaveList() {
  const store = useStore();
  const { active, trashed } = useSaves();
  const [deleting, setDeleting] = useState<SaveRow | null>(null);
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn primary sm" onClick={() => store.createSave({ name: `Test save ${active.length + trashed.length + 1}` })}>
          <Plus size={16} weight="bold" /> New test save
        </button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {active.length === 0 ? 'No saves yet. Make one, then tap Open to try Sims, Undo, Trash, drafts and the two-device test.' : 'Tap Open on a save to try Sims, Undo, Trash, drafts and the two-device test.'}
      </p>
      {active.length === 0 ? null : (
        <div className="trash-list">
          {active.map((s) => (
            <div key={s.id} className="trash-row">
              <span className="obj berry" aria-hidden="true"><FolderOpen size={16} weight="duotone" /></span>
              <div className="trash-txt"><b>{s.data.name}</b></div>
              <button type="button" className="btn sm" onClick={() => store.openSave(s.id)}>Open</button>
              <button type="button" className="btn sm ghost icon" aria-label={`Delete ${s.data.name}`} onClick={() => setDeleting(s)}>
                <Trash size={18} weight="duotone" />
              </button>
            </div>
          ))}
        </div>
      )}
      {trashed.length > 0 && <><div className="m-label" style={{ margin: '6px 0 0' }}>Saves in Trash</div><SaveTrash saves={trashed} /></>}
      {deleting && <DeleteSaveDialog save={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}

function Inner({ backend, onReset }: { backend: MemoryBackend; onReset(): void }) {
  const store = useStore();
  useStoreVersion();
  const [offline, setOffline] = useState(backend.offline);
  const flip = (v: boolean) => {
    setOffline(v);
    backend.offline = v;
    store.setOnline(!v);
    if (!v) backend.reconnected();
  };
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <SyncLine />
        <div className="row" style={{ gap: 6 }}><span className="muted small">Phone cloud:</span><SyncCloud /><span className="muted small">{store.status === 'synced' ? '(hidden while synced)' : ''}</span></div>
      </div>
      <div className="row"><Toggle on={offline} onChange={flip} label="Pretend I’m offline" /><span>Pretend I’m offline</span></div>
      {store.openId ? <OpenSave backend={backend} /> : <SaveList />}
      <div><button type="button" className="btn sm ghost danger" onClick={onReset}>Reset this test</button></div>
    </div>
  );
}

export function SavingDemo() {
  const [round, setRound] = useState(0);
  const [pair, setPair] = useState<{ backend: MemoryBackend; store: SyncStore } | null>(null);
  useEffect(() => {
    const backend = new MemoryBackend('sd:demo-account');
    const store = new SyncStore(backend, 'demo');
    Object.assign(window, { __sdDemo: { backend, store } }); // for automated tests
    if (backend.offline) store.setOnline(false);
    setPair({ backend, store });
    store.start();
    return () => store.stop();
  }, [round]);
  if (!pair) return null;
  const reset = async () => {
    await pair.store.wipe();
    pair.backend.reset();
    setRound((r) => r + 1);
  };
  return (
    <section>
      <h2>Saving test (step 5)</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        A pretend account in this browser, using the real saving engine. Try: make a save, add Sims, go offline and edit,
        reload the page while offline, come back online, delete and Undo, use Trash, start a New Sim and close it to keep a draft,
        and open a Sim while your “other device” renames it.
      </p>
      <SyncProvider store={pair.store} key={round}>
        <Inner backend={pair.backend} onReset={reset} />
      </SyncProvider>
    </section>
  );
}
