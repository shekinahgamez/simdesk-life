import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Cake, FunnelSimple, Hourglass, ListPlus, PencilSimple, Plus, Sparkle, Trash, X } from '@phosphor-icons/react';
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
import { SimAvatar, useBirthdayView, useCustomTraits, useHouseholds, useSaveInfo, useSimRows, type SaveInfo } from './shared';

const FILTER_KEY = (saveId: string) => `sd:simFilters:${saveId}`;
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
  const [form, setForm] = useState(false);
  const [quick, setQuick] = useState(false);
  const [traits, setTraits] = useState(false);
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
    </>
  );

  if (phone) {
    return (
      <div className="m-stack sims-phone">
        <div className="row" style={{ justifyContent: 'space-between', paddingTop: 6 }}>
          <h1 className="m-h1">Sims</h1>
          <button type="button" className="btn ghost sm" style={{ color: 'var(--accent)' }} onClick={() => setQuick(true)}><ListPlus size={18} /> Quick add</button>
        </div>
        <SimsSwitch saveId={save.id} on="sims" />
        {all.length === 0 ? (
          <EmptySims onAdd={() => setForm(true)} onQuick={() => setQuick(true)} phone />
        ) : (
          <>
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <div className="m-search grow"><SearchBox value={q} onChange={setQ} placeholder={`Search ${plural(searchCount, 'Sim')}`} /></div>
              <button type="button" className="btn icon filter-btn" aria-label={nf ? `Filter, ${nf} on` : 'Filter'} onClick={() => setShowFilter(true)}>
                <FunnelSimple size={20} weight="bold" />{nf > 0 && <span className="count">{nf}</span>}
              </button>
            </div>
            {tags}
            {shown.length === 0 ? <p className="muted">No Sims match that.</p> : (
              <div className="sim-grid">
                {shown.map((r) => <SimCard key={r.id} r={r} info={info} view={view} onOpen={() => open(r.id)} />)}
              </div>
            )}
          </>
        )}
        <button type="button" className="m-fab" aria-label="New Sim" onClick={() => setForm(true)}><Plus size={26} weight="bold" /></button>
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
          </div>
          {tags}
          {shown.length === 0 ? <p className="muted">No Sims match that.</p> : (
            <div className="table-wrap">
              <table className="table sims-table">
                <thead>
                  <tr>
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
                      <tr key={r.id} tabIndex={0} onClick={() => open(r.id)} onKeyDown={(e) => e.key === 'Enter' && open(r.id)}>
                        <td><span className="sim-cell"><SimAvatar sim={r.sim} />{r.name}</span></td>
                        <td>{r.sim.deceased ? <span className="tag outline">Deceased</span> : <span className="tag sims ink">{stageLabel(r.stage)}</span>}</td>
                        {realAges && <td>{r.realAge ? r.realAge.replace(/ old$/, '') : <span className="muted">–</span>}</td>}
                        <td>{r.household ? <span className="tag households ink">{r.household}</span> : <span className="muted">None</span>}</td>
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

function SimCard({ r, info, view, onOpen }: { r: SimRow; info: SaveInfo; view: BirthdayView; onOpen(): void }) {
  const b = birthdayCell(r.age, info.cal, view, !!r.sim.deceased);
  return (
    <button type="button" className="sim-card" onClick={onOpen}>
      {r.sim.portrait ? <PhotoBox photo={r.sim.portrait} aspect={1} size="thumb" className="sim-card-img" />
        : <span className="sim-card-img initials">{(r.sim.first[0] ?? '') + (r.sim.last[0] ?? '')}</span>}
      <span className="sim-card-body">
        <span className="sim-card-name"><b>{r.name}</b>{r.realAgeShort && <span className="sim-card-age">, {r.realAgeShort}</span>}</span>
        <span>{r.sim.deceased ? 'Deceased' : stageLabel(r.stage)}</span>
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
  const names = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const add = () => {
    for (const line of names) {
      const { first, last } = splitName(line);
      store.put('sim', {
        ...BLANK_SIM, first, last, householdId: household || null,
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
