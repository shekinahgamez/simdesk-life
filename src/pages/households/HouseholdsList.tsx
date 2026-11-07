import { useEffect, useMemo, useState } from 'react';
import { CaretRight, FunnelSimple, HouseSimple, Plus, Rows, SquaresFour, X } from '@phosphor-icons/react';
import { ObjIcon } from '../../components/categories';
import { Field, Modal, Picker, SearchBox, Sheet, TextInput, Toggle } from '../../components/ui';
import { householdTags, type HH } from '../../lib/households';
import { householdLabel, simAge, stageOf } from '../../lib/sims';
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
  const [filters, setFilters] = useState<HhFilters>(() => loadHhFilters(save.id));
  const [showFilter, setShowFilter] = useState(false);
  const [layout, setLayoutState] = useState<Layout>(loadLayout);
  const setLayout = (l: Layout) => { setLayoutState(l); try { localStorage.setItem(HH_LAYOUT_KEY, l); } catch { /* ignore */ } };
  useEffect(() => { try { sessionStorage.setItem(HH_FILTER_KEY(save.id), JSON.stringify(filters)); } catch { /* ignore */ } }, [filters, save.id]);
  const facts = useMemo(() => new Map(ctx.households.map((h) => [h.id, hhFacts(ctx, h)])), [ctx]);
  const living = ctx.sims.filter((s) => !s.sim.deceased).length;
  const shown = ctx.households
    .filter((h) => !q.trim() || matches(h.data.name, q) || ctx.membersOf(h.id).some((s) => matches(`${s.sim.first} ${s.sim.last}`, q)))
    .filter((h) => passes(facts.get(h.id)!, filters));
  const nf = hhFilterCount(filters);
  const worldOpts = [...new Map([...facts.values()].filter((f) => f.world).map((f) => [f.world!, f.worldName])).entries()]
    .map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  const open = (id: string) => go(savePath(save.id, `households/${id}`));

  const cards = ctx.households.length === 0 ? (
    <div className="empty">
      <ObjIcon cat="households" size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>No households yet</h2>
      <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New household</button>
    </div>
  ) : shown.length === 0 ? <p className="muted">No households match that.</p> : (
    layout === 'gallery' ? (
      <div className="hh-cards">
        {shown.map((h) => <HhCard key={h.id} ctx={ctx} h={h} onOpen={() => open(h.id)} onPick={() => setPicking(h)} />)}
      </div>
    ) : phone ? (
      <div className="m-group hh-rows">
        {shown.map((h) => <HhRowPhone key={h.id} ctx={ctx} h={h} onOpen={() => open(h.id)} />)}
      </div>
    ) : (
      <div className="table-wrap">
        <table className="table hh-table">
          <thead><tr><th>Household</th><th>Sims</th><th>Home</th></tr></thead>
          <tbody>{shown.map((h) => <HhRow key={h.id} ctx={ctx} h={h} onOpen={() => open(h.id)} onPick={() => setPicking(h)} />)}</tbody>
        </table>
      </div>
    )
  );
  const viewSwitch = ctx.households.length > 0 && (
    <span className="view-switch" role="group" aria-label="View">
      <button type="button" aria-pressed={layout === 'list'} aria-label="List" title="List" onClick={() => setLayout('list')}><Rows size={20} weight={layout === 'list' ? 'fill' : 'regular'} /></button>
      <button type="button" aria-pressed={layout === 'gallery'} aria-label="Gallery" title="Gallery" onClick={() => setLayout('gallery')}><SquaresFour size={20} weight={layout === 'gallery' ? 'fill' : 'regular'} /></button>
    </span>
  );
  const dialogs = (
    <>
      {adding && <NewHousehold onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); open(id); }} />}
      {picking && <HomePicker ctx={ctx} hh={picking} onClose={() => setPicking(null)} />}
      {showFilter && <HhFilterPanel filters={filters} onChange={setFilters} onClose={() => setShowFilter(false)} count={shown.length} phone={phone} worlds={worldOpts} />}
    </>
  );
  const tags = <HhActiveFilters filters={filters} onChange={setFilters} worldName={(id) => worldOpts.find((w) => w.id === id)?.label ?? id} />;
  const search = ctx.households.length > 0 && <SearchBox value={q} onChange={setQ} placeholder={phone ? 'Search' : `Search ${plural(ctx.households.length, 'household')}`} />;

  if (phone) {
    return (
      <div className="m-stack">
        <h1 className="m-h1" style={{ paddingTop: 6 }}>Sims</h1>
        <SimsSwitch saveId={save.id} on="households" />
        {search && (
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <div className="m-search grow">{search}</div>
            <button type="button" className="btn icon filter-btn" aria-label={nf ? `Filter, ${nf} on` : 'Filter'} onClick={() => setShowFilter(true)}>
              <FunnelSimple size={20} weight="bold" />{nf > 0 && <span className="count">{nf}</span>}
            </button>
            {viewSwitch}
          </div>
        )}
        {tags}
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
        {search && (
          <button type="button" className="btn filter-btn" onClick={() => setShowFilter(true)}>
            <FunnelSimple size={18} weight="bold" /> Filter{nf > 0 && <span className="count">{nf}</span>}
          </button>
        )}
        <span className="grow" />
        {viewSwitch}
      </div>
      {tags}
      {cards}
      {dialogs}
    </div>
  );
}

type Layout = 'list' | 'gallery';
const HH_LAYOUT_KEY = 'sd:hhLayout';
function loadLayout(): Layout {
  try { return localStorage.getItem(HH_LAYOUT_KEY) === 'gallery' ? 'gallery' : 'list'; } catch { return 'list'; }
}

/** One household as a table row (desktop List view). */
function HhRow({ ctx, h, onOpen, onPick }: { ctx: HhCtx; h: HH; onOpen(): void; onPick(): void }) {
  const home = ctx.homeOf(h);
  const members = ctx.membersOf(h.id);
  const world = home ? ctx.lots.worldName(home.world) : '';
  return (
    <tr tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <td><b>{h.data.name.trim() || 'Unnamed'}</b></td>
      <td>{members.length > 0
        ? <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><Faces sims={members} size={30} max={5} /><span className="muted">{members.length}</span></span>
        : <span className="muted">No Sims yet</span>}</td>
      <td>{home
        ? <span className="hh-home"><HouseSimple size={16} weight="duotone" /> {[home.title, world].filter(Boolean).join(' · ')}</span>
        : <button type="button" className="hh-pick" onClick={(e) => { e.stopPropagation(); onPick(); }}><Plus size={14} weight="bold" /> Pick a home</button>}</td>
    </tr>
  );
}

/** One household as a phone row (List view). */
function HhRowPhone({ ctx, h, onOpen }: { ctx: HhCtx; h: HH; onOpen(): void }) {
  const home = ctx.homeOf(h);
  const members = ctx.membersOf(h.id);
  return (
    <button type="button" className="m-row hh-mrow" onClick={onOpen}>
      <span className="hh-mrow-faces">{members.length > 0 ? <Faces sims={members} size={30} max={3} /> : <span className="hh-face-empty" />}</span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="t">{h.data.name.trim() || 'Unnamed'}</span>
        <span className="s">{plural(members.length, 'Sim')} · {home ? home.title : 'No home yet'}</span>
      </span>
      <CaretRight size={16} className="chev" />
    </button>
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

// ---------- Filter (same look as the Sims filter) ----------
type HomeKind = 'own' | 'rent' | 'apartment' | 'none';
type SizeKind = '1' | '2' | '3+';
export type HhFilters = { worlds: string[]; homes: HomeKind[]; sizes: SizeKind[]; kids: boolean; landlord: boolean };
const NO_HH_FILTERS: HhFilters = { worlds: [], homes: [], sizes: [], kids: false, landlord: false };
const HH_FILTER_KEY = (saveId: string) => `sd:hhFilters:${saveId}`;
/** Opens the Households list already filtered (from Today's "To sort"). */
export function presetHhFilter(saveId: string, patch: Partial<HhFilters>) {
  try { sessionStorage.setItem(HH_FILTER_KEY(saveId), JSON.stringify({ ...NO_HH_FILTERS, ...patch })); } catch { /* ignore */ }
}
function loadHhFilters(saveId: string): HhFilters {
  try { return { ...NO_HH_FILTERS, ...JSON.parse(sessionStorage.getItem(HH_FILTER_KEY(saveId)) ?? '{}') }; } catch { return NO_HH_FILTERS; }
}
const hhFilterCount = (f: HhFilters) => f.worlds.length + f.homes.length + f.sizes.length + (f.kids ? 1 : 0) + (f.landlord ? 1 : 0);
const HOME_LABEL: Record<HomeKind, string> = { own: 'Own it', rent: 'Rent', apartment: 'Apartment', none: 'No home yet' };
const SIZE_LABEL: Record<SizeKind, string> = { '1': '1 Sim', '2': '2 Sims', '3+': '3 or more' };
const KID_STAGES = new Set(['newborn', 'infant', 'toddler', 'child', 'teen']);

type Facts = { world: string | null; worldName: string; home: HomeKind; size: number; kids: boolean; landlord: boolean };
function hhFacts(ctx: HhCtx, h: HH): Facts {
  const home = ctx.homeOf(h);
  const tags = householdTags(h, ctx.owned, home);
  const members = ctx.membersOf(h.id);
  return {
    world: home?.world ?? null,
    worldName: home ? ctx.lots.worldName(home.world) : '',
    home: !home ? 'none' : tags.includes('Apartment') ? 'apartment' : tags.includes('Own it') ? 'own' : 'rent',
    size: members.length,
    kids: members.some((m) => KID_STAGES.has(stageOf(simAge(m.sim, ctx.lots.info.today, ctx.lots.info.table, ctx.lots.info.track)) ?? '')),
    landlord: tags.includes('Landlord'),
  };
}
function passes(x: Facts, f: HhFilters) {
  if (f.worlds.length && !(x.world && f.worlds.includes(x.world))) return false;
  if (f.homes.length && !f.homes.includes(x.home)) return false;
  if (f.sizes.length && !f.sizes.some((s) => (s === '3+' ? x.size >= 3 : x.size === Number(s)))) return false;
  if (f.kids && !x.kids) return false;
  if (f.landlord && !x.landlord) return false;
  return true;
}

function HhActiveFilters({ filters: f, onChange, worldName }: { filters: HhFilters; onChange(f: HhFilters): void; worldName(id: string): string }) {
  const items: { key: string; label: string; off(): HhFilters }[] = [
    ...f.worlds.map((w) => ({ key: `w${w}`, label: worldName(w), off: () => ({ ...f, worlds: f.worlds.filter((x) => x !== w) }) })),
    ...f.homes.map((h) => ({ key: `h${h}`, label: HOME_LABEL[h], off: () => ({ ...f, homes: f.homes.filter((x) => x !== h) }) })),
    ...f.sizes.map((s) => ({ key: `s${s}`, label: SIZE_LABEL[s], off: () => ({ ...f, sizes: f.sizes.filter((x) => x !== s) }) })),
    ...(f.kids ? [{ key: 'k', label: 'Kids at home', off: () => ({ ...f, kids: false }) }] : []),
    ...(f.landlord ? [{ key: 'l', label: 'Landlords', off: () => ({ ...f, landlord: false }) }] : []),
  ];
  if (!items.length) return null;
  return (
    <div className="row filter-tags" style={{ gap: 6 }}>
      {items.map((i) => (
        <span key={i.key} className="ftag">{i.label}
          <button type="button" aria-label={`Remove ${i.label}`} onClick={() => onChange(i.off())}><X size={11} weight="bold" /></button>
        </span>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange(NO_HH_FILTERS)}>Clear</button>
    </div>
  );
}

function HhFilterPanel({ filters: f, onChange, onClose, count, phone, worlds }: {
  filters: HhFilters; onChange(f: HhFilters): void; onClose(): void; count: number; phone: boolean; worlds: { id: string; label: string }[];
}) {
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const body = (
    <div className="stack filter-panel" style={{ gap: 18 }}>
      <Field label="World">
        {(id) => <Picker id={id} multiple placeholder="Type a world" value={f.worlds} onChange={(w) => onChange({ ...f, worlds: w })} options={worlds} />}
      </Field>
      <div className="field">
        <span className="label">Home</span>
        <div className="chip-row">
          {(Object.keys(HOME_LABEL) as HomeKind[]).map((h) => (
            <button key={h} type="button" className="fchip" aria-pressed={f.homes.includes(h)} onClick={() => onChange({ ...f, homes: toggle(f.homes, h) })}>{HOME_LABEL[h]}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">Size</span>
        <div className="chip-row">
          {(Object.keys(SIZE_LABEL) as SizeKind[]).map((s) => (
            <button key={s} type="button" className="fchip" aria-pressed={f.sizes.includes(s)} onClick={() => onChange({ ...f, sizes: toggle(f.sizes, s) })}>{SIZE_LABEL[s]}</button>
          ))}
        </div>
      </div>
      <div className="switch-list">
        <label className="switch-line"><span>Kids at home</span><Toggle label="Kids at home" on={f.kids} onChange={(v) => onChange({ ...f, kids: v })} /></label>
        <label className="switch-line"><span>Landlords</span><Toggle label="Landlords" on={f.landlord} onChange={(v) => onChange({ ...f, landlord: v })} /></label>
      </div>
    </div>
  );
  const show = `Show ${plural(count, 'household')}`;
  if (phone) {
    return (
      <Sheet title="Filter" onClose={onClose}>
        {body}
        <div className="stack" style={{ gap: 8, marginTop: 18 }}>
          <button type="button" className="m-pillbtn" onClick={onClose}>{show}</button>
          <button type="button" className="btn ghost" onClick={() => onChange(NO_HH_FILTERS)}>Clear all</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Modal title="Filter" onClose={onClose} autoFocus={false}
      footer={<><button type="button" className="btn ghost" onClick={() => onChange(NO_HH_FILTERS)}>Clear all</button><span className="grow" /><button type="button" className="btn primary" onClick={onClose}>{show}</button></>}>
      {body}
    </Modal>
  );
}
