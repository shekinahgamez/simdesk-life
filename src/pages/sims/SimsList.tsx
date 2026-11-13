import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Cake, CaretDown, CaretRight, Check, CheckSquare, FunnelSimple, Hourglass, HouseSimple, ListPlus, PencilSimple, Plus, Rows, Sparkle, SquaresFour, Trash, X } from '@phosphor-icons/react';
import { AzHeader, AzRail, azKey, letterOf, PhoneBar } from '../../components/AzList';
import { QuickButton } from '../../components/CommandBar';
import { cleanRotation } from '../../lib/rotation';
import { moduleOn, saveData } from '../../lib/saves';
import { Faces } from '../households/shared';
import { ObjIcon } from '../../components/categories';
import { PhotoBox } from '../../components/photo';
import { Confirm, Field, Modal, Picker, SearchBox, Seg, Sheet, TextInput, Toggle, toast } from '../../components/ui';
import { go, savePath } from '../../lib/router';
import {
  applyFilters, birthdayCell, filterCount, matchesSearch, NO_FILTERS, NO_HOUSEHOLD, sortRows, splitName, stageLabel, BLANK_SIM,
  type BirthdayView, type Filters, type Gender, type Sort, type SortKey, type SimRow,
} from '../../lib/sims';
import { plural } from '../../lib/text';
import { useRecords, useStore } from '../../lib/sync/react';
import { bornDayFor, STAGE_IDS, stageName, type StageId } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { SimForm } from './SimForm';
import { SimsSwitch } from '../households/HouseholdsList';
import { HouseholdPick } from './HouseholdPick';
import { SimAvatar, useBirthdayView, useCustomTraits, useHouseholds, useSaveInfo, useSimRows, type SaveInfo } from './shared';

const FILTER_KEY = (saveId: string) => `sd:simFilters:${saveId}`;
const LAYOUT_KEY = 'sd:simsLayout';
type GroupKey = 'az' | 'household' | 'stage' | 'recent';
const GROUP_KEY = 'sd:simsGroup';
const GROUPS: { id: GroupKey; label: string; sub: string }[] = [
  { id: 'az', label: 'A–Z', sub: 'By last name, with a jump strip' },
  { id: 'household', label: 'Household', sub: 'Playing now on top, each household folds' },
  { id: 'stage', label: 'Life stage', sub: 'Babies to elders' },
  { id: 'recent', label: 'Recently added', sub: 'Newest first' },
];
function loadGroup(): GroupKey {
  try { const g = localStorage.getItem(GROUP_KEY); return GROUPS.some((x) => x.id === g) ? (g as GroupKey) : 'az'; } catch { return 'az'; }
}
function loadLayout(): 'table' | 'gallery' {
  try { return localStorage.getItem(LAYOUT_KEY) === 'gallery' ? 'gallery' : 'table'; } catch { return 'table'; }
}
/** Opens the Sims list already filtered (from Today's "To sort"). */
export function presetSimsFilter(saveId: string, patch: Partial<Filters>) {
  try { sessionStorage.setItem(FILTER_KEY(saveId), JSON.stringify({ ...NO_FILTERS, ...patch })); } catch { /* ignore */ }
}
function loadFilters(saveId: string): Filters {
  try { return { ...NO_FILTERS, ...JSON.parse(sessionStorage.getItem(FILTER_KEY(saveId)) ?? '{}') }; } catch { return NO_FILTERS; }
}

/** The Sims page: table on desktop, photo grid on phones. Search, Filter, sorting, Quick add. */
export function SimsList({ save }: { save: SaveRow }) {
  const info = useSaveInfo(save);
  const realAges = info.d.realAges && info.track;
  const phone = useIsPhone();
  const all = useSimRows(info);
  const hh = useHouseholds();
  const [view, setView] = useBirthdayView();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(() => loadFilters(save.id));
  const [sort, setSort] = useState<Sort>({ key: 'name', dir: 1 });
  const [showFilter, setShowFilter] = useState(false);
  const [layout, setLayoutState] = useState<'table' | 'gallery'>(loadLayout);
  const setLayout = (l: 'table' | 'gallery') => { setLayoutState(l); try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* ignore */ } };
  const [group, setGroupState] = useState<GroupKey>(loadGroup);
  const setGroup = (g: GroupKey) => { setGroupState(g); try { localStorage.setItem(GROUP_KEY, g); } catch { /* ignore */ } };
  const [showGroup, setShowGroup] = useState(false);
  const [open1, setOpen1] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(false);
  const [quick, setQuick] = useState(false);
  const [traits, setTraits] = useState(false);
  // Pick a household right in the list (one Sim), or tick several and move them together.
  const [hhPick, setHhPick] = useState<{ ids: string[]; current: string | null | undefined; el: HTMLElement | null } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stopSelecting = () => { setSelecting(false); setPicked([]); };
  useEffect(() => { try { sessionStorage.setItem(FILTER_KEY(save.id), JSON.stringify(filters)); } catch { /* ignore */ } }, [filters, save.id]);

  const living = all.filter((r) => !r.sim.deceased).length;
  const deceased = all.length - living;
  const shown = useMemo(() => sortRows(applyFilters(all, filters).filter((r) => matchesSearch(r, q)), sort), [all, filters, q, sort]);
  const searchCount = filters.deceased ? deceased : living;
  const open = (id: string) => go(savePath(save.id, `sims/${id}`));
  const nf = filterCount(filters);

  const tags = (
    <ActiveFilters filters={filters} onChange={setFilters} nameOf={(id) => (id === NO_HOUSEHOLD ? 'No household' : hh.nameOf(id))} />
  );
  const filterUi = showFilter && (
    <FilterPanel filters={filters} onChange={setFilters} onClose={() => setShowFilter(false)} count={shown.length} phone={phone}
      view={view} onView={setView} />
  );
  const dialogs = (
    <>
      {filterUi}
      {form && <SimForm info={info} simId={null} onClose={() => setForm(false)} onSaved={(id, another) => { if (!another) { setForm(false); open(id); } }} />}
      {quick && <QuickAdd info={info} onClose={() => setQuick(false)} />}
      {traits && <CustomTraitsManager onClose={() => setTraits(false)} />}
      {hhPick && <HouseholdPick simIds={hhPick.ids} current={hhPick.current} anchor={hhPick.el} phone={phone}
        onClose={() => setHhPick(null)} onDone={hhPick.ids.length > 1 ? stopSelecting : undefined} />}
      {selecting && !hhPick && (
        <div className={`select-bar${phone ? ' phone' : ''}`} role="toolbar" aria-label="Picked Sims">
          <span className="grow"><b>{picked.length}</b> picked</span>
          <button type="button" className="btn ghost sm" onClick={stopSelecting}><X size={14} weight="bold" /> Cancel</button>
          <button type="button" className="btn primary sm" disabled={!picked.length}
            onClick={(e) => setHhPick({ ids: picked, current: undefined, el: e.currentTarget })}><HouseSimple size={15} weight="duotone" /> Move to household</button>
        </div>
      )}
    </>
  );
  const selectBtn = (
    <button type="button" className={`btn${phone ? ' ghost sm' : ''}`} aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
      <CheckSquare size={18} weight={selecting ? 'fill' : 'regular'} /> {selecting ? 'Done' : 'Select'}
    </button>
  );

  if (phone) {
    const d = saveData(save);
    const playing = moduleOn(d, 'rotation') ? cleanRotation(d.rotation).current : null;
    const noHh = all.filter((r) => !r.sim.deceased && !r.sim.householdId).length;
    const searching = q.trim() !== '' || nf > 0 || selecting;
    const sections = groupSims(shown, group, hh.nameOf, playing, sort);
    const tick = (r: SimRow) => (selecting ? <span className={`pick-tick${picked.includes(r.id) ? ' on' : ''}`} aria-hidden="true">{picked.includes(r.id) && <Check size={14} weight="bold" />}</span> : null);
    const rowEl = (r: SimRow) => {
      const b = birthdayCell(r.age, info.cal, view, !!r.sim.deceased);
      return (
      <button key={r.id} type="button" className={`m-row sim-mrow${selecting && picked.includes(r.id) ? ' picked' : ''}`} aria-pressed={selecting ? picked.includes(r.id) : undefined}
        onClick={() => (selecting ? togglePick(r.id) : open(r.id))}>
        {tick(r)}
        <SimAvatar sim={r.sim} size={36} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="t">{r.name}</span>
          <span className="s">{[r.realAgeShort, r.sim.deceased ? 'Deceased' : stageLabel(r.stage), r.sim.planned ? 'Planned' : '', r.sim.townie ? 'Townie' : ''].filter(Boolean).join(' · ')}{b?.soon && <> · <span className="sim-card-bday"><Cake size={13} weight="duotone" /> Birthday {view === 'date' ? `on ${b.text}` : b.text}</span></>}</span>
        </span>
        {group !== 'household' && (r.household ? <span className="hh">{r.household}</span> : !r.sim.deceased && <span className="hh none">No household</span>)}
      </button>
      );
    };
    const letters = group === 'az' && !searching && shown.length >= 12 ? [...new Set(sections.map((x) => x.key))] : [];
    return (
      <div className="m-stack sims-phone">
        <PhoneBar title="Sims" right={<>
          {all.length > 0 && <button type="button" className="btn ghost icon" aria-label={selecting ? 'Done selecting' : 'Select Sims'} aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}><CheckSquare size={22} weight={selecting ? 'fill' : 'regular'} /></button>}
          {!selecting && <button type="button" className="btn ghost icon" aria-label="Quick add" onClick={() => setQuick(true)}><ListPlus size={22} /></button>}
          <QuickButton />
        </>} />
        <SimsSwitch saveId={save.id} on="sims" />
        {all.length === 0 ? (
          <EmptySims onAdd={() => setForm(true)} onQuick={() => setQuick(true)} phone />
        ) : (
          <>
            <div className="tb-row">
              <div className="m-search grow"><SearchBox value={q} onChange={setQ} placeholder="Search" /></div>
              <button type="button" className="tb-btn" aria-label={`Group and view: ${GROUPS.find((g) => g.id === group)!.label}`} onClick={() => setShowGroup(true)}>
                <Rows size={18} /> {GROUPS.find((g) => g.id === group)!.label} <CaretDown size={12} weight="bold" />
              </button>
              <button type="button" className="btn icon filter-btn" aria-label={nf ? `Filter, ${nf} on` : 'Filter'} onClick={() => setShowFilter(true)}>
                <FunnelSimple size={20} weight="bold" />{nf > 0 && <span className="count">{nf}</span>}
              </button>
            </div>
            {noHh > 0 && !filters.households.includes(NO_HOUSEHOLD) && !q.trim() && (
              <button type="button" className="attn-row" onClick={() => setFilters({ ...NO_FILTERS, households: [NO_HOUSEHOLD] })}>
                <span className="ico"><HouseSimple size={18} weight="duotone" /></span><span><b>{plural(noHh, 'Sim')}</b> with no household</span>
                <span className="go">Sort them <CaretRight size={14} weight="bold" /></span>
              </button>
            )}
            {tags}
            {shown.length === 0 ? <p className="muted">No Sims match that.</p> : layout === 'gallery' ? (
              <div className="sim-grid">
                {shown.map((r) => <SimCard key={r.id} r={r} info={info} view={view} onOpen={() => (selecting ? togglePick(r.id) : open(r.id))} picked={selecting ? picked.includes(r.id) : undefined} />)}
              </div>
            ) : (
              <div className="az-list">
                {sections.map((sec) => {
                  const folded = group === 'household' && !searching && !(open1[sec.key] ?? sec.key === playing);
                  return (
                    <div key={sec.key} className="az-sec">
                      {sec.band && <div className={`az-band ${sec.band.tone}`}>{sec.band.label}</div>}
                      {group === 'az' ? <AzHeader letter={sec.key} /> : group === 'stage' ? <div className="az-band">{sec.label} · {sec.rows.length}</div> : null}
                      {group === 'household' && (
                        <button type="button" className="az-hhead" aria-expanded={!folded} onClick={() => setOpen1({ ...open1, [sec.key]: folded })}>
                          <span className="caret"><CaretDown size={16} weight="bold" /></span>
                          {sec.rows.length > 0 && <Faces sims={sec.rows} size={28} max={2} />}
                          <span className="t">{sec.label}</span><span className="n">{plural(sec.rows.length, 'Sim')}</span>
                        </button>
                      )}
                      {!folded && <div className={group === 'az' ? 'az-card' : undefined}>{sec.rows.map(rowEl)}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            <AzRail letters={letters} />
          </>
        )}
        {!selecting && <button type="button" className="m-fab" aria-label="New Sim" onClick={() => setForm(true)}><Plus size={26} weight="bold" /></button>}
        {showGroup && (
          <Sheet title="Show Sims" onClose={() => setShowGroup(false)}>
            <div className="m-label" style={{ padding: '0 4px 6px' }}>Group by</div>
            <div className="m-group" role="radiogroup" aria-label="Group by">
              {GROUPS.map((g) => (
                <button key={g.id} type="button" role="radio" aria-checked={group === g.id} className="opt" onClick={() => { setGroup(g.id); setShowGroup(false); }}>
                  <span><span className="t">{g.label}</span><span className="s">{g.sub}</span></span>
                  {group === g.id && <span className="ck"><Check size={20} weight="bold" /></span>}
                </button>
              ))}
            </div>
            <div className="m-label" style={{ padding: '14px 4px 6px' }}>Look</div>
            <Seg label="Look" value={layout} onChange={(l) => { setLayout(l); setShowGroup(false); }} options={[{ v: 'table', label: 'Rows' }, { v: 'gallery', label: 'Photos' }]} />
            <p className="muted small" style={{ margin: '12px 4px 0' }}>SimDesk remembers this on this device.</p>
          </Sheet>
        )}
        {dialogs}
      </div>
    );
  }

  const th = (key: SortKey, label: string) => (
    <button type="button" className={`th-sort ${sort.key === key ? 'on' : ''}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
      aria-label={`Sort by ${label}`}>
      {label}{sort.key === key && (sort.dir === 1 ? <ArrowDown size={12} weight="bold" /> : <ArrowUp size={12} weight="bold" />)}
    </button>
  );

  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <ObjIcon cat="sims" size="lg" />
          <div>
            <h1>Sims</h1>
            <div className="sub">{plural(living, 'living', 'living')}{deceased ? ` · ${deceased} deceased` : ''}</div>
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setTraits(true)}><Sparkle size={18} weight="duotone" /> Your traits</button>
          <button type="button" className="btn" onClick={() => setQuick(true)}><ListPlus size={18} /> Quick add</button>
          <button type="button" className="btn primary" onClick={() => setForm(true)}><Plus size={18} weight="bold" /> New Sim</button>
        </div>
      </div>
      {all.length === 0 ? <EmptySims onAdd={() => setForm(true)} onQuick={() => setQuick(true)} /> : (
        <>
          <div className="row" style={{ gap: 10 }}>
            <SimsSwitch saveId={save.id} on="sims" />
            <div style={{ flex: '0 1 380px' }}><SearchBox value={q} onChange={setQ} placeholder={`Search ${plural(searchCount, 'Sim')}`} /></div>
            <button type="button" className="btn filter-btn" onClick={() => setShowFilter(true)}>
              <FunnelSimple size={18} weight="bold" /> Filter{nf > 0 && <span className="count">{nf}</span>}
            </button>
            <span className="grow" />
            {selectBtn}
            <span className="view-switch" role="group" aria-label="View">
              <button type="button" aria-pressed={layout === 'table'} aria-label="List" title="List" onClick={() => setLayout('table')}><Rows size={20} weight={layout === 'table' ? 'fill' : 'regular'} /></button>
              <button type="button" aria-pressed={layout === 'gallery'} aria-label="Gallery" title="Gallery" onClick={() => setLayout('gallery')}><SquaresFour size={20} weight={layout === 'gallery' ? 'fill' : 'regular'} /></button>
            </span>
          </div>
          {tags}
          {shown.length === 0 ? <p className="muted">No Sims match that.</p> : layout === 'gallery' ? (
            <div className="sim-grid gallery">
              {shown.map((r) => <SimCard key={r.id} r={r} info={info} view={view} onOpen={() => (selecting ? togglePick(r.id) : open(r.id))} household picked={selecting ? picked.includes(r.id) : undefined} />)}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table sims-table">
                <thead>
                  <tr>
                    {selecting && <th className="pick-col"><input type="checkbox" aria-label="Pick all shown" checked={shown.length > 0 && shown.every((r) => picked.includes(r.id))}
                      onChange={(e) => setPicked(e.target.checked ? shown.map((r) => r.id) : [])} /></th>}
                    <th>{th('name', 'Sim')}</th>
                    <th>{th('stage', 'Life stage')}</th>
                    {realAges && <th>Age</th>}
                    <th>{th('household', 'Household')}</th>
                    <th>
                      <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        {th('birthday', 'Birthday')}
                        <span className="mini-seg" role="group" aria-label="Show birthdays as">
                          <button type="button" aria-pressed={view === 'countdown'} onClick={() => setView('countdown')}>In days</button>
                          <button type="button" aria-pressed={view === 'date'} onClick={() => setView('date')}>Date</button>
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const b = birthdayCell(r.age, info.cal, view, !!r.sim.deceased);
                    return (
                      <tr key={r.id} tabIndex={0} className={selecting && picked.includes(r.id) ? 'picked' : ''}
                        onClick={() => (selecting ? togglePick(r.id) : open(r.id))} onKeyDown={(e) => e.key === 'Enter' && (selecting ? togglePick(r.id) : open(r.id))}>
                        {selecting && <td className="pick-col"><input type="checkbox" aria-label={`Pick ${r.name}`} checked={picked.includes(r.id)} onChange={() => togglePick(r.id)} onClick={(e) => e.stopPropagation()} /></td>}
                        <td><span className="sim-cell"><SimAvatar sim={r.sim} />{r.name}</span></td>
                        <td>{r.sim.deceased ? <span className="tag outline">Deceased</span> : <span className="tag sims ink">{stageLabel(r.stage)}</span>}{r.sim.planned && <span className="tag outline" style={{ marginLeft: 6 }}>Planned</span>}{r.sim.townie && <span className="tag outline" style={{ marginLeft: 6 }}>Townie</span>}</td>
                        {realAges && <td>{r.realAge ? r.realAge.replace(/ old$/, '') : <span className="muted">–</span>}</td>}
                        <td>
                          <button type="button" className={`hh-cell${r.household ? '' : ' none'}`} aria-label={`Household for ${r.name}: ${r.household || 'none'}. Change`}
                            onClick={(e) => { e.stopPropagation(); setHhPick({ ids: [r.id], current: r.sim.householdId ?? null, el: e.currentTarget }); }}>
                            {r.household ? <span className="tag households ink">{r.household}</span> : <span className="muted">None</span>}
                            <CaretDown size={12} weight="bold" className="hh-caret" aria-hidden="true" />
                          </button>
                        </td>
                        <td>{b && (b.final
                          ? <span className="final-chip"><Hourglass size={15} weight="duotone" /> {b.text}</span>
                          : <span className={b.soon ? 'soon-birthday' : ''}>{b.text}</span>)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {dialogs}
    </div>
  );
}

type Section = { key: string; label: string; rows: SimRow[]; band?: { label: string; tone: string } };
/** Splits the shown Sims into the phone list's sections. */
function groupSims(rows: SimRow[], group: GroupKey, hhName: (id: string) => string, playing: string | null | undefined, sort: Sort): Section[] {
  const byName = sortRows(rows, sort);
  if (group === 'az') {
    const m = new Map<string, SimRow[]>();
    for (const r of sortRows(rows, { key: 'name', dir: 1 })) {
      const l = letterOf(r.sim.last || r.sim.first);
      (m.get(l) ?? m.set(l, []).get(l)!).push(r);
    }
    return [...m.entries()].sort((a, b) => azKey(a[0]).localeCompare(azKey(b[0]))).map(([k, v]) => ({ key: k, label: k, rows: v }));
  }
  if (group === 'stage') {
    const m = new Map<string, SimRow[]>();
    for (const r of byName) { const k = r.sim.deceased ? 'deceased' : r.stage ?? 'none'; (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    const order = [...STAGE_IDS, 'none', 'deceased'] as string[];
    return [...m.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([k, v]) => ({ key: k, label: k === 'deceased' ? 'Deceased' : k === 'none' ? 'Age not set' : stageName(k as StageId), rows: v }));
  }
  if (group === 'recent') {
    const rec = [...rows].sort((a, b) => ((b.sim.addedDay ?? -1e9) - (a.sim.addedDay ?? -1e9)) || a.name.localeCompare(b.name));
    return [{ key: 'recent', label: 'Newest first', rows: rec }];
  }
  const m = new Map<string, SimRow[]>();
  for (const r of byName) { const k = r.sim.householdId || NO_HOUSEHOLD; (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  const secs: Section[] = [...m.entries()].map(([k, v]) => ({ key: k, label: k === NO_HOUSEHOLD ? 'No household' : hhName(k), rows: v }));
  const rank = (x: Section) => (x.key === playing ? 0 : x.key === NO_HOUSEHOLD ? 1 : 2);
  secs.sort((a, b) => rank(a) - rank(b) || azKey(a.label).localeCompare(azKey(b.label)));
  const first = secs.find((x) => rank(x) === 0), none = secs.find((x) => rank(x) === 1), firstRest = secs.find((x) => rank(x) === 2);
  if (first) first.band = { label: 'Playing now', tone: 'now' };
  if (none) none.band = { label: 'Needs a household', tone: 'none' };
  if (firstRest) firstRest.band = { label: 'All households', tone: '' };
  return secs;
}

function EmptySims({ onAdd, onQuick, phone }: { onAdd(): void; onQuick(): void; phone?: boolean }) {
  return (
    <div className="empty">
      <ObjIcon cat="sims" size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>No Sims yet. Time to make some!</h2>
      {!phone && <p>Add a Sim with their portrait, traits and age. You can tuck them into a household later.</p>}
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn primary" onClick={onAdd}><Plus size={18} weight="bold" /> Add your first Sim</button>
        <button type="button" className="btn" onClick={onQuick}><ListPlus size={18} /> Quick add</button>
      </div>
    </div>
  );
}

function SimCard({ r, info, view, onOpen, household, picked }: { r: SimRow; info: SaveInfo; view: BirthdayView; onOpen(): void; household?: boolean; picked?: boolean }) {
  const b = birthdayCell(r.age, info.cal, view, !!r.sim.deceased);
  return (
    <button type="button" className={`sim-card${picked ? ' picked' : ''}`} onClick={onOpen} aria-pressed={picked}>
      {picked !== undefined && <span className={`pick-tick${picked ? ' on' : ''}`} aria-hidden="true">{picked && <Check size={14} weight="bold" />}</span>}
      {r.sim.portrait ? <PhotoBox photo={r.sim.portrait} aspect={1} size="thumb" className="sim-card-img" />
        : <span className="sim-card-img initials">{(r.sim.first[0] ?? '') + (r.sim.last[0] ?? '')}</span>}
      <span className="sim-card-body">
        <span className="sim-card-name"><b>{r.name}</b>{r.realAgeShort && <span className="sim-card-age">, {r.realAgeShort}</span>}</span>
        <span>{r.sim.deceased ? 'Deceased' : stageLabel(r.stage)}{r.sim.planned ? ' · Planned' : ''}{r.sim.townie ? ' · Townie' : ''}</span>
        {household && (r.household ? <span className="sim-card-hh">{r.household}</span> : <span>No household</span>)}
        {b?.soon && <span className="sim-card-bday"><Cake size={13} weight="duotone" /> Birthday {view === 'date' ? `on ${b.text}` : b.text}</span>}
      </span>
    </button>
  );
}

function ActiveFilters({ filters: f, onChange, nameOf }: { filters: Filters; onChange(f: Filters): void; nameOf(id: string): string }) {
  const items: { key: string; label: string; off(): Filters }[] = [
    ...f.stages.map((s) => ({ key: `s${s}`, label: stageName(s), off: () => ({ ...f, stages: f.stages.filter((x) => x !== s) }) })),
    ...f.households.map((h) => ({ key: `h${h}`, label: nameOf(h), off: () => ({ ...f, households: f.households.filter((x) => x !== h) }) })),
    ...f.genders.map((g) => ({ key: `g${g}`, label: g === 'male' ? 'Male' : 'Female', off: () => ({ ...f, genders: f.genders.filter((x) => x !== g) }) })),
    ...(f.birthdayThisWeek ? [{ key: 'bw', label: 'Birthday this week', off: () => ({ ...f, birthdayThisWeek: false }) }] : []),
    ...(f.status !== 'any' ? [{ key: 'st', label: f.status === 'planned' ? 'Planned' : 'Created', off: () => ({ ...f, status: 'any' as const }) }] : []),
    ...(f.deceased ? [{ key: 'dc', label: 'Deceased', off: () => ({ ...f, deceased: false }) }] : []),
  ];
  if (!items.length) return null;
  return (
    <div className="row filter-tags" style={{ gap: 6 }}>
      {items.map((i) => (
        <span key={i.key} className="ftag">{i.label}
          <button type="button" aria-label={`Remove ${i.label}`} onClick={() => onChange(i.off())}><X size={11} weight="bold" /></button>
        </span>
      ))}
      <button type="button" className="btn ghost sm" onClick={() => onChange(NO_FILTERS)}>Clear</button>
    </div>
  );
}

function FilterPanel({ filters: f, onChange, onClose, count, phone, view, onView }: {
  filters: Filters; onChange(f: Filters): void; onClose(): void; count: number; phone: boolean; view: BirthdayView; onView(v: BirthdayView): void;
}) {
  const hh = useHouseholds();
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const body = (
    <div className="stack filter-panel" style={{ gap: 18 }}>
      <div className="field">
        <span className="label">Life stage</span>
        <div className="chip-row">
          {STAGE_IDS.map((s) => (
            <button key={s} type="button" className="fchip" aria-pressed={f.stages.includes(s)} onClick={() => onChange({ ...f, stages: toggle<StageId>(f.stages, s) })}>{stageName(s)}</button>
          ))}
        </div>
      </div>
      <Field label="Household">
        {(id) => <Picker id={id} multiple placeholder="Type a household" value={f.households} onChange={(households) => onChange({ ...f, households })}
          options={[...hh.list.map((h) => ({ id: h.id, label: hh.nameOf(h.id) })), { id: NO_HOUSEHOLD, label: 'No household' }]} />}
      </Field>
      <div className="field">
        <span className="label">Gender</span>
        <div className="chip-row">
          {(['male', 'female'] as Gender[]).map((g) => (
            <button key={g} type="button" className="fchip" aria-pressed={f.genders.includes(g)} onClick={() => onChange({ ...f, genders: toggle<Gender>(f.genders, g) })}>{g === 'male' ? 'Male' : 'Female'}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">In the game</span>
        <div className="chip-row">
          {([['created', 'Created'], ['planned', 'Planned']] as const).map(([v, l]) => (
            <button key={v} type="button" className="fchip" aria-pressed={f.status === v} onClick={() => onChange({ ...f, status: f.status === v ? 'any' : v })}>{l}</button>
          ))}
        </div>
      </div>
      <div className="switch-list">
        <label className="switch-line"><span>Birthday this week</span><Toggle label="Birthday this week" on={f.birthdayThisWeek} onChange={(v) => onChange({ ...f, birthdayThisWeek: v })} /></label>
        <label className="switch-line"><span>Show deceased Sims</span><Toggle label="Show deceased Sims" on={f.deceased} onChange={(v) => onChange({ ...f, deceased: v })} /></label>
      </div>
      {phone && (
        <div className="field">
          <span className="label">Show birthdays as</span>
          <Seg label="Show birthdays as" value={view} onChange={onView} options={[{ v: 'countdown', label: 'In 3 days' }, { v: 'date', label: 'Spring 11' }]} />
        </div>
      )}
    </div>
  );
  if (phone) {
    return (
      <Sheet title="Filter" onClose={onClose}>
        {body}
        <div className="stack" style={{ gap: 8, marginTop: 18 }}>
          <button type="button" className="m-pillbtn" onClick={onClose}>Show {plural(count, 'Sim')}</button>
          <button type="button" className="btn ghost" onClick={() => onChange(NO_FILTERS)}>Clear all</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Modal title="Filter" onClose={onClose} autoFocus={false}
      footer={<><button type="button" className="btn ghost" onClick={() => onChange(NO_FILTERS)}>Clear all</button><span className="grow" /><button type="button" className="btn primary" onClick={onClose}>Show {plural(count, 'Sim')}</button></>}>
      {body}
    </Modal>
  );
}

/** Paste or type a list of names, set what they share, add them all at once. */
function QuickAdd({ info, onClose }: { info: SaveInfo; onClose(): void }) {
  const store = useStore();
  const hh = useHouseholds();
  const [text, setText] = useState('');
  const [household, setHousehold] = useState('');
  const [stage, setStage] = useState<StageId>('youngAdult');
  const [planned, setPlanned] = useState(false);
  const names = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const add = () => {
    for (const line of names) {
      const { first, last } = splitName(line);
      store.put('sim', {
        ...BLANK_SIM, first, last, householdId: household || null, ...(planned ? { planned: true } : {}),
        bornDay: info.track ? bornDayFor({ stage, fresh: true }, info.today, info.table) : null,
        addedDay: info.track ? info.today : null,
        stage: info.track ? null : stage,
      });
    }
    toast(`${plural(names.length, 'Sim')} added`);
    onClose();
  };
  return (
    <Modal title="Quick add" onClose={onClose} dirty={text.trim() !== ''} className="pinned"
      footer={(close) => (<><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!names.length} onClick={add}>Add {names.length ? plural(names.length, 'Sim') : 'Sims'}</button></>)}>
      <div className="stack" style={{ gap: 16 }}>
        <p className="muted" style={{ margin: 0 }}>One Sim per line. The last word is their last name. You can fill in photos, traits and the rest later.</p>
        <Field label="Names">{(id) => <textarea id={id} className="textarea" rows={7} placeholder={'Marisol Okafor\nDesmond Okafor\nRafael Banks'} value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="words" autoCorrect="off" spellCheck={false} />}</Field>
        <div className="form-grid">
          <Field label="Household">
            {(id) => (
              <select id={id} className="select" value={household} onChange={(e) => setHousehold(e.target.value)}>
                <option value="">No household</option>
                {hh.list.map((h) => <option key={h.id} value={h.id}>{hh.nameOf(h.id)}</option>)}
              </select>
            )}
          </Field>
          <Field label="Life stage" hint={info.track ? 'Everyone starts fresh from Create a Sim. Change anyone’s age from their profile.' : undefined}>
            {(id) => (
              <select id={id} className="select" value={stage} onChange={(e) => setStage(e.target.value as StageId)}>
                {STAGE_IDS.map((s) => <option key={s} value={s}>{stageName(s)}</option>)}
              </select>
            )}
          </Field>
        </div>
        <label className="switch-line"><span>Planned <span className="muted small">(not created in the game yet)</span></span><Toggle label="Planned" on={planned} onChange={setPlanned} /></label>
      </div>
    </Modal>
  );
}

/** Your own traits: one list for every save. */
function CustomTraitsManager({ onClose }: { onClose(): void }) {
  const custom = useCustomTraits();
  const sims = useRecords('sim');
  const store = useStore();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const usedBy = (id: string) => sims.filter((r) => ((r.data as { traits?: string[] }).traits ?? []).includes(`custom:${id}`));
  return (
    <Modal title="Your traits" onClose={onClose} footer={<button type="button" className="btn primary" onClick={onClose}>Done</button>}>
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Traits you’ve added yourself, like mod traits. They work in every save.</p>
        <form className="row" style={{ gap: 8, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { custom.add(newName); setNewName(''); } }}>
          <TextInput placeholder="New trait name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} aria-label="New trait name" />
          <button type="submit" className="btn" disabled={!newName.trim()}><Plus size={16} weight="bold" /> Add</button>
        </form>
        {custom.list.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No traits of your own yet. You can also add one by typing it into a Sim’s traits.</p> : (
          <div className="trait-list">
            {custom.list.map((t) => (
              <div key={t.id} className="trait-row">
                {editing?.id === t.id ? (
                  <form className="row grow" style={{ gap: 6, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (editing.name.trim()) custom.rename(t.id, editing.name); setEditing(null); }}>
                    <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus maxLength={40} aria-label="Trait name" />
                    <button type="submit" className="btn sm primary">Save</button>
                  </form>
                ) : (
                  <>
                    <span className="grow"><b>{t.name}</b>{usedBy(t.id).length > 0 && <span className="muted small"> · {plural(usedBy(t.id).length, 'Sim')} in this save</span>}</span>
                    <button type="button" className="btn ghost icon sm" aria-label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })}><PencilSimple size={16} /></button>
                    <button type="button" className="btn ghost icon sm" aria-label={`Delete ${t.name}`} onClick={() => setRemoving(t)}><Trash size={16} weight="duotone" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {removing && (
        <Confirm title={`Delete ${removing.name}?`}
          text={usedBy(removing.id).length ? `It comes off ${plural(usedBy(removing.id).length, 'Sim')} in this save too.` : 'It’s removed from every save.'}
          onCancel={() => setRemoving(null)}
          actions={[
            { label: 'Keep it', run: () => setRemoving(null) },
            { label: 'Delete', kind: 'danger', run: () => {
              const t = removing;
              const tag = `custom:${t.id}`;
              const had = usedBy(t.id).map((r) => r.id);
              store.updateAll('sim', (d) => {
                const tr = (d.traits as string[] | undefined) ?? [];
                return tr.includes(tag) ? { ...d, traits: tr.filter((x) => x !== tag) } : null;
              });
              custom.remove(t.id);
              setRemoving(null);
              toast(`${t.name} deleted`, { label: 'Undo', run: () => {
                custom.restore(t);
                for (const id of had) {
                  const r = store.get(id);
                  if (r) store.put('sim', { ...r.data, traits: [...((r.data.traits as string[]) ?? []), tag] }, id);
                }
              } });
            } },
          ]} />
      )}
    </Modal>
  );
}
