import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowsOut, CaretLeft, CaretRight, Check, Crown, EyeSlash, HouseSimple, Path, PencilSimple, Plus, Star, Trash, TreeStructure, X, ArrowsIn } from '@phosphor-icons/react';
import { AutoText, Confirm, Field, Modal, SearchBox, TextInput, toast } from '../../components/ui';
import { useLayer } from '../../lib/layers';
import {
  BLANK_GEN, currentGen, finished, foldLabel, genLabel, genRows, genTitle, gensOf, legacyRows, listItems, parseGenList, progress,
  type GenData, type GenRow, type LegacyData,
} from '../../lib/legacy';
import { go, savePath } from '../../lib/router';
import { moduleOn, saveData } from '../../lib/saves';
import { castOf, secretPeople, statusLabel } from '../../lib/storylines';
import { useRecords, useStore } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { normalize, plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import { LegacyPhotos } from '../photos/PhotosPage';
import { RowPop } from '../sims/RowEdit';
import { SimAvatar } from '../sims/shared';
import { SecretForm, SimChecklist } from '../storylines/forms';
import { SecretMatrix } from '../storylines/StorylinesPage';
import { useStories, type StoriesCtx } from '../storylines/shared';

const SHOW = 5;
const href = (save: SaveRow, tail = '') => savePath(save.id, `legacy${tail}`);
const CrownIcon = ({ size = 'md' }: { size?: 'md' | 'lg' }) => <span className={`obj legacy ${size === 'lg' ? 'lg' : ''}`} aria-hidden="true"><Crown size={size === 'lg' ? 24 : 16} weight="duotone" /></span>;

/** The data every Legacy page needs. */
function useLegacy(save: SaveRow) {
  const legacyRecs = useRecords('legacy');
  const genRecs = useRecords('generation');
  const ctx = useStories(save);
  return useMemo(() => {
    const legacies = legacyRows(legacyRecs);
    const gens = genRows(genRecs);
    return { legacies, gens, ctx };
  }, [legacyRecs, genRecs, ctx]);
}
type L = ReturnType<typeof useLegacy>;

/** The Legacy section: the list, one legacy's page, one generation's page. */
export function LegacyPage({ save, rest }: { save: SaveRow; rest: string[] }) {
  const d = saveData(save);
  if (!moduleOn(d, 'legacy')) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 480 }}>
        <CrownIcon size="lg" />
        <h2 style={{ fontSize: 18, margin: 0 }}>Legacy is off for this save</h2>
        <p>Turn it on in Save settings and it shows up here.</p>
        <a className="btn primary" href={savePath(save.id, 'settings')}>Open Save settings</a>
      </div>
    );
  }
  if (rest[1]) return <GenPage key={rest[1]} save={save} legacyId={rest[0]} genId={rest[1]} />;
  if (rest[0]) return <LegacyOne key={rest[0]} save={save} id={rest[0]} />;
  return <LegacyList save={save} />;
}

// ---------- small pieces ----------
function Back({ to, label }: { to: string; label: string }) {
  return <a className="ph-back" href={to}><CaretLeft size={18} weight="bold" /> {label}</a>;
}

/** The Story: a whole block you tap. Opens a side peek on desktop (with full screen) and a full screen on phones. */
function StoryBlock({ title, value, onSave }: { title: string; value: string; onSave(v: string): void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="card lg-story" onClick={() => setOpen(true)} aria-label={`Story. ${value ? 'Open' : 'Write the story'}`}>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="lg-cap">Story</span>
          <span className={`lg-story-t ${value.trim() ? '' : 'muted'}`}>{value.trim() || 'Write the story so far…'}</span>
        </span>
        <CaretRight size={16} weight="bold" className="muted" aria-hidden="true" />
      </button>
      {open && <StoryPeek title={title} value={value} onSave={onSave} onClose={() => setOpen(false)} />}
    </>
  );
}

function StoryPeek({ title, value, onSave, onClose }: { title: string; value: string; onSave(v: string): void; onClose(): void }) {
  const phone = useIsPhone();
  const [full, setFull] = useState(false);
  useLayer(onClose);
  return createPortal(
    <div className="lg-peek-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className={`lg-peek ${full || phone ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={`${title} story`}>
        <div className="lg-peek-head">
          <h2 className="grow">{title}</h2>
          {!phone && <button type="button" className="btn ghost icon sm" aria-label={full ? 'Back to side panel' : 'Full screen'} onClick={() => setFull((f) => !f)}>{full ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}</button>}
          <button type="button" className="btn ghost icon sm" aria-label="Close" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <AutoText value={value} onSave={onSave} placeholder="Write the story so far. It saves as you type." label="Story" rows={full || phone ? 22 : 18} />
      </aside>
    </div>,
    document.body,
  );
}

function HouseChecklist({ ctx, value, onChange }: { ctx: StoriesCtx; value: string[]; onChange(v: string[]): void }) {
  const [q, setQ] = useState('');
  const all = ctx.hh.list.map((r) => ({ id: r.id, label: ctx.hh.nameOf(r.id) || 'Unnamed household' }));
  const shown = all.filter((o) => !q.trim() || normalize(o.label).includes(normalize(q)));
  return (
    <div className="ph-pk">
      <div className="ph-pk-search"><SearchBox value={q} onChange={setQ} placeholder={`Search ${all.length} households`} /></div>
      <div className="ph-pk-list">
        {shown.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} type="button" role="checkbox" aria-checked={on} aria-label={o.label} className="ph-pk-sim" onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>
              <span className={`ph-cb ${on ? 'on' : ''}`} aria-hidden="true" /><span className="obj households sm"><HouseSimple size={14} weight="duotone" /></span><span className="ph-pk-t">{o.label}</span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="muted ph-pk-none">{all.length ? `No household called “${q.trim()}”.` : 'Add some households first.'}</p>}
      </div>
    </div>
  );
}

/** "14 households": one row that opens a searchable list. */
function HouseholdsRow({ ctx, value, onChange }: { ctx: StoriesCtx; value: string[]; onChange(v: string[]): void }) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const names = value.map((id) => ctx.hh.nameOf(id)).filter(Boolean);
  const sub = names.length > 2 ? `${names.slice(0, 2).join(', ')}, +${names.length - 2} more` : names.join(', ');
  return (
    <>
      <button ref={ref} type="button" className="lg-hh" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="lg-hhs">{(value.length ? value.slice(0, 3) : [null]).map((id, i) => <span key={id ?? i} className="obj households sm"><HouseSimple size={14} weight="duotone" /></span>)}</span>
        <b>{value.length ? plural(value.length, 'household') : 'Add households'}</b>
        {sub && <span className="muted lg-hh-sub">{sub}</span>}
        <CaretRight size={14} weight="bold" className="muted" style={{ marginLeft: 'auto' }} aria-hidden="true" />
      </button>
      {open && <RowPop anchor={ref.current} title={value.length ? `Households · ${value.length}` : 'Households'} phone={phone} onClose={() => setOpen(false)} width={380}><HouseChecklist ctx={ctx} value={value} onChange={onChange} /></RowPop>}
    </>
  );
}

const Prog = ({ g }: { g: GenData }) => {
  const p = progress(g);
  return p.total ? <span className="lg-prog"><small>{p.done}/{p.total}</small><span className="lg-bar"><i style={{ width: `${(p.done / p.total) * 100}%` }} /></span></span> : <span className="muted small">No goals</span>;
};

function GenRowLink({ save, legacyId, row, ctx, current }: { save: SaveRow; legacyId: string; row: GenRow; ctx: StoriesCtx; current?: boolean }) {
  const g = row.g;
  const heir = g.heir ? ctx.sims.get(g.heir) : null;
  return (
    <a className={`lg-gen ${current ? 'cur' : ''}`} href={href(save, `/${legacyId}/${row.id}`)}>
      <span className="lg-n">{g.n}</span>
      <span className="lg-gt">{current && <small className="lg-curtag">Current generation</small>}<b>{g.title.trim() || `Generation ${g.n}`}</b>{!current && finished(g) && <small className="muted">Done</small>}</span>
      <span className="lg-heir">{heir ? <><SimAvatar sim={heir} size={28} /><span className="lg-heir-t"><span>{ctx.nameOf(g.heir!)}</span><small className="muted">Heir</small></span></> : <span className="muted small">No heir yet</span>}</span>
      <Prog g={g} />
    </a>
  );
}

// ---------- list ----------
function LegacyList({ save }: { save: SaveRow }) {
  const L = useLegacy(save);
  const phone = useIsPhone();
  const [adding, setAdding] = useState(false);
  const btn = <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New legacy</button>;
  const rows = L.legacies.map((r) => {
    const gens = gensOf(L.gens, r.id);
    const cur = currentGen(r.l, gens);
    return (
      <a key={r.id} className="lg-lrow" href={href(save, `/${r.id}`)}>
        <CrownIcon />
        <span className="lg-gt"><b>{r.l.name || 'Unnamed legacy'}</b><small className="muted">{gens.length ? `${plural(gens.length, 'generation')}${cur ? ` · now Gen ${cur.g.n}` : ''}` : 'No generations yet'}</small></span>
        <CaretRight size={16} weight="bold" className="muted" aria-hidden="true" />
      </a>
    );
  });
  const body = L.legacies.length ? <div className="lg-list">{rows}</div> : (
    <div className="empty" style={{ margin: '24px auto', maxWidth: 460 }}>
      <CrownIcon size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>No legacy yet</h2>
      <p>A legacy is one family line, generation by generation. Paste your generation list and you’re set.</p>
    </div>
  );
  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 18 }}>
      {phone ? <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><h1 className="m-h1" style={{ paddingTop: 6 }}>Legacy</h1>{btn}</div> : (
        <div className="page-head"><div className="row" style={{ gap: 14, alignItems: 'flex-start' }}><CrownIcon size="lg" /><div><h1>Legacy</h1><div className="sub">{L.legacies.length ? plural(L.legacies.length, 'legacy', 'legacies') : 'Generations, heirs and goals'}</div></div></div>{btn}</div>
      )}
      {body}
      {adding && <NewLegacy L={L} onClose={() => setAdding(false)} onMade={(id) => { setAdding(false); go(href(save, `/${id}`)); }} />}
    </div>
  );
}

/** New legacy: a name, an optional pasted generation list, optional households. */
function NewLegacy({ L, onClose, onMade }: { L: L; onClose(): void; onMade(id: string): void }) {
  const store = useStore();
  const [name, setName] = useState('');
  const [list, setList] = useState('');
  const [hhs, setHhs] = useState<string[]>([]);
  const [view, setView] = useState<'form' | 'hh'>('form');
  const titles = parseGenList(list);
  const make = () => {
    const n = name.trim();
    if (!n) return;
    const id = store.put('legacy', { name: n, story: '', households: hhs, rules: [], current: '' } as unknown as Record<string, unknown>);
    titles.forEach((t, i) => store.put('generation', { ...BLANK_GEN, legacy: id, n: i + 1, title: t } as unknown as Record<string, unknown>));
    onMade(id);
  };
  return (
    <Modal title={view === 'form' ? 'New legacy' : <span className="ph-ft"><button type="button" className="ph-ft-back" aria-label="Back" onClick={() => setView('form')}><CaretLeft size={22} weight="bold" /></button><span>Households</span></span>}
      onClose={onClose} dirty={!!(name.trim() || list.trim() || hhs.length)} className="pinned"
      footer={view === 'hh' ? <button type="button" className="btn primary" onClick={() => setView('form')}>{hhs.length ? `Done · ${hhs.length} selected` : 'Done'}</button> : (close) => (
        <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!name.trim()} onClick={make}>Add legacy</button></>
      )}>
      {view === 'hh' && <HouseChecklist ctx={L.ctx} value={hhs} onChange={setHhs} />}
      <form className="stack" style={{ gap: 16, display: view === 'form' ? undefined : 'none' }} onSubmit={(e) => { e.preventDefault(); make(); }}>
        <Field label="Name">{(id) => <TextInput id={id} value={name} maxLength={80} placeholder="Reed Legacy" onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Generations, one per line" hint="Optional. Type or paste the whole list. You can add more later.">{(id) => (
          <textarea id={id} className="textarea" rows={6} value={list} placeholder={'Pearl · White\nRuby · Red\nJade · Green'} onChange={(e) => setList(e.target.value)} />
        )}</Field>
        {titles.length > 0 && <p className="muted small" style={{ margin: '-8px 0 0' }}>{plural(titles.length, 'generation')}</p>}
        <div className="field">
          <span className="label">Households (optional)</span>
          <button type="button" className="ph-fld" onClick={() => setView('hh')}><span className={hhs.length ? '' : 'ph-fld-empty'}>{hhs.length ? plural(hhs.length, 'household') : 'Pick households'}</span><small>{hhs.length ? 'Change' : 'Pick'}</small></button>
        </div>
      </form>
    </Modal>
  );
}

function AddGens({ legacyId, gens, onClose }: { legacyId: string; gens: GenRow[]; onClose(): void }) {
  const store = useStore();
  const [list, setList] = useState('');
  const titles = parseGenList(list);
  const start = Math.max(0, ...gens.map((g) => g.g.n)) + 1;
  const add = () => {
    if (!titles.length) return;
    titles.forEach((t, i) => store.put('generation', { ...BLANK_GEN, legacy: legacyId, n: start + i, title: t } as unknown as Record<string, unknown>));
    toast(titles.length === 1 ? 'Generation added' : `${titles.length} generations added`);
    onClose();
  };
  return (
    <Modal title="Add generations" onClose={onClose} dirty={!!list.trim()} className="pinned"
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!titles.length} onClick={add}>{titles.length > 1 ? `Add ${titles.length} generations` : 'Add generation'}</button></>}>
      <Field label="One per line" hint={`They start at Gen ${start}. Paste a whole list if you have one.`}>{(id) => <textarea id={id} className="textarea" rows={6} value={list} placeholder="Onyx · Black" onChange={(e) => setList(e.target.value)} />}</Field>
    </Modal>
  );
}

// ---------- one legacy ----------
function LegacyOne({ save, id }: { save: SaveRow; id: string }) {
  const L = useLegacy(save);
  const store = useStore();
  const phone = useIsPhone();
  const [modal, setModal] = useState<null | 'add' | 'edit'>(null);
  const [del, setDel] = useState(false);
  const [foldOpen, setFoldOpen] = useState(false);
  const row = L.legacies.find((r) => r.id === id);
  if (!row) return <div className="page"><p>That legacy isn’t here anymore.</p><a className="btn" href={href(save)}>Back to Legacy</a></div>;
  const l = row.l;
  const put = (patch: Partial<LegacyData>) => store.put('legacy', { ...l, ...patch } as unknown as Record<string, unknown>, id);
  const gens = gensOf(L.gens, id);
  const cur = currentGen(l, gens);
  const items = listItems(gens, cur);
  const simCount = new Set(gens.flatMap((g) => [g.g.heir, ...g.g.spares].filter(Boolean) as string[])).size;
  const sub = [gens.length ? `${cur ? `Generation ${cur.g.n} · ` : ''}${plural(gens.length, 'generation')}` : 'No generations yet', simCount ? plural(simCount, 'Sim') : ''].filter(Boolean).join(' · ');
  const addBtn = <button type="button" className="btn primary" onClick={() => setModal('add')}><Plus size={16} weight="bold" /> Add generation</button>;
  const head = (
    <div className="page-head">
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}><CrownIcon size="lg" /><div><h1 style={phone ? { fontSize: 24 } : undefined}>{l.name || 'Unnamed legacy'}</h1><div className="sub">{sub}</div></div></div>
      <div className="row" style={{ gap: 8 }}>
        <span className="btn lg-soon" aria-disabled="true"><TreeStructure size={16} weight="duotone" /> Family tree <span className="lg-pill">Coming soon</span></span>
        <button type="button" className="btn icon" aria-label="Edit legacy" onClick={() => setModal('edit')}><PencilSimple size={18} /></button>
        {!phone && addBtn}
      </div>
    </div>
  );
  const genList = (
    <section className="stack" style={{ gap: 10 }}>
      {cur && <GenRowLink save={save} legacyId={id} row={cur} ctx={L.ctx} current />}
      {items.map((it) => it.kind === 'gen' ? <GenRowLink key={it.row.id} save={save} legacyId={id} row={it.row} ctx={L.ctx} /> : (
        <div key="fold" className="stack" style={{ gap: 10 }}>
          <button type="button" className="lg-gen fold" aria-expanded={foldOpen} onClick={() => setFoldOpen((o) => !o)}>
            <span className="lg-n"><Crown size={20} weight="duotone" color="var(--accent)" /></span>
            <span className="lg-gt"><b>{foldLabel(it.rows)}</b><small className="muted">{plural(it.rows.length, 'generation')}, all goals ticked</small></span>
            <CaretRight size={14} weight="bold" className="muted" style={{ marginLeft: 'auto', transform: foldOpen ? 'rotate(90deg)' : undefined }} aria-hidden="true" />
          </button>
          {foldOpen && it.rows.map((r) => <GenRowLink key={r.id} save={save} legacyId={id} row={r} ctx={L.ctx} />)}
        </div>
      ))}
      {gens.length === 0 && <p className="muted" style={{ margin: 0 }}>No generations yet. Add the founder to start.</p>}
      <button type="button" className="dash-btn" onClick={() => setModal('add')}><Plus size={16} weight="bold" /> Add generation</button>
    </section>
  );
  const side = (
    <div className="stack" style={{ gap: 14 }}>
      <RulesCard rules={l.rules} onChange={(rules) => put({ rules })} />
      <LegacyPhotos save={save} legacyId={id} />
    </div>
  );
  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 14 }}>
      <Back to={href(save)} label="Legacy" />
      {head}
      <StoryBlock title={l.name || 'Legacy'} value={l.story} onSave={(story) => put({ story })} />
      <HouseholdsRow ctx={L.ctx} value={l.households.filter((h) => L.ctx.hh.byId.has(h))} onChange={(households) => put({ households })} />
      {phone ? <div className="stack" style={{ gap: 14 }}>{genList}{side}</div> : <div className="lg-two">{genList}{side}</div>}
      {modal === 'add' && <AddGens legacyId={id} gens={gens} onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditLegacy name={l.name} onClose={() => setModal(null)} onSave={(name) => { put({ name }); setModal(null); }} onDelete={() => { setModal(null); setDel(true); }} />}
      {del && (
        <Confirm title="Delete this legacy?" text="Its generations go to Trash with it for 7 days. Photos stay in Photos." onCancel={() => setDel(false)}
          actions={[{ label: 'Keep it', run: () => setDel(false) }, { label: 'Delete', kind: 'danger', run: () => { setDel(false); store.moveManyToTrash([id, ...gens.map((g) => g.id)], l.name || 'Legacy'); go(href(save)); } }]} />
      )}
    </div>
  );
}

function EditLegacy({ name, onClose, onSave, onDelete }: { name: string; onClose(): void; onSave(n: string): void; onDelete(): void }) {
  const [n, setN] = useState(name);
  return (
    <Modal title="Edit legacy" onClose={onClose} dirty={n !== name} className="pinned"
      footer={(close) => <><button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={onDelete}><Trash size={16} weight="duotone" /> Delete</button><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!n.trim()} onClick={() => onSave(n.trim())}>Save</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (n.trim()) onSave(n.trim()); }}><Field label="Name">{(id) => <TextInput id={id} value={n} maxLength={80} onChange={(e) => setN(e.target.value)} />}</Field></form>
    </Modal>
  );
}

function RulesCard({ rules, onChange }: { rules: string[]; onChange(r: string[]): void }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim(); if (!v) return; onChange([...rules, v]); setT(''); };
  return (
    <section className="card sl-card">
      <div className="card-head"><h2>Rules{rules.length > 0 && <span className="cnt">{rules.length}</span>}</h2></div>
      {rules.map((r, i) => (
        <div key={i} className="lg-line"><span className="grow">{r}</span><button type="button" className="club-x" aria-label={`Remove ${r}`} onClick={() => onChange(rules.filter((_, j) => j !== i))}><X size={16} weight="bold" /></button></div>
      ))}
      <form className="sl-qadd" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input" value={t} maxLength={140} aria-label="Add a rule" placeholder="No money cheats" onChange={(e) => setT(e.target.value)} />
        <button type="submit" className="btn sm" disabled={!t.trim()}>Add</button>
      </form>
    </section>
  );
}

// ---------- one generation ----------
function GenPage({ save, legacyId, genId }: { save: SaveRow; legacyId: string; genId: string }) {
  const L = useLegacy(save);
  const store = useStore();
  const phone = useIsPhone();
  const [pick, setPick] = useState(false);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [adding, setAdding] = useState(false);
  const [gText, setGText] = useState('');
  const [gOpt, setGOpt] = useState(false);
  const [secretId, setSecretId] = useState<string | null>(null);
  const [editSecret, setEditSecret] = useState<string | null>(null);
  const [allStories, setAllStories] = useState(false);
  const lrow = L.legacies.find((r) => r.id === legacyId);
  const row = L.gens.find((r) => r.id === genId && r.g.legacy === legacyId);
  if (!lrow || !row) return <div className="page"><p>That generation isn’t here anymore.</p><a className="btn" href={href(save, lrow ? `/${legacyId}` : '')}>Back</a></div>;
  const g = row.g;
  const l = lrow.l;
  const ctx = L.ctx;
  const put = (patch: Partial<GenData>) => store.put('generation', { ...g, ...patch } as unknown as Record<string, unknown>, genId);
  const cur = currentGen(l, gensOf(L.gens, legacyId));
  const isCur = cur?.id === genId;
  const p = progress(g);
  const hhOf = (sim: string) => ctx.hh.nameOf(ctx.householdOf(sim)) || 'No household';
  const people = [g.heir, ...g.spares].filter(Boolean) as string[];
  const storiesOn = moduleOn(saveData(save), 'storylines');
  const myStories = storiesOn ? ctx.stories.filter((s) => castOf(s.s, ctx.beats, s.id).some((x) => people.includes(x))) : [];
  const mySecrets = storiesOn ? ctx.secrets.filter((s) => !s.sec.out && secretPeople(s.sec).some((x) => people.includes(x))) : [];
  const addGoal = () => { const t = gText.trim(); if (!t) return; put({ goals: [...g.goals, { text: t, done: false, optional: gOpt }] }); setGText(''); setGOpt(false); };
  const setHeir = (id: string) => put({ heir: id, spares: [...(g.heir && g.heir !== id ? [g.heir] : []), ...g.spares.filter((x) => x !== id)] });
  const addSim = (id: string) => { if (id === g.heir || g.spares.includes(id)) return; if (!g.heir) put({ heir: id }); else put({ spares: [...g.spares, id] }); };
  const removeSim = (id: string) => put(g.heir === id ? { heir: null } : { spares: g.spares.filter((x) => x !== id) });
  const iconBtn = (label: string, onClick: () => void) => <button type="button" className="btn icon lg-add" aria-label={label} onClick={onClick}><Plus size={18} weight="bold" /></button>;

  const goals = (
    <section className="card sl-card">
      <div className="card-head"><h2>Goals{g.goals.length > 0 && <span className="cnt">{p.done} of {p.total}</span>}</h2>{iconBtn('Add goal', () => setAdding((a) => !a))}</div>
      {g.goals.map((x, i) => (
        <div key={i} className="lg-goal">
          <button type="button" className="lg-goalb" role="checkbox" aria-checked={x.done} aria-label={x.text} onClick={() => put({ goals: g.goals.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })}>
            <span className={`ph-cb ${x.done ? 'on' : ''}`} aria-hidden="true" /><span className={`grow ${x.done ? 'lg-done' : ''}`}>{x.text}</span>{x.optional && <span className="lg-pill">Optional</span>}
          </button>
          <button type="button" className="club-x" aria-label={`Remove ${x.text}`} onClick={() => put({ goals: g.goals.filter((_, j) => j !== i) })}><X size={16} weight="bold" /></button>
        </div>
      ))}
      {g.goals.length === 0 && !adding && <p className="muted small" style={{ margin: 0 }}>No goals yet. Add what this generation has to do.</p>}
      {adding && (
        <form className="lg-goaladd" onSubmit={(e) => { e.preventDefault(); addGoal(); }}>
          <input className="input" autoFocus value={gText} maxLength={140} aria-label="New goal" placeholder="Reach Level 10 Cooking" onChange={(e) => setGText(e.target.value)} />
          <button type="button" className={`btn sm ${gOpt ? 'lg-on' : ''}`} aria-pressed={gOpt} onClick={() => setGOpt((o) => !o)}>Optional</button>
          <button type="submit" className="btn sm" disabled={!gText.trim()}>Add</button>
        </form>
      )}
    </section>
  );
  const heirs = (
    <section className="card sl-card">
      <div className="card-head"><h2>Heir and spares</h2>{iconBtn('Add Sim', () => setPick(true))}</div>
      {people.map((id) => {
        const sim = ctx.sims.get(id);
        const isHeir = id === g.heir;
        return (
          <div key={id} className="lg-sim">
            <a className="lg-sim-main" href={savePath(save.id, `sims/${id}`)}>{sim && <SimAvatar sim={sim} size={36} />}<span className="grow" style={{ minWidth: 0 }}><b>{ctx.nameOf(id)}</b><small className="muted">{hhOf(id)}</small></span></a>
            {isHeir ? <span className="lg-role">Heir</span> : <button type="button" className="btn sm" onClick={() => setHeir(id)}><Star size={14} weight="duotone" /> Make heir</button>}
            <button type="button" className="club-x" aria-label={`Remove ${ctx.nameOf(id)}`} onClick={() => removeSim(id)}><X size={16} weight="bold" /></button>
          </div>
        );
      })}
      {people.length === 0 && <p className="muted small" style={{ margin: 0 }}>No heir yet. The first Sim you add is the heir.</p>}
    </section>
  );
  const details = (
    <section className="card sl-card">
      <div className="card-head"><h2>Details</h2><button type="button" className="btn sm" onClick={() => setEdit(true)}><PencilSimple size={15} weight="bold" /> Edit</button></div>
      <dl className="lg-dl">
        <dt>Traits</dt><dd>{g.traits.length ? <span className="lg-chips">{g.traits.map((t) => <span key={t} className="tag outline-soft">{t}</span>)}</span> : <span className="muted">–</span>}</dd>
        <dt>Aspiration</dt><dd>{g.aspiration || <span className="muted">–</span>}</dd>
        <dt>Career</dt><dd>{g.career || <span className="muted">–</span>}</dd>
        <dt>Skills</dt><dd>{g.skills || <span className="muted">–</span>}</dd>
      </dl>
    </section>
  );
  const stories = storiesOn && (myStories.length > 0 || mySecrets.length > 0) && (
    <section className="card sl-card">
      <div className="card-head"><h2>Storylines{myStories.length + mySecrets.length > 0 && <span className="cnt">{myStories.length + mySecrets.length}</span>}</h2></div>
      <div className="stack" style={{ gap: 2 }}>
        {(allStories ? myStories : myStories.slice(0, SHOW)).map((s) => <a key={s.id} className="lg-link" href={savePath(save.id, `storylines/${s.id}`)}><Path size={16} weight="duotone" /><span className="grow">{s.s.name || 'Unnamed storyline'}</span><small className="muted">{statusLabel(s.s.status)}</small></a>)}
        {(allStories ? mySecrets : mySecrets.slice(0, SHOW)).map((s) => <button key={s.id} type="button" className="lg-link" onClick={() => setSecretId(s.id)}><EyeSlash size={16} weight="duotone" /><span className="grow">{s.sec.title || 'Untitled secret'}</span><small className="muted">Secret</small></button>)}
        {!allStories && (myStories.length > SHOW || mySecrets.length > SHOW) && <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAllStories(true)}>Show all {myStories.length + mySecrets.length}</button>}
      </div>
    </section>
  );
  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 14 }}>
      <Back to={href(save, `/${legacyId}`)} label={l.name || 'Legacy'} />
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}><span className="obj lg legacy" aria-hidden="true"><b style={{ fontSize: 22 }}>{g.n}</b></span><div><h1 style={phone ? { fontSize: 24 } : undefined}>{genTitle(g)}</h1><div className="sub">{isCur ? 'Current generation' : finished(g) ? 'Done' : genLabel(g)}</div></div></div>
        <div className="row" style={{ gap: 8 }}>
          {!isCur && <button type="button" className="btn" onClick={() => { store.put('legacy', { ...l, current: genId } as unknown as Record<string, unknown>, legacyId); toast(`Gen ${g.n} is now the current generation`); }}><Check size={16} weight="bold" /> Make current</button>}
          <button type="button" className="btn icon" aria-label="Edit generation" onClick={() => setEdit(true)}><PencilSimple size={18} /></button>
        </div>
      </div>
      <StoryBlock title={`${genLabel(g)} · ${genTitle(g)}`} value={g.story} onSave={(story) => put({ story })} />
      {phone ? <div className="stack" style={{ gap: 14 }}>{goals}{heirs}{stories}{details}<LegacyPhotos save={save} legacyId={legacyId} genId={genId} /></div> : (
        <div className="lg-two"><div className="stack" style={{ gap: 14 }}>{goals}{stories}<LegacyPhotos save={save} legacyId={legacyId} genId={genId} /></div><div className="stack" style={{ gap: 14 }}>{heirs}{details}</div></div>
      )}
      {secretId && ctx.secrets.find((x) => x.id === secretId) && !editSecret && (
        <Modal title="Secret" onClose={() => setSecretId(null)} className="pinned" footer={<a className="btn" href={savePath(save.id, 'storylines/secrets')}>See all secrets</a>}>
          <SecretMatrix saveId={save.id} ctx={ctx} row={ctx.secrets.find((x) => x.id === secretId)!} onEdit={() => setEditSecret(secretId)} />
        </Modal>
      )}
      {editSecret && <SecretForm ctx={ctx} id={editSecret} onClose={() => setEditSecret(null)} onSaved={() => setEditSecret(null)} />}
      {pick && (
        <Modal title="Add a Sim" onClose={() => setPick(false)} className="pinned" footer={<button type="button" className="btn primary" onClick={() => setPick(false)}>Done</button>}>
          <SimChecklist ctx={ctx} value={people} onChange={(v) => { const next = v.find((x) => !people.includes(x)); if (next) addSim(next); else { const gone = people.find((x) => !v.includes(x)); if (gone) removeSim(gone); } }} />
        </Modal>
      )}
      {edit && <EditGen g={g} onClose={() => setEdit(false)} onSave={(patch) => { put(patch); setEdit(false); }} onDelete={() => { setEdit(false); setDel(true); }} />}
      {del && (
        <Confirm title="Delete this generation?" text="It goes to Trash for 7 days." onCancel={() => setDel(false)}
          actions={[{ label: 'Keep it', run: () => setDel(false) }, { label: 'Delete', kind: 'danger', run: () => { setDel(false); store.moveToTrash(genId, genTitle(g)); go(href(save, `/${legacyId}`)); } }]} />
      )}
    </div>
  );
}

function EditGen({ g, onClose, onSave, onDelete }: { g: GenData; onClose(): void; onSave(p: Partial<GenData>): void; onDelete(): void }) {
  const [f, setF] = useState({ title: g.title, traits: g.traits.join(', '), aspiration: g.aspiration, career: g.career, skills: g.skills });
  const dirty = f.title !== g.title || f.traits !== g.traits.join(', ') || f.aspiration !== g.aspiration || f.career !== g.career || f.skills !== g.skills;
  const save = () => onSave({ title: f.title.trim(), traits: f.traits.split(',').map((t) => t.trim()).filter(Boolean), aspiration: f.aspiration.trim(), career: f.career.trim(), skills: f.skills.trim() });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Edit generation" onClose={onClose} dirty={dirty} className="pinned"
      footer={(close) => <><button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={onDelete}><Trash size={16} weight="duotone" /> Delete</button><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={save}>Save</button></>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name">{(id) => <TextInput id={id} value={f.title} maxLength={80} placeholder="Jade · Green" onChange={set('title')} />}</Field>
        <Field label="Traits" hint="Separate with commas.">{(id) => <TextInput id={id} value={f.traits} placeholder="Ambitious, Geek, Loyal" onChange={set('traits')} />}</Field>
        <Field label="Aspiration">{(id) => <TextInput id={id} value={f.aspiration} onChange={set('aspiration')} />}</Field>
        <Field label="Career">{(id) => <TextInput id={id} value={f.career} onChange={set('career')} />}</Field>
        <Field label="Skills">{(id) => <TextInput id={id} value={f.skills} placeholder="Level 8 Programming" onChange={set('skills')} />}</Field>
      </form>
    </Modal>
  );
}
