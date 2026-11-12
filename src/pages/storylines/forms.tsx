import { useMemo, useState, type ReactNode } from 'react';
import { CaretLeft, Plus, Trash, X } from '@phosphor-icons/react';
import { Field, Modal, SearchBox, Seg, TextInput, Toggle, toast } from '../../components/ui';
import { WhenField } from '../../components/WhenField';
import { BLANK_FEELING, BLANK_SECRET, BLANK_STORYLINE, cleanTags, FEEL_KINDS, STATUSES, tagChoices, type BeatData, type FeelingData, type SecretData, type StorylineData } from '../../lib/storylines';
import { normalize } from '../../lib/text';
import { useStore } from '../../lib/sync/react';
import { SimAvatar } from '../sims/shared';
import type { StoriesCtx } from './shared';

/** A row you tap to open a list: the label, what's chosen, and "Change". */
export function PickRow({ label, text, empty, action, onClick }: { label: string; text: string; empty?: boolean; action?: string; onClick(): void }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <button type="button" className="ph-fld" aria-label={`${label}: ${text}${action ? `. ${action}` : ''}`} onClick={onClick}>
        <span className={empty ? 'ph-fld-empty' : ''}>{text}</span>{action && <small>{action}</small>}
      </button>
    </div>
  );
}

const namesText = (ctx: StoriesCtx, ids: string[]) => (ids.length > 3 ? `${ids.slice(0, 3).map(ctx.firstOf).join(', ')} +${ids.length - 3}` : ids.map(ctx.firstOf).join(', '));

/** The title with a back arrow, shown while a list is open inside a window. */
export function backTitle(text: string, back: () => void, clear?: () => void): ReactNode {
  return (
    <span className="ph-ft">
      <button type="button" className="ph-ft-back" aria-label="Back" onClick={back}><CaretLeft size={22} weight="bold" /></button>
      <span>{text}</span>
      {clear && <button type="button" className="ph-ft-clear" onClick={clear}>Clear</button>}
    </span>
  );
}

/** Searchable Sim list. `value` is who's chosen; `single` means one tap picks and `onDone` fires. */
export function SimChecklist({ ctx, value, onChange, single, onDone, counts }: {
  ctx: StoriesCtx; value: string[]; onChange(ids: string[]): void; single?: boolean; onDone?(): void; counts?: Map<string, number>;
}) {
  const [q, setQ] = useState('');
  const ok = (l: string) => !q.trim() || normalize(l).includes(normalize(q));
  const all = useMemo(() => [...ctx.sims.keys()].filter((id) => !ctx.sims.get(id)!.deceased).map((id) => ({ id, label: ctx.nameOf(id) }))
    .sort((a, b) => (counts ? (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) : 0) || a.label.localeCompare(b.label)), [ctx, counts]);
  const chosen = value.filter((id) => ctx.sims.has(id)).map((id) => ({ id, label: ctx.nameOf(id) })).filter((o) => ok(o.label));
  const rest = all.filter((o) => !value.includes(o.id) && ok(o.label)).slice(0, 120);
  const line = (o: { id: string; label: string }, on: boolean) => (
    <button key={o.id} type="button" role={single ? 'option' : 'checkbox'} aria-checked={single ? undefined : on} aria-selected={single ? on : undefined} aria-label={o.label} className="ph-pk-sim"
      onClick={() => { if (single) { onChange([o.id]); onDone?.(); } else onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id]); }}>
      {!single && <span className={`ph-cb ${on ? 'on' : ''}`} aria-hidden="true" />}
      <SimAvatar sim={ctx.sims.get(o.id)!} size={30} /><span className="ph-pk-t">{o.label}</span>
      {counts && <span className="sl-n">{counts.get(o.id) ?? 0}</span>}
    </button>
  );
  return (
    <div className="ph-pk">
      <div className="ph-pk-search"><SearchBox value={q} onChange={setQ} placeholder={`Search ${all.length} Sims`} /></div>
      <div className="ph-pk-list">
        {chosen.length > 0 && <div className="ph-lbl">Selected</div>}{chosen.map((o) => line(o, true))}
        {rest.length > 0 && <div className="ph-lbl">{counts ? 'Most storylines' : 'Everyone'}</div>}{rest.map((o) => line(o, false))}
        {chosen.length + rest.length === 0 && <p className="muted ph-pk-none">{all.length ? `No Sim called “${q.trim()}”.` : 'Add some Sims first.'}</p>}
      </div>
    </div>
  );
}

/** Searchable storyline list; one tap picks. Typing a new name offers to start it. */
export function StoryChecklist({ ctx, value, onPick, onNew }: { ctx: StoriesCtx; value: string | null; onPick(id: string): void; onNew?(name: string): void }) {
  const [q, setQ] = useState('');
  const shown = ctx.stories.filter((r) => r.s.status !== 'resolved' || r.id === value).filter((r) => !q.trim() || normalize(r.s.name).includes(normalize(q)))
    .sort((a, b) => a.s.name.localeCompare(b.s.name));
  const typed = q.trim();
  return (
    <div className="ph-pk">
      <div className="ph-pk-search"><SearchBox value={q} onChange={setQ} placeholder="Search storylines" /></div>
      <div className="ph-pk-list">
        {shown.map((r) => (
          <button key={r.id} type="button" role="option" aria-selected={value === r.id} className="ph-pk-opt" onClick={() => onPick(r.id)}>
            <span className="ph-pk-t">{r.s.name || 'Unnamed storyline'}</span>
          </button>
        ))}
        {onNew && typed && !ctx.stories.some((r) => normalize(r.s.name) === normalize(typed)) && (
          <button type="button" className="ph-pk-opt" onClick={() => onNew(typed)}><Plus size={16} weight="bold" /><span className="ph-pk-t">New storyline “{typed}”</span></button>
        )}
        {shown.length === 0 && !typed && <p className="muted ph-pk-none">No storylines yet. Type a name to start one.</p>}
      </div>
    </div>
  );
}

// ---------- storyline ----------
export function StoryForm({ ctx, id, name, onClose, onSaved }: { ctx: StoriesCtx; id: string | null; name?: string; onClose(): void; onSaved(id: string): void }) {
  const store = useStore();
  const [start] = useState<StorylineData>(() => (id ? ctx.byId.get(id)?.s : undefined) ?? { ...BLANK_STORYLINE, name: name ?? '' });
  const [f, setF] = useState(start);
  const [view, setView] = useState<'form' | 'cast'>('form');
  const [tagText, setTagText] = useState('');
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  const set = (p: Partial<StorylineData>) => setF((x) => ({ ...x, ...p }));
  const sug = tagChoices(ctx.stories).filter((t) => !f.tags.some((x) => x.toLowerCase() === t.label.toLowerCase()) && (!tagText.trim() || normalize(t.label).includes(normalize(tagText)))).slice(0, 6);
  const addTag = (t: string) => { set({ tags: cleanTags([...f.tags, t]) }); setTagText(''); };
  const submit = () => {
    if (!f.name.trim()) { setTried(true); return; }
    const data = { ...f, name: f.name.trim(), tags: cleanTags(tagText.trim() ? [...f.tags, tagText] : f.tags) };
    const sid = store.put('storyline', data as unknown as Record<string, unknown>, id ?? undefined);
    toast(id ? 'Saved' : 'Storyline added');
    onSaved(sid);
  };
  return (
    <Modal title={view === 'form' ? (id ? 'Edit storyline' : 'New storyline') : backTitle('Cast', () => setView('form'))} onClose={onClose} dirty={dirty} className="pinned ph-modal"
      footer={view === 'cast' ? <button type="button" className="btn primary" onClick={() => setView('form')}>{f.cast.length ? `Done · ${f.cast.length} selected` : 'Done'}</button> : (close) => (
        <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={submit}>{id ? 'Save' : 'Add storyline'}</button></>
      )}>
      {view === 'cast' ? <SimChecklist ctx={ctx} value={f.cast} onChange={(cast) => set({ cast })} /> : (
        <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="Name">{(fid) => <TextInput id={fid} value={f.name} maxLength={60} placeholder="Hookah bar night" aria-invalid={tried && !f.name.trim()} onChange={(e) => set({ name: e.target.value })} autoFocus={!id} />}</Field>
          {tried && !f.name.trim() && <p className="hint err" role="alert">Give it a name.</p>}
          <div className="field"><span className="label">Status</span><Seg value={f.status} options={STATUSES.map((s) => ({ v: s.id, label: s.label }))} onChange={(status) => set({ status })} label="Status" /></div>
          <PickRow label="Cast" text={f.cast.length ? namesText(ctx, f.cast) : 'No one yet'} empty={!f.cast.length} action={f.cast.length ? 'Change' : 'Choose'} onClick={() => setView('cast')} />
          <div className="field">
            <span className="label">Tags</span>
            {f.tags.length > 0 && <div className="sl-tags">{f.tags.map((t) => <span key={t} className="tag outline-soft">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => set({ tags: f.tags.filter((x) => x !== t) })}><X size={12} weight="bold" /></button></span>)}</div>}
            <input className="input" value={tagText} maxLength={24} aria-label="Add a tag" placeholder="Add a tag, like Drama" onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && tagText.trim()) { e.preventDefault(); addTag(tagText); } }} />
            {sug.length > 0 && <div className="sl-tags sug">{sug.map((t) => <button key={t.label} type="button" className="tag outline-soft" onClick={() => addTag(t.label)}>{t.label}</button>)}</div>}
          </div>
          <Toggle on={f.pinned} onChange={(pinned) => set({ pinned })} label="Pin to the top" />
        </form>
      )}
    </Modal>
  );
}

// ---------- beat ----------
export function BeatForm({ ctx, id, storyline, onClose, onSaved }: { ctx: StoriesCtx; id: string | null; storyline?: string | null; onClose(): void; onSaved?(): void }) {
  const store = useStore();
  const { info } = ctx;
  const rec = id ? ctx.beats.find((b) => b.id === id)?.b : undefined;
  const [start] = useState<BeatData>(() => rec ?? { storyline: storyline ?? '', text: '', sims: [], day: info.track ? info.today : null, precision: 'day', video: false, secret: false, addedAt: '' });
  const [f, setF] = useState(start);
  const [view, setView] = useState<'form' | 'sims' | 'story'>('form');
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  const set = (p: Partial<BeatData>) => setF((x) => ({ ...x, ...p }));
  const story = ctx.byId.get(f.storyline);
  const submit = () => {
    if (!f.text.trim() || !f.storyline) { setTried(true); return; }
    store.put('beat', { ...f, text: f.text.trim(), day: info.track ? f.day : null, addedAt: f.addedAt || new Date().toISOString() }, id ?? undefined);
    toast(id ? 'Saved' : 'Beat added');
    onSaved?.();
    onClose();
  };
  const newStory = (name: string) => {
    const sid = store.put('storyline', { ...BLANK_STORYLINE, name } as unknown as Record<string, unknown>);
    set({ storyline: sid });
    setView('form');
  };
  const title = view === 'form' ? (id ? 'Edit beat' : 'Add beat') : backTitle(view === 'sims' ? 'Sims in this beat' : 'Storyline', () => setView('form'));
  return (
    <Modal title={title} onClose={onClose} dirty={dirty} className="pinned ph-modal"
      footer={view === 'sims' ? <button type="button" className="btn primary" onClick={() => setView('form')}>{f.sims.length ? `Done · ${f.sims.length} selected` : 'Done'}</button> : view === 'story' ? undefined : (close) => (
        <>
          {id && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => { store.moveToTrash(id, 'Beat'); onClose(); }}><Trash size={16} weight="duotone" /> Delete</button>}
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn primary" onClick={submit}>Save beat</button>
        </>
      )}>
      {view === 'sims' ? <SimChecklist ctx={ctx} value={f.sims} onChange={(sims) => set({ sims })} /> : view === 'story' ? (
        <StoryChecklist ctx={ctx} value={f.storyline} onPick={(sid) => { set({ storyline: sid }); setView('form'); }} onNew={newStory} />
      ) : (
        <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="What happened">{(fid) => <textarea id={fid} className="textarea" rows={3} value={f.text} maxLength={600} autoFocus={!id} aria-invalid={tried && !f.text.trim()} placeholder="Corey and Kiana showed up at the door…" onChange={(e) => set({ text: e.target.value })} />}</Field>
          {tried && !f.text.trim() && <p className="hint err" role="alert">Say what happened.</p>}
          <PickRow label="Sims" text={f.sims.length ? namesText(ctx, f.sims) : 'No one picked'} empty={!f.sims.length} action={f.sims.length ? 'Change' : 'Choose'} onClick={() => setView('sims')} />
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            {info.track && (
              <div className="grow"><WhenField cal={info.cal} today={info.today} value={{ day: f.day, precision: f.precision }} onChange={(w) => set(w)} /></div>
            )}
            <div className="grow"><PickRow label="Storyline" text={story?.s.name || 'Choose one'} empty={!story} action={story ? 'Change' : 'Choose'} onClick={() => setView('story')} /></div>
          </div>
          {tried && !f.storyline && <p className="hint err" role="alert">Pick a storyline.</p>}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className={`sl-chip ${f.video ? 'on' : ''}`} aria-pressed={f.video} onClick={() => set({ video: !f.video })}>Content material</button>
            <button type="button" className={`sl-chip ${f.secret ? 'on' : ''}`} aria-pressed={f.secret} onClick={() => set({ secret: !f.secret })}>Secret</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ---------- secret ----------
export function SecretForm({ ctx, id, storyline, onClose, onSaved }: { ctx: StoriesCtx; id: string | null; storyline?: string | null; onClose(): void; onSaved(id: string): void }) {
  const store = useStore();
  const [start] = useState<SecretData>(() => (id ? ctx.secrets.find((s) => s.id === id)?.sec : undefined) ?? { ...BLANK_SECRET, storyline: storyline ?? null });
  const [f, setF] = useState(start);
  const [view, setView] = useState<'form' | 'cast' | 'story'>('form');
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  const set = (p: Partial<SecretData>) => setF((x) => ({ ...x, ...p }));
  const story = f.storyline ? ctx.byId.get(f.storyline) : undefined;
  const submit = () => {
    if (!f.title.trim()) { setTried(true); return; }
    const sid = store.put('secret', { ...f, title: f.title.trim() } as unknown as Record<string, unknown>, id ?? undefined);
    toast(id ? 'Saved' : 'Secret added');
    onSaved(sid);
  };
  const title = view === 'form' ? (id ? 'Edit secret' : 'New secret') : backTitle(view === 'cast' ? 'Who is in it' : 'Storyline', () => setView('form'), view === 'story' && f.storyline ? () => { set({ storyline: null }); setView('form'); } : undefined);
  return (
    <Modal title={title} onClose={onClose} dirty={dirty} className="pinned ph-modal"
      footer={view === 'cast' ? <button type="button" className="btn primary" onClick={() => setView('form')}>{f.cast.length ? `Done · ${f.cast.length} selected` : 'Done'}</button> : view === 'story' ? undefined : (close) => (
        <>
          {id && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => { store.moveToTrash(id, 'Secret'); onClose(); }}><Trash size={16} weight="duotone" /> Delete</button>}
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn primary" onClick={submit}>{id ? 'Save' : 'Add secret'}</button>
        </>
      )}>
      {view === 'cast' ? <SimChecklist ctx={ctx} value={f.cast} onChange={(cast) => set({ cast })} /> : view === 'story' ? (
        <StoryChecklist ctx={ctx} value={f.storyline} onPick={(sid) => { set({ storyline: sid }); setView('form'); }} />
      ) : (
        <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="The secret">{(fid) => <TextInput id={fid} value={f.title} maxLength={80} placeholder="Quentin likes Shanae" autoFocus={!id} aria-invalid={tried && !f.title.trim()} onChange={(e) => set({ title: e.target.value })} />}</Field>
          {tried && !f.title.trim() && <p className="hint err" role="alert">Say what the secret is.</p>}
          <PickRow label="Who is in it" text={f.cast.length ? namesText(ctx, f.cast) : 'No one yet'} empty={!f.cast.length} action={f.cast.length ? 'Change' : 'Choose'} onClick={() => setView('cast')} />
          <PickRow label="Storyline" text={story?.s.name || 'None'} empty={!story} action={story ? 'Change' : 'Choose'} onClick={() => setView('story')} />
        </form>
      )}
    </Modal>
  );
}

// ---------- feeling ----------
export function FeelingForm({ ctx, id, onClose }: { ctx: StoriesCtx; id: string | null; onClose(): void }) {
  const store = useStore();
  const [start] = useState<FeelingData>(() => (id ? ctx.feelings.find((x) => x.id === id)?.f : undefined) ?? BLANK_FEELING);
  const [f, setF] = useState(start);
  const [view, setView] = useState<'form' | 'from' | 'to'>('form');
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  const set = (p: Partial<FeelingData>) => setF((x) => ({ ...x, ...p }));
  const bad = !f.from || !f.to || f.from === f.to;
  const submit = () => {
    if (bad) { setTried(true); return; }
    store.put('feeling', { ...f, word: f.word.trim(), why: f.why.trim() }, id ?? undefined);
    toast(id ? 'Saved' : 'Feeling added');
    onClose();
  };
  const title = view === 'form' ? (id ? 'Edit feeling' : 'Add feeling') : backTitle(view === 'from' ? 'Who feels it' : 'About who', () => setView('form'));
  return (
    <Modal title={title} onClose={onClose} dirty={dirty} className="pinned ph-modal"
      footer={view !== 'form' ? undefined : (close) => (
        <>
          {id && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => { store.moveToTrash(id, 'Feeling'); onClose(); }}><Trash size={16} weight="duotone" /> Delete</button>}
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn primary" onClick={submit}>{id ? 'Save' : 'Add feeling'}</button>
        </>
      )}>
      {view !== 'form' ? <SimChecklist ctx={ctx} single value={view === 'from' ? (f.from ? [f.from] : []) : (f.to ? [f.to] : [])} onChange={(ids) => set(view === 'from' ? { from: ids[0] } : { to: ids[0] })} onDone={() => setView('form')} /> : (
        <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <PickRow label="Who feels it" text={f.from ? ctx.nameOf(f.from) : 'Choose a Sim'} empty={!f.from} action={f.from ? 'Change' : 'Choose'} onClick={() => setView('from')} />
          <PickRow label="About" text={f.to ? ctx.nameOf(f.to) : 'Choose a Sim'} empty={!f.to} action={f.to ? 'Change' : 'Choose'} onClick={() => setView('to')} />
          {tried && bad && <p className="hint err" role="alert">{f.from && f.from === f.to ? 'Pick two different Sims.' : 'Pick both Sims.'}</p>}
          <div className="field"><span className="label">Feeling</span><Seg value={f.kind} options={FEEL_KINDS.map((k) => ({ v: k.id, label: k.label }))} onChange={(kind) => set({ kind })} label="Feeling" /></div>
          <Field label="In a word">{(fid) => <TextInput id={fid} value={f.word} maxLength={30} placeholder="Into him" onChange={(e) => set({ word: e.target.value })} />}</Field>
          <Field label="Why">{(fid) => <TextInput id={fid} value={f.why} maxLength={80} placeholder="Since the hookah bar" onChange={(e) => set({ why: e.target.value })} />}</Field>
        </form>
      )}
    </Modal>
  );
}
