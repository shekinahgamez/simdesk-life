import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CaretDown, CaretLeft, CaretRight, DotsThree, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { Confirm, Sheet } from '../../components/ui';
import {
  BLANK_TAB, DEFAULT_ICON, ICONS, INKS, docData, flatTabs, iconMatches, inkSvg, landingTab, moveOrders, nextOrder, parseBody, subtreeIds, svgUrl, tabCount, tabData, tabTree,
  type TabData, type TabRow,
} from '../../lib/docs';
import { go, savePath } from '../../lib/router';
import { moduleOn, saveData } from '../../lib/saves';
import { useRecords, useStore } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { useIsPhone } from '../../lib/useIsPhone';
import { RowPop } from '../sims/RowEdit';

// ---------- the icon set ----------
const loaders = import.meta.glob('../../assets/icon-set/*.svg', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const svgCache = new Map<string, string>();
function useSvg(file: string): string | null {
  const [svg, setSvg] = useState<string | null>(svgCache.get(file) ?? null);
  useEffect(() => {
    if (svgCache.has(file)) { setSvg(svgCache.get(file)!); return; }
    const load = loaders[`../../assets/icon-set/${file}.svg`];
    let live = true;
    load?.().then((s) => { svgCache.set(file, s); if (live) setSvg(s); });
    return () => { live = false; };
  }, [file]);
  return svg;
}
/** One icon from the set, in its own ink or the one picked. */
export function SetIcon({ file, color = '', size = 22 }: { file: string; color?: string; size?: number }) {
  const svg = useSvg(file);
  return <span className="dx-ic" style={{ width: size, height: size }} aria-hidden="true">{svg && <img src={svgUrl(inkSvg(svg, color))} alt="" width={size} height={size} />}</span>;
}

const lastKey = (saveId: string, docId: string) => `simdesk.docs.last.${saveId}.${docId}`;
const readLast = (saveId: string, docId: string) => { try { return localStorage.getItem(lastKey(saveId, docId)); } catch { return null; } };
const writeLast = (saveId: string, docId: string, tabId: string) => { try { localStorage.setItem(lastKey(saveId, docId), tabId); } catch { /* private window */ } };
const href = (save: SaveRow, docId?: string, tabId?: string) => savePath(save.id, `docs${docId ? `/${docId}` : ''}${tabId ? `/${tabId}` : ''}`);

/** The Docs section: the list, or one doc open on a tab. */
export function DocsPage({ save, rest }: { save: SaveRow; rest: string[] }) {
  const d = saveData(save);
  if (!moduleOn(d, 'journal')) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 480 }}>
        <SetIcon file={DEFAULT_ICON} size={32} />
        <h2 style={{ fontSize: 18, margin: 0 }}>Docs is off for this save</h2>
        <p>Turn it on in Save settings and it shows up here.</p>
        <a className="btn primary" href={savePath(save.id, 'settings')}>Open Save settings</a>
      </div>
    );
  }
  return rest[0] ? <DocView key={rest[0]} save={save} docId={rest[0]} tabId={rest[1] ?? ''} /> : <DocList save={save} />;
}

// ---------- the list ----------
function DocList({ save }: { save: SaveRow }) {
  const store = useStore();
  const docs = useRecords('doc');
  const tabs = useRecords('doctab');
  const rows = useMemo(() => docs.filter((r) => !r.deleted_at).map((r) => ({ id: r.id, title: docData(r).title || 'Untitled doc', n: tabCount(tabs, r.id), at: r.edited_at })).sort((a, b) => (a.at < b.at ? 1 : -1)), [docs, tabs]);
  const create = () => {
    const id = store.put('doc', { title: '' });
    const tab = store.put('doctab', { ...BLANK_TAB, doc: id, title: 'Overview' });
    go(href(save, id, tab));
  };
  return (
    <div className="page dx-page">
      <div className="page-head">
        <div><h1>Docs</h1></div>
        <button type="button" className="btn primary" onClick={create}><Plus size={16} weight="bold" /> New doc</button>
      </div>
      {rows.length === 0 ? (
        <div className="empty"><SetIcon file={DEFAULT_ICON} size={32} /><p>Write up your save in tabs: politics, each world, your plans. Start with a doc.</p></div>
      ) : (
        <div className="card dx-list">
          {rows.map((r) => (
            <a key={r.id} className="dx-row" href={href(save, r.id)}>
              <SetIcon file={DEFAULT_ICON} size={32} />
              <span className="grow" style={{ minWidth: 0 }}><b>{r.title}</b><span className="muted">{r.n} {r.n === 1 ? 'tab' : 'tabs'}</span></span>
              <CaretRight size={16} weight="bold" className="muted" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- one doc ----------
function DocView({ save, docId, tabId }: { save: SaveRow; docId: string; tabId: string }) {
  const store = useStore();
  const phone = useIsPhone();
  const docs = useRecords('doc');
  const tabRecs = useRecords('doctab');
  const doc = docs.find((r) => r.id === docId && !r.deleted_at);
  const tree = useMemo(() => tabTree(tabRecs, docId), [tabRecs, docId]);
  const flat = useMemo(() => flatTabs(tree), [tree]);
  const cur = flat.find((t) => t.id === tabId);
  const [sheet, setSheet] = useState(false);

  // Opening a doc lands on the tab you read last. A tab that's gone falls back to the first one.
  useEffect(() => {
    if (!doc) return;
    if (!cur) {
      const to = landingTab(tree, readLast(save.id, docId));
      if (to) go(href(save, docId, to), { replace: true });
    } else writeLast(save.id, docId, cur.id);
  }, [doc, cur, tree, save, docId]);

  if (!doc) {
    return <div className="empty" style={{ margin: '40px auto', maxWidth: 480 }}><h2 style={{ fontSize: 18, margin: 0 }}>This doc isn’t here</h2><a className="btn" href={href(save)}>Back to Docs</a></div>;
  }
  const title = docData(doc).title;
  const addFirst = () => { const id = store.put('doctab', { ...BLANK_TAB, doc: docId, title: 'Overview' }); go(href(save, docId, id)); };
  const pick = (id: string) => { setSheet(false); go(href(save, docId, id)); };
  const i = cur ? flat.findIndex((t) => t.id === cur.id) : -1;
  const prev = i > 0 ? flat[i - 1] : null;
  const next = i >= 0 && i < flat.length - 1 ? flat[i + 1] : null;
  const parentRow = cur && cur.depth === 1 ? tree.find((t) => t.children.some((c) => c.id === cur.id)) : null;

  return (
    <div className="dx-wrap">
      <div className="dx-top">
        <a className="ph-back" href={href(save)}><CaretLeft size={18} weight="bold" /> Docs</a>
        <DocTitle value={title} onSave={(v) => store.put('doc', { title: v.trim() }, docId)} />
        <DocMenu save={save} docId={docId} title={title || 'Untitled doc'} />
      </div>
      {phone && cur && (
        <button type="button" className="dx-bar" onClick={() => setSheet(true)} aria-label="Tabs" aria-haspopup="dialog">
          <SetIcon file={cur.t.icon} color={cur.t.color} size={24} />
          <span className="dx-bar-t">{parentRow && <span className="muted">{parentRow.t.title || 'Untitled'} › </span>}{cur.t.title || 'Untitled'}</span>
          <span className="dx-bar-n muted">{i + 1} of {flat.length} <CaretDown size={14} weight="bold" /></span>
        </button>
      )}
      <div className="dx-doc">
        {!phone && <TabRail tree={tree} docId={docId} curId={cur?.id ?? ''} save={save} onPick={pick} />}
        <div className="dx-main">
          {cur ? (
            <TabPage key={cur.id} row={cur} parentRow={parentRow ?? null} />
          ) : flat.length === 0 ? (
            <div className="empty"><p>This doc has no tabs yet.</p><button type="button" className="btn primary" onClick={addFirst}><Plus size={16} weight="bold" /> Add a tab</button></div>
          ) : null}
          {cur && (prev || next) && (
            <div className="dx-pn">
              {prev ? <a className="dx-pn-a" href={href(save, docId, prev.id)}><CaretLeft size={16} weight="bold" aria-hidden="true" /><span><small>Previous</small>{prev.t.title || 'Untitled'}</span></a> : <span />}
              {next ? <a className="dx-pn-a next" href={href(save, docId, next.id)}><span><small>Next</small>{next.t.title || 'Untitled'}</span><CaretRight size={16} weight="bold" aria-hidden="true" /></a> : <span />}
            </div>
          )}
        </div>
      </div>
      {sheet && (
        <Sheet title="Tabs" onClose={() => setSheet(false)}>
          <TabRail tree={tree} docId={docId} curId={cur?.id ?? ''} save={save} onPick={pick} inSheet />
        </Sheet>
      )}
    </div>
  );
}

function DocTitle({ value, onSave }: { value: string; onSave(v: string): void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className="dx-title" aria-label="Doc title" placeholder="Untitled doc" value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => { if (v.trim() !== value) onSave(v); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

function DocMenu({ save, docId, title }: { save: SaveRow; docId: string; title: string }) {
  const store = useStore();
  const phone = useIsPhone();
  const tabs = useRecords('doctab');
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={btn} className="btn ghost icon" aria-label="More" aria-haspopup="menu" onClick={() => setOpen(true)}><DotsThree size={20} weight="bold" /></button>
      {open && (
        <RowPop anchor={btn.current} title="Doc" phone={phone} width={220} onClose={() => setOpen(false)}>
          <div className="dx-menu" role="menu">
            <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); setAsk(true); }}><Trash size={18} /> Delete doc</button>
          </div>
        </RowPop>
      )}
      {ask && (
        <Confirm title={`Delete “${title}”?`} text="It goes to Trash with all its tabs. You can undo it from the message that shows up." onCancel={() => setAsk(false)}
          actions={[
            { label: 'Keep it', run: () => setAsk(false) },
            { label: 'Delete doc', kind: 'danger', run: () => { setAsk(false); const ids = [docId, ...tabs.filter((r) => tabData(r).doc === docId && !r.deleted_at).map((r) => r.id)]; store.moveManyToTrash(ids, title); go(href(save)); } },
          ]} />
      )}
    </>
  );
}

// ---------- the tab list ----------
type Adding = { parent: string } | null;
function TabRail({ tree, docId, curId, save, onPick, inSheet = false }: { tree: TabRow[]; docId: string; curId: string; save: SaveRow; onPick(id: string): void; inSheet?: boolean }) {
  const store = useStore();
  const [shut, setShut] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Adding>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [icon, setIcon] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [del, setDel] = useState<TabRow | null>(null);
  const phone = useIsPhone();
  const find = (id: string) => flatTabs(tree).find((t) => t.id === id);

  const add = (parent: string, title: string) => {
    setAdding(null);
    const name = title.trim();
    if (!name) return;
    const base = parent ? find(parent)?.t : null;
    const id = store.put('doctab', { ...BLANK_TAB, doc: docId, parent, title: name, order: nextOrder(tree, parent), icon: base?.icon ?? DEFAULT_ICON, color: base?.color ?? '' });
    onPick(id);
  };
  const patch = (id: string, p: Partial<TabData>) => { const r = find(id); if (r) store.put('doctab', { ...r.t, ...p } as unknown as Record<string, unknown>, id); };
  const move = (id: string, dir: -1 | 1) => { const m = moveOrders(tree, id, dir); if (m) m.forEach((order, tid) => patch(tid, { order })); };
  const remove = (r: TabRow) => {
    const ids = subtreeIds(tree, r.id);
    const flat = flatTabs(tree);
    const idx = flat.findIndex((t) => t.id === r.id);
    const fallback = flat.find((t, k) => !ids.includes(t.id) && k > idx) ?? [...flat].reverse().find((t) => !ids.includes(t.id));
    store.moveManyToTrash(ids, r.t.title || 'Tab');
    if (ids.includes(curId)) go(fallback ? href(save, docId, fallback.id) : href(save, docId));
  };

  const row = (r: TabRow) => {
    const open = !shut.has(r.id);
    const on = r.id === curId;
    return (
      <div key={r.id} className={`dx-t ${r.depth ? 'sub' : ''} ${on ? 'on' : ''} ${menu?.id === r.id ? 'hov' : ''} ${editing ? 'editing' : ''}`}>
        {r.depth === 0 && (
          <button type="button" className="dx-car" aria-label={open ? `Collapse ${r.t.title}` : `Expand ${r.t.title}`} aria-expanded={open} disabled={r.children.length === 0}
            onClick={() => setShut((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>
            {r.children.length > 0 && (open ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />)}
          </button>
        )}
        {renaming === r.id ? (
          <>
            <SetIcon file={r.t.icon} color={r.t.color} />
            <NameInput initial={r.t.title} onDone={(v) => { setRenaming(null); if (v.trim() && v.trim() !== r.t.title) patch(r.id, { title: v.trim() }); }} />
          </>
        ) : (
          <a className="dx-t-main" href={href(save, docId, r.id)} aria-current={on ? 'page' : undefined} onClick={(e) => { e.preventDefault(); onPick(r.id); }}>
            <SetIcon file={r.t.icon} color={r.t.color} size={r.depth ? 20 : 22} />
            <span className="dx-t-n">{r.t.title || 'Untitled'}</span>
          </a>
        )}
        <button type="button" className="dx-more" aria-label={`${r.t.title || 'Tab'} options`} aria-haspopup="menu" onClick={(e) => setMenu({ id: r.id, el: e.currentTarget })}><DotsThree size={18} weight="bold" /></button>
      </div>
    );
  };
  const adder = (parent: string) => (
    <div key={`add-${parent}`} className={`dx-t ${parent ? 'sub' : ''}`}>
      {!parent && <span className="dx-car" />}
      <SetIcon file={parent ? find(parent)?.t.icon ?? DEFAULT_ICON : DEFAULT_ICON} color={parent ? find(parent)?.t.color ?? '' : ''} size={parent ? 20 : 22} />
      <NameInput initial="" placeholder={parent ? 'Sub-tab name' : 'Tab name'} onDone={(v) => add(parent, v)} />
    </div>
  );

  const m = menu ? find(menu.id) : null;
  return (
    <nav className={`dx-rail ${inSheet ? 'in-sheet' : ''}`} aria-label="Tabs">
      {!inSheet && <div className="dx-rh">Tabs</div>}
      {tree.map((t) => (
        <div key={t.id}>
          {row(t)}
          {!shut.has(t.id) && t.children.map(row)}
          {adding?.parent === t.id ? adder(t.id) : (t.id === curId || t.children.some((c) => c.id === curId)) && (
            <button type="button" className="dx-add sub" onClick={() => { setShut((s) => { const n = new Set(s); n.delete(t.id); return n; }); setAdding({ parent: t.id }); }}><Plus size={14} weight="bold" /> Add sub-tab</button>
          )}
        </div>
      ))}
      {adding?.parent === '' ? adder('') : <button type="button" className="dx-add" onClick={() => setAdding({ parent: '' })}><Plus size={16} weight="bold" /> Add tab</button>}
      {inSheet && <button type="button" className={`btn ${editing ? 'primary' : ''}`} style={{ marginTop: 8 }} onClick={() => setEditing((e) => !e)}><PencilSimple size={16} /> {editing ? 'Done' : 'Edit tabs'}</button>}
      {menu && m && (
        <RowPop anchor={menu.el} title={m.t.title || 'Tab'} phone={phone} width={248} onClose={() => setMenu(null)}>
          <div className="dx-menu" role="menu">
            {m.depth === 0 && <button type="button" role="menuitem" onClick={() => { setMenu(null); setShut((s) => { const n = new Set(s); n.delete(m.id); return n; }); setAdding({ parent: m.id }); }}><Plus size={18} /> Add sub-tab</button>}
            <button type="button" role="menuitem" onClick={() => { setMenu(null); setRenaming(m.id); }}><PencilSimple size={18} /> Rename</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(null); setIcon({ id: m.id, el: menu.el }); }}><SetIcon file={m.t.icon} color={m.t.color} size={20} /> Change icon</button>
            <hr />
            <button type="button" role="menuitem" onClick={() => { move(m.id, -1); setMenu(null); }}><ArrowUp size={18} /> Move up</button>
            <button type="button" role="menuitem" onClick={() => { move(m.id, 1); setMenu(null); }}><ArrowDown size={18} /> Move down</button>
            <hr />
            <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); setDel(m); }}><Trash size={18} /> Delete tab{m.children.length > 0 && <small>{m.children.length + 1} pages</small>}</button>
          </div>
        </RowPop>
      )}
      {icon && find(icon.id) && (
        <IconPicker anchor={icon.el} phone={phone} file={find(icon.id)!.t.icon} color={find(icon.id)!.t.color} onClose={() => setIcon(null)} onPick={(p) => patch(icon.id, p)} />
      )}
      {del && (
        <Confirm title={`Delete “${del.t.title || 'this tab'}”?`} text={del.children.length ? `Its ${del.children.length} sub-${del.children.length === 1 ? 'tab goes' : 'tabs go'} with it. You can undo it from the message that shows up.` : 'You can undo it from the message that shows up.'}
          onCancel={() => setDel(null)}
          actions={[{ label: 'Keep it', run: () => setDel(null) }, { label: 'Delete tab', kind: 'danger', run: () => { const r = del; setDel(null); remove(r); } }]} />
      )}
    </nav>
  );
}

function NameInput({ initial, placeholder, onDone }: { initial: string; placeholder?: string; onDone(v: string): void }) {
  const [v, setV] = useState(initial);
  const done = useRef(false);
  const born = useRef(Date.now());
  const el = useRef<HTMLInputElement>(null);
  const finish = (val: string) => { if (done.current) return; done.current = true; onDone(val); };
  return <input ref={el} className="dx-name" autoFocus aria-label="Tab name" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onFocus={(e) => e.currentTarget.select()}
    // A pop-up that just closed hands focus back to its button. That isn't the person leaving the field, so take the focus back.
    onBlur={() => { if (Date.now() - born.current < 400) { window.setTimeout(() => el.current?.focus(), 0); return; } finish(v); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finish(v); } else if (e.key === 'Escape') { e.preventDefault(); finish(initial); } }} />;
}

// ---------- icon picker ----------
function IconPicker({ anchor, phone, file, color, onClose, onPick }: { anchor: HTMLElement; phone: boolean; file: string; color: string; onClose(): void; onPick(p: Partial<TabData>): void }) {
  const [q, setQ] = useState('');
  const list = iconMatches(q);
  const own = INKS.includes(color) ? color : '';
  return (
    <RowPop anchor={anchor} title="Icon" phone={phone} width={316} onClose={onClose}>
      <div className="dx-pick">
        <label className="dx-pick-s"><MagnifyingGlass size={16} aria-hidden="true" /><input aria-label="Search icons" placeholder="Search icons" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="dx-cap">Color</div>
        <div className="dx-inks" role="radiogroup" aria-label="Icon color">
          {INKS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Ink ${c}`} className={`dx-ink ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick({ color: c })} />
          ))}
        </div>
        <div className="dx-cap">{q.trim() ? `${list.length} found` : 'Suggested'}</div>
        <div className="dx-grid" role="listbox" aria-label="Icons">
          {list.map((i) => (
            <button key={i.file} type="button" role="option" aria-selected={i.file === file} aria-label={i.name} title={i.name} className={i.file === file ? 'on' : ''} onClick={() => onPick({ icon: i.file, color: own || color })}>
              <SetIcon file={i.file} color={color} size={26} />
            </button>
          ))}
          {list.length === 0 && <p className="muted" style={{ gridColumn: '1 / -1', margin: 8 }}>No icon called “{q.trim()}”. {ICONS.length} to search.</p>}
        </div>
        {color && <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => onPick({ color: '' })}>Use the icon’s own color</button>}
      </div>
    </RowPop>
  );
}

// ---------- one tab's page ----------
function TabPage({ row, parentRow }: { row: TabRow; parentRow: TabRow | null }) {
  const store = useStore();
  const [icon, setIcon] = useState<HTMLElement | null>(null);
  const phone = useIsPhone();
  const t = row.t;
  const patch = (p: Partial<TabData>) => store.put('doctab', { ...t, ...p } as unknown as Record<string, unknown>, row.id);
  return (
    <article className="dx-pg">
      {parentRow && <div className="dx-bc"><SetIcon file={parentRow.t.icon} color={parentRow.t.color} size={18} />{parentRow.t.title || 'Untitled'} <CaretRight size={12} weight="bold" aria-hidden="true" /> {t.title || 'Untitled'}</div>}
      <div className="dx-h">
        <button type="button" className="dx-h-ic" aria-label="Change icon" onClick={(e) => setIcon(e.currentTarget)}><SetIcon file={t.icon} color={t.color} size={phone ? 32 : 40} /></button>
        <PageTitle value={t.title} onSave={(v) => patch({ title: v.trim() || t.title })} />
      </div>
      <PageBody value={t.body} onSave={(v) => patch({ body: v })} />
      {icon && <IconPicker anchor={icon} phone={phone} file={t.icon} color={t.color} onClose={() => setIcon(null)} onPick={patch} />}
    </article>
  );
}

function PageTitle({ value, onSave }: { value: string; onSave(v: string): void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className="dx-h1" aria-label="Tab title" placeholder="Untitled" value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => { if (v.trim() && v.trim() !== value) onSave(v); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

/** The page text. Tap it to write, it saves as you type; tap away to read it formatted. */
function PageBody({ value, onSave }: { value: string; onSave(v: string): void }) {
  const [text, setText] = useState(value);
  const [edit, setEdit] = useState(false);
  const timer = useRef<number>();
  const area = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ value, onSave });
  latest.current = { value, onSave };
  useEffect(() => { if (!edit) setText(value); }, [value, edit]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (edit && area.current) { const a = area.current; a.focus(); a.setSelectionRange(a.value.length, a.value.length); } }, [edit]);
  useEffect(() => { const a = area.current; if (a) { a.style.height = 'auto'; a.style.height = `${Math.max(240, a.scrollHeight)}px`; } }, [text, edit]);
  if (edit) {
    return (
      <textarea ref={area} className="dx-body-in" aria-label="Page" placeholder="Write here. # for a heading, - for a bullet." value={text}
        onChange={(e) => { const v = e.target.value; setText(v); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => latest.current.onSave(v), 500); }}
        onBlur={() => { window.clearTimeout(timer.current); if (text !== latest.current.value) latest.current.onSave(text); setEdit(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }} />
    );
  }
  const blocks = parseBody(value);
  return (
    <div className="dx-body" role="button" tabIndex={0} aria-label="Edit page" onClick={() => setEdit(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEdit(true); } }}>
      {blocks.length === 0 && <p className="muted">Tap to write. # for a heading, - for a bullet.</p>}
      {blocks.map((b, k) => b.kind === 'h1' ? <h2 key={k} className="dx-b1">{b.text}</h2> : b.kind === 'h2' ? <h3 key={k} className="dx-b2">{b.text}</h3>
        : b.kind === 'ul' ? <ul key={k}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul> : <p key={k}>{b.text}</p>)}
    </div>
  );
}

