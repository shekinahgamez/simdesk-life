import { useMemo, useRef, useState, type ReactNode } from 'react';
import { CaretDown, CaretLeft, CaretRight, Check, DownloadSimple, EyeSlash, Flame, HouseSimple, Kanban, MagnifyingGlass, Path, PencilSimple, Plus, PushPin, Question, Rows, SquaresFour, VideoCamera, X } from '@phosphor-icons/react';
import { Confirm, SearchBox, Seg, toast, AutoText } from '../../components/ui';
import { ObjIcon } from '../../components/categories';
import {
  castOf, FEEL_KINDS, feelLabel, filterActive, filterCount, filterStories, knowOf, knowsSummary, KNOWS, latestBeat, NO_FILTER, secretPeople, sortBeats, sortStories,
  statusLabel, STATUSES, storyMarkdown, tagChoices, type BeatRow, type FeelKind, type Know, type SecretRow, type Status, type StoryFilter, type StoryRow,
} from '../../lib/storylines';
import { go, savePath } from '../../lib/router';
import { dateOf } from '../../lib/time';
import { saveData } from '../../lib/saves';
import { useStore } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { normalize, plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import { Faces } from '../households/shared';
import { StoryPhotos } from '../photos/PhotosPage';
import { RowPop } from '../sims/RowEdit';
import { SimAvatar } from '../sims/shared';
import { BeatForm, FeelingForm, SecretForm, SimChecklist, StoryForm } from './forms';
import { realDay, useStories, type StoriesCtx } from './shared';

type Tab = 'storylines' | 'secrets' | 'feelings' | 'video';
const TABS: { id: Tab; label: string; path: string; icon: typeof Flame }[] = [
  { id: 'storylines', label: 'Storylines', path: '', icon: Path },
  { id: 'secrets', label: 'Secrets', path: '/secrets', icon: EyeSlash },
  { id: 'feelings', label: 'Feelings', path: '/feelings', icon: Flame },
  { id: 'video', label: 'Content', path: '/video', icon: VideoCamera },
];

const href = (save: SaveRow, tail = '') => savePath(save.id, `storylines${tail}`);
const storyHref = (save: SaveRow, id: string) => href(save, `/${id}`);

export function storylinesOn(d: { modules: Record<string, boolean> }) { return !!d.modules.storylines; }

/** The Storylines section: the four tabs, and one storyline's page. */
export function StorylinesPage({ save, rest }: { save: SaveRow; rest: string[] }) {
  const d = saveData(save);
  if (!storylinesOn(d)) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 480 }}>
        <ObjIcon cat="storylines" size="lg" />
        <h2 style={{ fontSize: 18, margin: 0 }}>Storylines is off for this save</h2>
        <p>Turn it on in Save settings and it shows up here.</p>
        <a className="btn primary" href={savePath(save.id, 'settings')}>Open Save settings</a>
      </div>
    );
  }
  const key = rest[0];
  if (key && key !== 'secrets' && key !== 'feelings' && key !== 'video') return <StoryPage key={key} save={save} id={key} />;
  return <Hub save={save} tab={(key as Tab) || 'storylines'} />;
}

// ---------- pieces ----------
const StatusTag = ({ s }: { s: Status }) => <span className={`tag sl-st ${s}`}>{statusLabel(s)}</span>;

function FilterBtn({ label, count, title, phone, children }: { label: string; count: number; title: string; phone: boolean; children(close: () => void): ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} type="button" className={`btn sm sl-fb ${count ? 'on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}{count > 0 && ` · ${count}`}<CaretDown size={12} weight="bold" aria-hidden="true" />
      </button>
      {open && <RowPop anchor={ref.current} title={title} phone={phone} onClose={() => setOpen(false)} width={340}>{children(() => setOpen(false))}</RowPop>}
    </>
  );
}

/** A checklist with optional search and a count per row. */
function CheckList({ options, value, onChange, search, icon }: { options: { id: string; label: string; n?: number }[]; value: string[]; onChange(v: string[]): void; search?: boolean; icon?: ReactNode }) {
  const [q, setQ] = useState('');
  const shown = options.filter((o) => !q.trim() || normalize(o.label).includes(normalize(q)));
  return (
    <div className="ph-pk">
      {search && <div className="ph-pk-search"><SearchBox value={q} onChange={setQ} placeholder={`Search ${options.length}`} /></div>}
      <div className="ph-pk-list">
        {shown.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} type="button" role="checkbox" aria-checked={on} aria-label={o.label} className="ph-pk-sim" onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>
              <span className={`ph-cb ${on ? 'on' : ''}`} aria-hidden="true" />{icon}<span className="ph-pk-t">{o.label}</span>{o.n != null && <span className="sl-n">{o.n}</span>}
            </button>
          );
        })}
        {shown.length === 0 && <p className="muted ph-pk-none">{options.length ? `No match for “${q.trim()}”.` : 'Nothing to pick yet.'}</p>}
      </div>
    </div>
  );
}

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const fileName = (n: string) => `${(n || 'Storyline').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Storyline'}.md`;

// ---------- hub with tabs ----------
function Hub({ save, tab }: { save: SaveRow; tab: Tab }) {
  const ctx = useStories(save);
  const phone = useIsPhone();
  const [adding, setAdding] = useState<null | 'story' | 'beat' | 'secret' | 'feeling'>(null);
  const open = ctx.stories.filter((s) => s.s.status !== 'resolved').length;
  const sub = tab === 'storylines' ? (ctx.stories.length ? `${plural(ctx.stories.length, 'storyline')} · ${open} open` : 'Threads that link your Sims')
    : tab === 'secrets' ? `${ctx.secrets.filter((s) => !s.sec.out).length} open · ${ctx.secrets.filter((s) => s.sec.out).length} out in the open`
    : tab === 'feelings' ? 'Who feels what about who' : 'Beats you marked as content material';
  const primary: Record<Tab, [string, 'story' | 'beat' | 'secret' | 'feeling']> = { storylines: ['New storyline', 'story'], secrets: ['New secret', 'secret'], feelings: ['Add feeling', 'feeling'], video: ['Add beat', 'beat'] };
  const [pl, pk] = primary[tab];
  const btn = <button type="button" className="btn primary" onClick={() => setAdding(pk)}><Plus size={16} weight="bold" /> {pl}</button>;
  const tabs = (
    <nav className="sl-tabs" aria-label="Storylines sections">
      {TABS.map((t) => {
        const I = t.icon;
        return <a key={t.id} href={href(save, t.path)} aria-label={t.label} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined}><I size={16} weight="duotone" aria-hidden="true" /><span>{t.label}</span></a>;
      })}
    </nav>
  );
  const body = tab === 'storylines' ? <StoriesTab save={save} ctx={ctx} phone={phone} onNew={() => setAdding('story')} />
    : tab === 'secrets' ? <SecretsTab save={save} ctx={ctx} phone={phone} onNew={() => setAdding('secret')} />
    : tab === 'feelings' ? <FeelingsTab ctx={ctx} phone={phone} onNew={() => setAdding('feeling')} />
    : <VideoTab save={save} ctx={ctx} onNew={() => setAdding('beat')} />;
  const forms = (
    <>
      {adding === 'story' && <StoryForm ctx={ctx} id={null} onClose={() => setAdding(null)} onSaved={(id) => { setAdding(null); go(storyHref(save, id)); }} />}
      {adding === 'beat' && <BeatForm ctx={ctx} id={null} onClose={() => setAdding(null)} />}
      {adding === 'secret' && <SecretForm ctx={ctx} id={null} onClose={() => setAdding(null)} onSaved={() => setAdding(null)} />}
      {adding === 'feeling' && <FeelingForm ctx={ctx} id={null} onClose={() => setAdding(null)} />}
    </>
  );
  if (phone) {
    return (
      <div className="m-stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><h1 className="m-h1" style={{ paddingTop: 6 }}>Storylines</h1>{btn}</div>
        {tabs}{body}{forms}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}><ObjIcon cat="storylines" size="lg" /><div><h1>Storylines</h1><div className="sub">{sub}</div></div></div>
        {btn}
      </div>
      {tabs}{body}{forms}
    </div>
  );
}

// ---------- storylines tab ----------
type View = 'list' | 'cards' | 'board';
const VIEW_KEY = 'sd:slView';
const readView = (): View => { try { const v = localStorage.getItem(VIEW_KEY); return v === 'cards' || v === 'board' ? v : 'list'; } catch { return 'list'; } };

function StoriesTab({ save, ctx, phone, onNew }: { save: SaveRow; ctx: StoriesCtx; phone: boolean; onNew(): void }) {
  const store = useStore();
  const [view, setViewState] = useState<View>(readView);
  const eff: View = phone && view === 'board' ? 'list' : view;
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };
  const [f, setF] = useState<StoryFilter>(NO_FILTER);
  const [more, setMore] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const opts = useMemo(() => ({ householdOf: ctx.householdOf, simName: ctx.nameOf }), [ctx]);
  const rows = useMemo(() => sortStories(filterStories(ctx.stories, ctx.beats, f, opts), ctx.beats), [ctx, f, opts]);
  const simCounts = useMemo(() => { const m = new Map<string, number>(); for (const r of ctx.stories) for (const id of castOf(r.s, ctx.beats, r.id)) m.set(id, (m.get(id) ?? 0) + 1); return m; }, [ctx]);
  const hhCounts = useMemo(() => { const m = new Map<string, number>(); for (const r of ctx.stories) { const hs = new Set(castOf(r.s, ctx.beats, r.id).map(ctx.householdOf).filter(Boolean) as string[]); for (const h of hs) m.set(h, (m.get(h) ?? 0) + 1); } return m; }, [ctx]);
  const tags = useMemo(() => tagChoices(ctx.stories), [ctx.stories]);
  const active = filterActive(f);
  const set = (p: Partial<StoryFilter>) => setF((x) => ({ ...x, ...p }));

  if (ctx.stories.length === 0) {
    return (
      <div className="empty">
        <ObjIcon cat="storylines" size="lg" />
        <h2 style={{ fontSize: 18, margin: 0 }}>No storylines yet</h2>
        <p>Who’s into who, who knows what, what happens next.</p>
        <button type="button" className="btn primary" onClick={onNew}><Plus size={16} weight="bold" /> New storyline</button>
      </div>
    );
  }
  const switcher = (
    <div className="sl-views" role="group" aria-label="View">
      {([['list', 'List', Rows], ['cards', 'Cards', SquaresFour], ['board', 'Board', Kanban]] as const).filter(([v]) => !(phone && v === 'board')).map(([v, label, I]) => (
        <button key={v} type="button" aria-label={label} aria-pressed={eff === v} onClick={() => setView(v)}><I size={16} weight="duotone" aria-hidden="true" /><span>{label}</span></button>
      ))}
    </div>
  );
  const bar = (
    <div className="sl-bar">
      <div className="sl-search"><MagnifyingGlass size={16} weight="bold" aria-hidden="true" /><input aria-label="Search storylines" placeholder="Search storylines" value={f.q} onChange={(e) => set({ q: e.target.value })} /></div>
      <FilterBtn label="Sims" title="Sims" count={f.sims.length} phone={phone}>{() => <SimChecklist ctx={ctx} value={f.sims} onChange={(sims) => set({ sims })} counts={simCounts} />}</FilterBtn>
      <FilterBtn label="Household" title="Households" count={f.households.length} phone={phone}>
        {() => <CheckList search options={ctx.hh.list.map((r) => ({ id: r.id, label: ctx.hh.nameOf(r.id), n: hhCounts.get(r.id) ?? 0 }))} value={f.households} onChange={(households) => set({ households })} icon={<span className="obj households sm" aria-hidden="true"><HouseSimple size={14} weight="duotone" /></span>} />}
      </FilterBtn>
      <FilterBtn label="Status" title="Status" count={f.statuses.length} phone={phone}>
        {() => <CheckList options={STATUSES.map((s) => ({ id: s.id, label: s.label, n: ctx.stories.filter((r) => r.s.status === s.id).length }))} value={f.statuses} onChange={(v) => set({ statuses: v as Status[] })} />}
      </FilterBtn>
      <FilterBtn label="Tag" title="Tags" count={f.tags.length} phone={phone}>
        {() => <CheckList search={tags.length > 8} options={tags.map((t) => ({ id: t.label, label: t.label, n: t.n }))} value={f.tags} onChange={(v) => set({ tags: v })} />}
      </FilterBtn>
      {(active) && <button type="button" className="sl-clear" onClick={() => setF(NO_FILTER)}>Clear</button>}
      <span className="grow" />
      {switcher}
    </div>
  );

  let body: ReactNode;
  if (rows.length === 0) body = <div className="empty"><p>No storylines match.</p><button type="button" className="btn" onClick={() => setF(NO_FILTER)}>Clear filters</button></div>;
  else if (eff === 'board') body = <Board save={save} ctx={ctx} rows={rows} move={(id, status) => { const r = ctx.byId.get(id); if (r && r.s.status !== status) store.put('storyline', { ...r.s, status } as unknown as Record<string, unknown>, id); }} />;
  else {
    const pinned = rows.filter((r) => r.s.pinned && r.s.status !== 'resolved');
    const openRows = rows.filter((r) => !r.s.pinned && r.s.status !== 'resolved');
    const done = rows.filter((r) => r.s.status === 'resolved');
    const flat = active || filterCount(f) > 0;
    const OPEN_MAX = 8;
    const shownOpen = flat || more ? openRows : openRows.slice(0, OPEN_MAX);
    const cards = (list: StoryRow[]) => <div className="hh-cards" style={phone ? { gridTemplateColumns: '1fr' } : undefined}>{list.map((r) => <StoryCard key={r.id} save={save} ctx={ctx} row={r} />)}</div>;
    const lines = (list: StoryRow[]) => list.map((r) => <StoryRowLine key={r.id} save={save} ctx={ctx} row={r} phone={phone} />);
    const head = (t: string, n?: number) => <div className="sl-h in">{t}{n != null && <span className="cnt">{n}</span>}</div>;
    const fold = (children: ReactNode, onClick: () => void, pressed?: boolean) => <button type="button" className="sl-fold" aria-expanded={pressed} onClick={onClick}>{children}</button>;
    const sections: ReactNode = flat ? (
      <>{head(`${plural(rows.length, 'storyline')} match`)}{eff === 'cards' ? cards(rows) : lines(rows)}</>
    ) : (
      <>
        {pinned.length > 0 && <>{head('Pinned', pinned.length)}{eff === 'cards' ? cards(pinned) : lines(pinned)}</>}
        {(openRows.length > 0 || pinned.length === 0) && <>{head('Open', openRows.length)}{eff === 'cards' ? cards(shownOpen) : lines(shownOpen)}</>}
        {!more && openRows.length > OPEN_MAX && fold(<>+ {openRows.length - OPEN_MAX} more open</>, () => setMore(true))}
        {done.length > 0 && (
          <>
            {fold(<><Check size={16} weight="bold" aria-hidden="true" /> Resolved · {done.length}</>, () => setShowResolved((x) => !x), showResolved)}
            {showResolved && (eff === 'cards' ? cards(done) : lines(done))}
          </>
        )}
      </>
    );
    body = eff === 'cards' ? <div className="stack" style={{ gap: 10 }}>{sections}</div> : <div className="sl-list">{sections}</div>;
  }
  return <div className="stack" style={{ gap: 14 }}>{bar}{body}</div>;
}

function StoryRowLine({ save, ctx, row, phone }: { save: SaveRow; ctx: StoriesCtx; row: StoryRow; phone: boolean }) {
  const last = latestBeat(ctx.beats, row.id);
  const cast = ctx.faces(castOf(row.s, ctx.beats, row.id));
  const when = last ? ctx.dayText(last.b.day, last.b.precision) : '';
  return (
    <a className="sl-row" href={storyHref(save, row.id)}>
      <span className="sl-pin" aria-label={row.s.pinned ? 'Pinned' : undefined}>{row.s.pinned && <PushPin size={16} weight="duotone" aria-hidden="true" />}</span>
      <span className="sl-main"><b>{row.s.name || 'Unnamed storyline'}</b>{last && <small>{last.b.text}</small>}</span>
      <StatusTag s={row.s.status} />
      {cast.length > 0 && <span className="sl-faces"><Faces sims={cast} size={phone ? 28 : 32} max={5} /></span>}
      <span className="sl-when">{when}</span>
    </a>
  );
}

function StoryCard({ save, ctx, row }: { save: SaveRow; ctx: StoriesCtx; row: StoryRow }) {
  const last = latestBeat(ctx.beats, row.id);
  const cast = ctx.faces(castOf(row.s, ctx.beats, row.id));
  return (
    <a className="hh-card sl-card-tile" href={storyHref(save, row.id)} style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8 }}><StatusTag s={row.s.status} /><span className="grow" />{row.s.pinned && <PushPin size={16} weight="duotone" aria-label="Pinned" />}{last && <span className="muted small">{ctx.dayText(last.b.day, last.b.precision)}</span>}</div>
      <h3 style={{ margin: 0 }}>{row.s.name || 'Unnamed storyline'}</h3>
      {cast.length > 0 && <Faces sims={cast} size={32} max={5} />}
      {last && <div className="sl-last"><small>Latest beat</small>{last.b.text}</div>}
    </a>
  );
}

function Board({ save, ctx, rows, move }: { save: SaveRow; ctx: StoriesCtx; rows: StoryRow[]; move(id: string, s: Status): void }) {
  const [over, setOver] = useState<Status | null>(null);
  return (
    <div className="sl-board">
      {STATUSES.map((s) => {
        const list = rows.filter((r) => r.s.status === s.id);
        return (
          <div key={s.id} className={`sl-col ${over === s.id ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s.id); }} onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, s.id); }}>
            <div className="row" style={{ gap: 8, padding: '2px 4px 8px' }}><StatusTag s={s.id} /><span className="muted small">{list.length}</span></div>
            {list.map((r) => {
              const last = latestBeat(ctx.beats, r.id);
              const cast = ctx.faces(castOf(r.s, ctx.beats, r.id));
              return (
                <a key={r.id} className="sl-kcard" draggable href={storyHref(save, r.id)} onDragStart={(e) => { e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed = 'move'; }}>
                  <b>{r.s.name || 'Unnamed storyline'}</b>
                  {cast.length > 0 && <Faces sims={cast} size={28} max={5} />}
                  {last && <small>{last.b.text}</small>}
                </a>
              );
            })}
            {list.length === 0 && <div className="sl-colempty">Drop a storyline here</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------- secrets ----------
export function SecretMatrix({ ctx, row, onEdit, saveId }: { ctx: StoriesCtx; row: SecretRow; onEdit?(): void; /** Given: shows a "View storyline" link (leave out on the storyline's own page). */ saveId?: string }) {
  const store = useStore();
  const people = secretPeople(row.sec);
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const phone = useIsPhone();
  const put = (patch: Partial<typeof row.sec>) => store.put('secret', { ...row.sec, ...patch } as unknown as Record<string, unknown>, row.id);
  const setKnow = (id: string, k: Know) => put({ knows: { ...row.sec.knows, [id]: k } });
  const story = row.sec.storyline ? ctx.byId.get(row.sec.storyline) : undefined;
  return (
    <div className="sl-matrix">
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <h3 className="grow" style={{ margin: 0, fontSize: 17 }}>{row.sec.title || 'Unnamed secret'}</h3>
        {onEdit && <button type="button" className="btn ghost icon sm" aria-label="Edit secret" onClick={onEdit}><PencilSimple size={16} /></button>}
      </div>
      {story && !saveId && <div className="muted small">Part of {story.s.name}</div>}
      {story && saveId && <a className="small" href={savePath(saveId, `storylines/${story.id}`)} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>View storyline · {story.s.name} <CaretRight size={12} weight="bold" aria-hidden="true" style={{ verticalAlign: '-1px' }} /></a>}
      <div className="sl-mx-head" aria-hidden="true"><span>Sim</span>{KNOWS.map((k) => <span key={k.id}>{k.label}</span>)}</div>
      {people.map((id) => {
        const cur = knowOf(row.sec, id);
        return (
          <div key={id} className="sl-mx-row">
            <span className="sl-mx-who"><SimAvatar sim={ctx.sims.get(id) ?? { first: '?', last: '', portrait: null }} size={32} />{ctx.nameOf(id)}</span>
            {KNOWS.map((k) => (
              <button key={k.id} type="button" className="sl-ck" aria-pressed={cur === k.id} aria-label={`${ctx.nameOf(id)}: ${k.label}`} onClick={() => setKnow(id, k.id)}>
                <span className={`sl-dot ${cur === k.id ? k.id : ''}`}>{cur === k.id && <Check size={14} weight="bold" aria-hidden="true" />}</span>
              </button>
            ))}
          </div>
        );
      })}
      <button ref={addRef} type="button" className="btn sm ghost sl-addsim" onClick={() => setAdding(true)}><Plus size={14} weight="bold" /> Add a Sim</button>
      {adding && (
        <RowPop anchor={addRef.current} title="Add a Sim" phone={phone} onClose={() => setAdding(false)} width={340}>
          <SimChecklist ctx={ctx} single value={[]} onChange={(ids) => { if (ids[0] && !people.includes(ids[0])) put({ cast: [...row.sec.cast, ids[0]] }); }} onDone={() => setAdding(false)} />
        </RowPop>
      )}
      <button type="button" className={`sl-chip ${row.sec.out ? 'on' : ''}`} aria-pressed={row.sec.out} style={{ alignSelf: 'flex-start' }} onClick={() => put({ out: !row.sec.out })}>{row.sec.out ? 'Out in the open' : 'Mark as out in the open'}</button>
    </div>
  );
}

function SecretsTab({ save, ctx, phone, onNew }: { save: SaveRow; ctx: StoriesCtx; phone: boolean; onNew(): void }) {
  const [scope, setScope] = useState<'open' | 'all'>('open');
  const [sims, setSims] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const rows = ctx.secrets.filter((s) => (scope === 'all' || !s.sec.out) && (!sims.length || sims.every((id) => secretPeople(s.sec).includes(id))))
    .sort((a, b) => Number(a.sec.out) - Number(b.sec.out) || a.sec.title.localeCompare(b.sec.title));
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const s of ctx.secrets) for (const id of secretPeople(s.sec)) m.set(id, (m.get(id) ?? 0) + 1); return m; }, [ctx.secrets]);
  const cur = rows.find((r) => r.id === sel) ?? (phone ? null : rows[0] ?? null);
  if (ctx.secrets.length === 0) {
    return <div className="empty"><EyeSlash size={28} weight="duotone" /><h2 style={{ fontSize: 18, margin: 0 }}>No secrets yet</h2><p>Track who knows what, who only guesses, and who has no idea.</p><button type="button" className="btn primary" onClick={onNew}><Plus size={16} weight="bold" /> New secret</button></div>;
  }
  const item = (r: SecretRow) => {
    const story = r.sec.storyline ? ctx.byId.get(r.sec.storyline) : undefined;
    return (
      <div key={r.id}>
        <button type="button" className={`sl-sec ${cur?.id === r.id ? 'sel' : ''}`} aria-expanded={phone ? cur?.id === r.id : undefined} onClick={() => setSel(phone && sel === r.id ? null : r.id)}>
          <EyeSlash size={20} weight="duotone" aria-hidden="true" />
          <span className="sl-main"><b>{r.sec.title || 'Unnamed secret'}</b><small>{[knowsSummary(r.sec), story?.s.name].filter(Boolean).join(' · ')}</small></span>
          <Faces sims={ctx.faces(secretPeople(r.sec))} size={28} max={3} />
        </button>
        {phone && cur?.id === r.id && <div className="card sl-detail"><SecretMatrix ctx={ctx} row={r} saveId={save.id} onEdit={() => setEdit(r.id)} /></div>}
      </div>
    );
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="sl-bar">
        <Seg<'open' | 'all'> value={scope} options={[{ v: 'open', label: 'Open' }, { v: 'all', label: 'All' }]} onChange={setScope} label="Which secrets" />
        <FilterBtn label="Sims" title="Sims" count={sims.length} phone={phone}>{() => <SimChecklist ctx={ctx} value={sims} onChange={setSims} counts={counts} />}</FilterBtn>
        {sims.length > 0 && <button type="button" className="sl-clear" onClick={() => setSims([])}>Clear</button>}
      </div>
      {rows.length === 0 ? <div className="empty"><p>No secrets match.</p></div> : (
        <div className={phone ? 'stack' : 'sl-split'} style={{ gap: 10 }}>
          <div className="stack" style={{ gap: 8 }}>{rows.map(item)}</div>
          {!phone && cur && <div className="card sl-detail"><SecretMatrix ctx={ctx} row={cur} saveId={save.id} onEdit={() => setEdit(cur.id)} /></div>}
        </div>
      )}
      {edit && <SecretForm ctx={ctx} id={edit} onClose={() => setEdit(null)} onSaved={() => setEdit(null)} />}
    </div>
  );
}

// ---------- feelings ----------
function FeelingsTab({ ctx, phone, onNew }: { ctx: StoriesCtx; phone: boolean; onNew(): void }) {
  const [sims, setSims] = useState<string[]>([]);
  const [kind, setKind] = useState<FeelKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const r of ctx.feelings) for (const id of [r.f.from, r.f.to]) m.set(id, (m.get(id) ?? 0) + 1); return m; }, [ctx.feelings]);
  const rows = ctx.feelings.filter((r) => (kind === 'all' || r.f.kind === kind) && (!sims.length || sims.some((id) => r.f.from === id || r.f.to === id))
    && (!q.trim() || normalize([ctx.nameOf(r.f.from), ctx.nameOf(r.f.to), r.f.word, r.f.why].join(' ')).includes(normalize(q))))
    .sort((a, b) => ctx.nameOf(a.f.from).localeCompare(ctx.nameOf(b.f.from)) || ctx.nameOf(a.f.to).localeCompare(ctx.nameOf(b.f.to)));
  if (ctx.feelings.length === 0) {
    return <div className="empty"><Flame size={28} weight="duotone" /><h2 style={{ fontSize: 18, margin: 0 }}>No feelings yet</h2><p>Who’s into who, who’s mad at who, and why.</p><button type="button" className="btn primary" onClick={onNew}><Plus size={16} weight="bold" /> Add feeling</button></div>;
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="sl-bar">
        <div className="sl-search"><MagnifyingGlass size={16} weight="bold" aria-hidden="true" /><input aria-label="Search feelings" placeholder="Search feelings" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <FilterBtn label="Sims" title="Sims" count={sims.length} phone={phone}>{() => <SimChecklist ctx={ctx} value={sims} onChange={setSims} counts={counts} />}</FilterBtn>
        <Seg<FeelKind | 'all'> value={kind} options={[{ v: 'all', label: 'All' }, ...FEEL_KINDS.map((k) => ({ v: k.id as FeelKind | 'all', label: k.label }))]} onChange={setKind} label="Feeling" />
        {(sims.length > 0 || kind !== 'all' || q) && <button type="button" className="sl-clear" onClick={() => { setSims([]); setKind('all'); setQ(''); }}>Clear</button>}
      </div>
      {rows.length === 0 ? <div className="empty"><p>No feelings match.</p></div> : (
        <div className="card sl-feels">
          {rows.map((r) => (
            <button key={r.id} type="button" className="sl-feel" onClick={() => setEdit(r.id)}>
              <span className="sl-pair"><SimAvatar sim={ctx.sims.get(r.f.from) ?? { first: '?', last: '', portrait: null }} size={36} /><span aria-label="feels about">→</span><SimAvatar sim={ctx.sims.get(r.f.to) ?? { first: '?', last: '', portrait: null }} size={36} /></span>
              <span className="sl-main"><b>{ctx.firstOf(r.f.from)} → {ctx.firstOf(r.f.to)}{r.f.word && ` · ${r.f.word}`}</b>{r.f.why && <small>{r.f.why}</small>}</span>
              <span className={`tag sl-fk ${r.f.kind}`}>{feelLabel(r.f.kind)}</span>
            </button>
          ))}
        </div>
      )}
      {edit && <FeelingForm ctx={ctx} id={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------- for content ----------
function BeatCard({ ctx, b, onEdit, showStory }: { ctx: StoriesCtx; b: BeatRow; onEdit(): void; showStory?: boolean }) {
  const day = ctx.dayText(b.b.day, b.b.precision);
  const story = ctx.byId.get(b.b.storyline);
  const undated = ctx.info.track && b.b.day == null;
  return (
    <button type="button" className="sl-beat" onClick={onEdit}>
      <span className="sl-beat-d">
        {undated ? <span className="sl-nodate"><Plus size={12} weight="bold" aria-hidden="true" />Add date</span> : <b>{day || realDay(b.b.addedAt)}</b>}
        {(day || undated) && b.b.addedAt && <small>{realDay(b.b.addedAt)}</small>}
      </span>
      <span className="sl-beat-card">
        <span className="sl-beat-t">{b.b.text}</span>
        <span className="sl-beat-m">
          {b.b.sims.length > 0 && <Faces sims={ctx.faces(b.b.sims)} size={28} max={5} />}
          {b.b.video && <span className="tag sl-vid"><VideoCamera size={13} weight="duotone" aria-hidden="true" />Content material</span>}
          {b.b.secret && <span className="tag outline-soft"><EyeSlash size={13} weight="duotone" aria-hidden="true" />Secret</span>}
          {showStory && story && <span className="muted small">{story.s.name}</span>}
        </span>
      </span>
    </button>
  );
}

function VideoTab({ save, ctx, onNew }: { save: SaveRow; ctx: StoriesCtx; onNew(): void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const vids = ctx.beats.filter((b) => b.b.video);
  const groups = sortStories(ctx.stories.filter((r) => vids.some((b) => b.b.storyline === r.id)), ctx.beats);
  const exportAll = () => {
    const note = groups.map((r) => storyMarkdown(r, ctx.beats, ctx.secrets, { simName: ctx.nameOf, dayText: ctx.dayText })).join('\n---\n\n');
    download('SimDesk content notes.md', note);
  };
  if (vids.length === 0) {
    return <div className="empty"><VideoCamera size={28} weight="duotone" /><h2 style={{ fontSize: 18, margin: 0 }}>Nothing in Content yet</h2><p>Tag a beat as Content material and it shows up here, in story order.</p><button type="button" className="btn primary" onClick={onNew}><Plus size={16} weight="bold" /> Add beat</button></div>;
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={exportAll}><DownloadSimple size={16} weight="duotone" /> Export to vault</button></div>
      <div className="sl-vgrid">
        {groups.map((r) => (
          <section key={r.id} className="stack" style={{ gap: 8 }}>
            <div className="sl-h" style={{ margin: 0 }}><a href={storyHref(save, r.id)}>{r.s.name}</a><span className="cnt">{plural(vids.filter((b) => b.b.storyline === r.id).length, 'beat')}</span></div>
            {sortBeats(vids.filter((b) => b.b.storyline === r.id)).reverse().map((b) => <BeatCard key={b.id} ctx={ctx} b={b} onEdit={() => setEdit(b.id)} />)}
          </section>
        ))}
      </div>
      {edit && <BeatForm ctx={ctx} id={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------- one storyline ----------
function StoryPage({ save, id }: { save: SaveRow; id: string }) {
  const ctx = useStories(save);
  const store = useStore();
  const phone = useIsPhone();
  const [modal, setModal] = useState<null | { t: 'edit' } | { t: 'beat'; id: string | null } | { t: 'secret'; id: string | null }>(null);
  const [del, setDel] = useState(false);
  const [q, setQ] = useState('');
  const row = ctx.byId.get(id);
  if (!row) return <div className="page"><p>That storyline isn’t here anymore.</p><a className="btn" href={href(save)}>Back to Storylines</a></div>;
  const s = row.s;
  const put = (patch: Partial<typeof s>) => store.put('storyline', { ...s, ...patch } as unknown as Record<string, unknown>, id);
  const beats = sortBeats(ctx.beats.filter((b) => b.b.storyline === id));
  const cast = ctx.faces(castOf(s, ctx.beats, id));
  const secrets = ctx.secrets.filter((x) => x.sec.storyline === id);
  const exportIt = () => { download(fileName(s.name), storyMarkdown(row, ctx.beats, ctx.secrets, { simName: ctx.nameOf, dayText: ctx.dayText })); toast('Note downloaded'); };
  const addQ = () => { const t = q.trim(); if (!t) return; put({ questions: [...s.questions, { text: t, done: false }] }); setQ(''); };

  const head = (
    <div className="sl-head">
      <div className="grow">
        <h1 style={phone ? { fontSize: 24, margin: 0 } : { margin: 0 }}>{s.name || 'Unnamed storyline'}</h1>
        <div className="sl-head-sub">
          <Seg value={s.status} options={STATUSES.map((x) => ({ v: x.id, label: x.label }))} onChange={(status) => put({ status })} label="Status" />
          <button type="button" className={`btn sm ${s.pinned ? 'sl-pinned' : ''}`} aria-pressed={s.pinned} onClick={() => put({ pinned: !s.pinned })}><PushPin size={15} weight="duotone" /> {s.pinned ? 'Pinned' : 'Pin'}</button>
        </div>
        {s.tags.length > 0 && <div className="sl-tags" style={{ marginTop: 8 }}>{s.tags.map((t) => <span key={t} className="tag outline-soft">{t}</span>)}</div>}
        {cast.length > 0 && <div className="sl-castline"><Faces sims={cast} size={40} max={8} /><span className="muted">{plural(cast.length, 'Sim')} in the cast</span></div>}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn" onClick={exportIt}><DownloadSimple size={16} weight="duotone" /> {phone ? 'Export' : 'Export to vault'}</button>
        <button type="button" className="btn icon" aria-label="Edit storyline" onClick={() => setModal({ t: 'edit' })}><PencilSimple size={18} /></button>
        <button type="button" className="btn primary" onClick={() => setModal({ t: 'beat', id: null })}><Plus size={16} weight="bold" /> Add beat</button>
      </div>
    </div>
  );
  const timeline = (
    <section className="stack" style={{ gap: 8 }}>
      <div className="sl-h" style={{ margin: 0 }}>What happened{beats.length > 0 && <span className="cnt">{beats.length}</span>}</div>
      {beats.length === 0 && <p className="muted" style={{ margin: 0 }}>No beats yet. Add the first thing that happened.</p>}
      <div className="sl-timeline">
        {beats.map((b, i) => {
          const partOf = (d: number | null) => (!ctx.info.track ? 0 : d == null ? 2 : dateOf(d, ctx.info.cal).year < ctx.info.cal.anchorDate.year ? 1 : 0);
          const part = partOf(b.b.day);
          const prev = i > 0 ? partOf(beats[i - 1].b.day) : 0;
          return (
            <div key={b.id}>
              {part !== prev && <div className="sl-sep" role="separator">{part === 1 ? 'Before this save' : 'No date yet'}</div>}
              <BeatCard ctx={ctx} b={b} onEdit={() => setModal({ t: 'beat', id: b.id })} />
            </div>
          );
        })}
      </div>
    </section>
  );
  const side = (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card sl-card">
        <div className="card-head"><h2>Who knows what{secrets.length > 0 && <span className="cnt">{secrets.length}</span>}</h2><button type="button" className="btn sm" onClick={() => setModal({ t: 'secret', id: null })}><Plus size={15} weight="bold" /> Secret</button></div>
        {secrets.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No secrets in this storyline yet.</p> : (
          <div className="stack" style={{ gap: 18 }}>{secrets.map((x) => <SecretMatrix key={x.id} ctx={ctx} row={x} onEdit={() => setModal({ t: 'secret', id: x.id })} />)}</div>
        )}
      </section>
      <StoryPhotos save={save} storylineId={id} />
      <section className="card sl-card">
        <div className="card-head"><h2>Open questions{s.questions.filter((x) => !x.done).length > 0 && <span className="cnt">{s.questions.filter((x) => !x.done).length}</span>}</h2></div>
        {s.questions.map((x, i) => (
          <div key={i} className="sl-q">
            <button type="button" className={`sl-qb ${x.done ? 'done' : ''}`} aria-pressed={x.done} aria-label={`${x.text}: ${x.done ? 'answered' : 'open'}`} onClick={() => put({ questions: s.questions.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })}>
              {x.done ? <Check size={16} weight="bold" /> : <Question size={18} weight="duotone" />}<span>{x.text}</span>
            </button>
            <button type="button" className="club-x" aria-label={`Remove ${x.text}`} onClick={() => put({ questions: s.questions.filter((_, j) => j !== i) })}><X size={16} weight="bold" /></button>
          </div>
        ))}
        <form className="sl-qadd" onSubmit={(e) => { e.preventDefault(); addQ(); }}>
          <input className="input" value={q} maxLength={120} aria-label="Add a question" placeholder="Who does Kiana want?" onChange={(e) => setQ(e.target.value)} />
          <button type="submit" className="btn sm" disabled={!q.trim()}>Add</button>
        </form>
      </section>
      <section className="card sl-card">
        <div className="card-head"><h2>Episode notes</h2></div>
        <AutoText value={s.notes} onSave={(v) => put({ notes: v })} placeholder="Voiceover angle, what to say after the clip…" label="Episode notes" rows={4} />
      </section>
      <button type="button" className="btn ghost danger" style={{ alignSelf: 'flex-start' }} onClick={() => setDel(true)}>Delete storyline</button>
    </div>
  );
  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 16 }}>
      <a className="ph-back" href={href(save)}><CaretLeft size={18} weight="bold" /> Storylines</a>
      {head}
      {phone ? <div className="stack" style={{ gap: 14 }}>{side}{timeline}</div> : <div className="sl-two"><div>{timeline}</div>{side}</div>}
      {modal?.t === 'edit' && <StoryForm ctx={ctx} id={id} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
      {modal?.t === 'beat' && <BeatForm ctx={ctx} id={modal.id} storyline={id} onClose={() => setModal(null)} />}
      {modal?.t === 'secret' && <SecretForm ctx={ctx} id={modal.id} storyline={id} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
      {del && (
        <Confirm title="Delete this storyline?" text="Its beats and secrets go to Trash with it for 7 days." onCancel={() => setDel(false)}
          actions={[{ label: 'Keep it', run: () => setDel(false) }, { label: 'Delete', kind: 'danger', run: () => {
            setDel(false);
            store.moveManyToTrash([id, ...ctx.beats.filter((b) => b.b.storyline === id).map((b) => b.id), ...secrets.map((x) => x.id)], s.name || 'Storyline');
            go(href(save));
          } }]} />
      )}
    </div>
  );
}

// ---------- on a Sim's profile ----------
export function SimStorylines({ save, simId, phone }: { save: SaveRow; simId: string; phone?: boolean }) {
  const ctx = useStories(save);
  if (!storylinesOn(saveData(save))) return null;
  const mine = sortStories(ctx.stories.filter((r) => castOf(r.s, ctx.beats, r.id).includes(simId)), ctx.beats);
  const secrets = ctx.secrets.filter((x) => secretPeople(x.sec).includes(simId) && !x.sec.out);
  const feels = ctx.feelings.filter((x) => x.f.from === simId || x.f.to === simId);
  if (!mine.length && !secrets.length && !feels.length) return null;
  const top = mine.filter((r) => r.s.status !== 'resolved').slice(0, 4);
  const lines: { icon: ReactNode; text: string; href: string }[] = [
    ...secrets.slice(0, 3).map((x) => ({ icon: <EyeSlash size={16} weight="duotone" />, text: `${x.sec.title} · ${KNOWS.find((k) => k.id === knowOf(x.sec, simId))!.label}`, href: href(save, '/secrets') })),
    ...feels.slice(0, 3).map((x) => ({ icon: <Flame size={16} weight="duotone" />, text: x.f.from === simId ? `${x.f.word || feelLabel(x.f.kind)} about ${ctx.firstOf(x.f.to)}` : `${ctx.firstOf(x.f.from)}: ${x.f.word || feelLabel(x.f.kind)}`, href: href(save, '/feelings') })),
  ];
  const stories = top.map((r) => (
    <a key={r.id} className="sl-mini" href={storyHref(save, r.id)}><b>{r.s.name}</b><StatusTag s={r.s.status} /></a>
  ));
  if (phone) {
    return (
      <>
        <div className="m-label">Storylines · {mine.length}</div>
        <div className="m-group">{top.map((r) => <a key={r.id} className="m-row" href={storyHref(save, r.id)}><span className="grow"><b>{r.s.name}</b></span><StatusTag s={r.s.status} /></a>)}</div>
        {lines.length > 0 && <div className="m-group">{lines.map((l, i) => <a key={i} className="m-row" href={l.href}>{l.icon}<span className="grow">{l.text}</span></a>)}</div>}
      </>
    );
  }
  return (
    <>
      <section className="card sl-card">
        <div className="card-head"><h2><ObjIcon cat="storylines" />Storylines<span className="cnt">{mine.length}</span></h2><a className="muted small" href={href(save)}>See all</a></div>
        <div className="stack" style={{ gap: 2 }}>{stories}{top.length === 0 && <p className="muted small" style={{ margin: 0 }}>All resolved.</p>}</div>
      </section>
      {lines.length > 0 && (
        <section className="card sl-card">
          <div className="card-head"><h2>Secrets and feelings</h2></div>
          <div className="stack" style={{ gap: 2 }}>{lines.map((l, i) => <a key={i} className="sl-mini" href={l.href}><span className="sl-mini-i">{l.icon}</span><span className="grow">{l.text}</span></a>)}</div>
        </section>
      )}
    </>
  );
}
