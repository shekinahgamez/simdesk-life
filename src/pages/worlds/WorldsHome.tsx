import { useEffect, useMemo, useState } from 'react';
import { CaretRight, Plus } from '@phosphor-icons/react';
import { BY_ID } from '../../data/game';
import { CheckList, FilterBar, FilterButton } from '../../components/pieces';
import { ObjIcon } from '../../components/categories';
import { Field, Modal, Picker, SearchBox, TextInput, toast } from '../../components/ui';
import {
  APARTMENT, applyLotFilters, BLANK_LOT, LOT_SIZES, lotData, lotFilterCount, lotTypeName, lotTypeOptions, NO_LOT_FILTERS, shownSize,
  type LotData, type LotFilters, type LotRow,
} from '../../lib/lots';
import { go, savePath } from '../../lib/router';
import { useStore } from '../../lib/sync/react';
import { matches, plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { MoreApts, useAptsInUse, useHouseholdCell } from '../households/shared';
import { ManageLotTypes } from './ManageLotTypes';
import { ChooseWorlds, PlaceAsk, PlaceFlow, useCustomLotTypes, useLotsCtx, useShouldAsk, WorldPicture, type LotsCtx } from './shared';

const FILTER_KEY = (saveId: string) => `sd:lotFilters:${saveId}`;
const load = <T,>(k: string, d: T): T => { try { const v = sessionStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } };

/** Worlds & lots: two tabs. Worlds (map tiles) and Lots (every lot in this save). */
export function WorldsHome({ save, tab }: { save: SaveRow; tab: 'worlds' | 'lots' }) {
  const ctx = useLotsCtx(save);
  const inUse = useAptsInUse();
  const phone = useIsPhone();
  const setTab = (t: 'worlds' | 'lots') => go(savePath(save.id, t === 'lots' ? 'worlds/lots' : 'worlds'), { replace: true });
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(null);
  const shouldAsk = useShouldAsk();
  const notPlaced = ctx.rows.filter((r) => !r.spot).length;
  const lotCount = ctx.rows.length + ctx.apartments.filter((a) => inUse.has(a.id)).length;

  const tabs = (
    <div className={phone ? 'm-seg worlds-tabs' : 'tabs'} role="tablist">
      {(['worlds', 'lots'] as const).map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'worlds' ? 'Worlds' : 'Lots'}</button>
      ))}
    </div>
  );
  const dialogs = (
    <>
      {adding && <LotForm ctx={ctx} lotId={null} onClose={() => setAdding(false)}
        onSaved={(id, name) => { setAdding(false); if (shouldAsk) setAsking({ id, name }); }} />}
      {asking && <PlaceAsk name={asking.name} onClose={() => setAsking(null)} onPlace={() => { setPlacing(asking.id); setAsking(null); }} />}
      {placing && <PlaceFlow ctx={ctx} lotId={placing} onClose={() => setPlacing(null)} />}
    </>
  );
  const body = tab === 'worlds' ? <WorldTiles ctx={ctx} save={save} phone={phone} /> : (
    <LotsList ctx={ctx} save={save} phone={phone} onAdd={() => setAdding(true)} onPlace={setPlacing} />
  );

  if (phone) {
    return (
      <div className="m-stack worlds-phone">
        <h1 className="m-h1" style={{ paddingTop: 6 }}>Worlds &amp; lots</h1>
        {tabs}
        {body}
        <button type="button" className="m-fab" aria-label="Add a lot" onClick={() => setAdding(true)}><Plus size={26} weight="bold" /></button>
        {dialogs}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <ObjIcon cat="worlds" size="lg" />
          <div>
            <h1>Worlds &amp; lots</h1>
            <div className="sub">{plural(ctx.shownWorlds.length, 'world')} · {plural(lotCount, 'lot')}{notPlaced ? ` · ${notPlaced} not placed` : ''}</div>
          </div>
        </div>
        <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={18} weight="bold" /> Add lot</button>
      </div>
      {tabs}
      {body}
      {dialogs}
    </div>
  );
}

// ---------- worlds ----------
function WorldTiles({ ctx, save, phone }: { ctx: LotsCtx; save: SaveRow; phone: boolean }) {
  const [q, setQ] = useState('');
  const [choosing, setChoosing] = useState(false);
  const shown = ctx.shownWorlds.filter((w) => !q.trim() || matches(w.name, q) || matches(w.game, q));
  const hiddenCount = ctx.worlds.length - ctx.shownWorlds.length;
  if (ctx.worlds.length === 0) return <div className="empty"><ObjIcon cat="worlds" size="lg" /><p>No worlds yet. Turn on packs in Save settings.</p></div>;
  return (
    <>
      {!phone && ctx.shownWorlds.length > 0 && <div style={{ maxWidth: 380 }}><SearchBox value={q} onChange={setQ} placeholder="Search worlds" /></div>}
      {ctx.shownWorlds.length > 0 && (shown.length === 0 ? <p className="muted">No worlds match that.</p> : (
        <div className="world-tiles">
          {shown.map((w) => (
            <a key={w.id} className="world-tile" href={savePath(save.id, `worlds/${w.id}`)}>
              <WorldPicture worldId={w.id} className="world-tile-pic" />
              <span className="world-tile-name"><b>{w.name}</b><span>{w.pack}</span></span>
            </a>
          ))}
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="worlds-hidden-row">
          <span className="grow"><b>{hiddenCount === ctx.worlds.length ? `All ${plural(hiddenCount, 'world')}` : `${plural(hiddenCount, 'more world')}`}</b> {hiddenCount === 1 ? 'is' : 'are'} hidden</span>
          <button type="button" className="btn sm" onClick={() => setChoosing(true)}>Choose worlds</button>
        </div>
      )}
      {hiddenCount === 0 && <div><button type="button" className="link-btn" onClick={() => setChoosing(true)}>Only play some of these? Choose your worlds</button></div>}
      {choosing && <ChooseWorlds ctx={ctx} save={save} onClose={() => setChoosing(false)} />}
    </>
  );
}

// ---------- lots ----------
function LotsList({ ctx, save, phone, onAdd, onPlace }: { ctx: LotsCtx; save: SaveRow; phone: boolean; onAdd(): void; onPlace(id: string): void }) {
  const hhCell = useHouseholdCell();
  const inUse = useAptsInUse();
  const [moreApts, setMoreApts] = useState(false);
  const [q, setQ] = useState('');
  const [f, setF] = useState<LotFilters>(() => load(FILTER_KEY(save.id), NO_LOT_FILTERS));
  useEffect(() => { try { sessionStorage.setItem(FILTER_KEY(save.id), JSON.stringify(f)); } catch { /* ignore */ } }, [f, save.id]);
  const apartments: LotRow[] = useMemo(() => ctx.apartments.map((a) => ({
    id: `apt:${a.id}`, lot: { ...BLANK_LOT, name: a.name, type: APARTMENT, size: '', spot: a.id }, spot: a, world: a.world,
  })), [ctx.apartments]);
  // Your lots first, then the game's apartments.
  const byName = (a: LotRow, b: LotRow) => a.lot.name.localeCompare(b.lot.name, undefined, { numeric: true });
  const usedApts = apartments.filter((a) => inUse.has(a.lot.spot!));
  const unusedApts = apartments.filter((a) => !inUse.has(a.lot.spot!));
  const all = useMemo(() => [...[...ctx.rows].sort(byName), ...[...usedApts].sort(byName)], [ctx.rows, usedApts.length, inUse]); // eslint-disable-line react-hooks/exhaustive-deps
  // Apartments nobody uses yet stay folded, unless you open them, search, or filter for apartments.
  const unfold = moreApts || !!q.trim() || f.types.includes(APARTMENT);
  const shown = [...applyLotFilters(all, f, q), ...(unfold ? applyLotFilters([...unusedApts].sort(byName), f, q) : [])];
  const unusedMatching = applyLotFilters(unusedApts, f, q).length;
  const more = <MoreApts count={q.trim() || f.types.includes(APARTMENT) ? 0 : unusedApts.length} open={moreApts} onToggle={() => setMoreApts((v) => !v)} />;
  const nf = lotFilterCount(f);
  const open = (r: LotRow) => go(savePath(save.id, r.id.startsWith('apt:') ? `worlds/apt/${r.id.slice(4)}` : `worlds/lot/${r.id}`));
  const usedIn = (r: LotRow) => (r.lot.type === APARTMENT && r.id.startsWith('apt:') ? ctx.bySpot.get(r.lot.spot!) : undefined);

  if (all.length === 0 && !unusedApts.length) {
    return (
      <div className="empty">
        <ObjIcon cat="worlds" size="lg" />
        <h2 style={{ fontSize: 18, margin: 0 }}>No lots yet</h2>
        <p>Add the lots you want in this save.</p>
        <button type="button" className="btn primary" onClick={onAdd}><Plus size={18} weight="bold" /> Add a lot</button>
      </div>
    );
  }
  const search = <SearchBox value={q} onChange={setQ} placeholder={`Search ${plural(all.length, 'lot')}`} />;
  const filterButtons = <LotFilterButtons ctx={ctx} f={f} onChange={setF} />;
  const clear = nf > 0 && <button type="button" className="p-clear" onClick={() => setF(NO_LOT_FILTERS)}>Clear</button>;

  if (phone) {
    const notPlaced = shown.filter((r) => !r.spot);
    const byWorld = new Map<string, LotRow[]>();
    const gameApts = shown.filter((x) => x.id.startsWith('apt:'));
    for (const r of shown.filter((x) => x.spot && !x.id.startsWith('apt:'))) byWorld.set(r.world!, [...(byWorld.get(r.world!) ?? []), r]);
    if (gameApts.length) byWorld.set('__apts', gameApts);
    return (
      <>
        <div className="m-search">{search}</div>
        <div className="p-bar p-scroll">{filterButtons}{clear}</div>
        {shown.length === 0 && !(unusedMatching && !unfold) && <p className="muted">No lots match that.</p>}
        {notPlaced.length > 0 && (
          <>
            <div className="m-label">Not placed · {notPlaced.length}</div>
            <div className="m-group">
              {notPlaced.map((r) => (
                <div key={r.id} className="m-row">
                  <button type="button" className="lot-row-main" onClick={() => open(r)}>
                    <span className="t">{r.lot.name}</span>
                    <span className="s">{[lotTypeName(r.lot.type), r.lot.size, r.lot.price != null && `§${r.lot.price.toLocaleString()}`].filter(Boolean).join(' · ')}</span>
                  </button>
                  <button type="button" className="place-pill" onClick={() => onPlace(r.id)}>Place</button>
                </div>
              ))}
            </div>
          </>
        )}
        {[...byWorld.entries()].sort((a, b) => (a[0] === '__apts' ? 1 : b[0] === '__apts' ? -1 : ctx.worldName(a[0]).localeCompare(ctx.worldName(b[0])))).map(([w, list]) => (
          <div key={w} className="stack" style={{ gap: 8 }}>
            <div className="m-label">{w === '__apts' ? 'Apartments' : ctx.worldName(w)} · {list.length}</div>
            <div className="m-group">
              {list.map((r) => (
                <button key={r.id} type="button" className="m-row" onClick={() => open(r)}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="t" style={{ display: 'block' }}>{r.lot.name}</span>
                    <span className="s" style={{ display: 'block' }}>{(r.id.startsWith('apt:') ? [ctx.worldName(r.world), ctx.hoodName(r.world, r.spot?.neighborhood), usedIn(r)?.lot.name] : [lotTypeName(r.lot.type), r.spot?.name]).filter(Boolean).join(' · ')}</span>
                  </span>
                  <CaretRight size={16} weight="bold" className="chev" />
                </button>
              ))}
            </div>
          </div>
        ))}
        {more}
      </>
    );
  }
  return (
    <>
      <FilterBar search={q} onSearch={setQ} searchLabel={`Search ${plural(all.length, 'lot')}`} active={nf > 0} onClear={() => setF(NO_LOT_FILTERS)}>{filterButtons}</FilterBar>
      {shown.length === 0 ? <p className="muted">No lots match that.</p> : (
        <div className="table-wrap">
          <table className="table lots-table">
            <thead><tr><th>Lot</th><th>Lot type</th><th>Size</th><th>Placed</th><th>Household</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const sz = shownSize(r);
                return (
                  <tr key={r.id} tabIndex={0} onClick={() => open(r)} onKeyDown={(e) => e.key === 'Enter' && open(r)}>
                    <td><b className="cell-main">{r.lot.name}</b>
                      {r.lot.price != null && <span className="cell-sub">§{r.lot.price.toLocaleString()}</span>}
                      {r.lot.type === APARTMENT && !r.id.startsWith('apt:') && r.lot.meantFor && !r.spot && <span className="cell-sub">For {BY_ID.lots.get(r.lot.meantFor)?.name}</span>}
                      {usedIn(r) && <span className="cell-sub">Using {usedIn(r)!.lot.name}</span>}
                    </td>
                    <td><LotTypeTag id={r.lot.type} /></td>
                    <td>{r.lot.type === APARTMENT ? '' : sz}{r.spot && r.lot.size && sz !== r.lot.size && r.lot.type !== APARTMENT && <span className="cell-sub">Originally {r.lot.size}</span>}</td>
                    <td>{r.spot ? <><span className="cell-main">{ctx.worldName(r.world)}</span><span className="cell-sub">{r.id.startsWith('apt:') ? ctx.hoodName(r.world, r.spot.neighborhood) : r.spot.name}</span></>
                      : <button type="button" className="place-pill" onClick={(e) => { e.stopPropagation(); onPlace(r.id); }}>Place</button>}</td>
                    <td>{hhCell(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {more}
    </>
  );
}

export function LotTypeTag({ id }: { id: string }) {
  return <span className="tag lot-type">{lotTypeName(id)}</span>;
}

function LotFilterButtons({ ctx, f, onChange }: { ctx: LotsCtx; f: LotFilters; onChange(f: LotFilters): void }) {
  return (
    <>
      <FilterButton label="Lot type" count={f.types.length}>
        {() => <CheckList search options={lotTypeOptions(ctx.info.avail).map((o) => ({ id: o.id, label: o.label }))} value={f.types} onChange={(types) => onChange({ ...f, types })} />}
      </FilterButton>
      <FilterButton label="World" title="Worlds" count={f.worlds.length}>
        {() => <CheckList options={ctx.worlds.map((w) => ({ id: w.id, label: ctx.worldName(w.id) }))} value={f.worlds} onChange={(worlds) => onChange({ ...f, worlds })} />}
      </FilterButton>
      <FilterButton label="Placed" count={f.placed === 'any' ? 0 : 1}>
        {(close) => <CheckList single options={[{ id: 'placed', label: 'Placed' }, { id: 'not', label: 'Not placed' }]} value={f.placed === 'any' ? [] : [f.placed]}
          onChange={(v) => { onChange({ ...f, placed: f.placed === v[0] ? 'any' : (v[0] as 'placed' | 'not') }); close(); }} />}
      </FilterButton>
      <FilterButton label="Size" count={f.sizes.length}>
        {() => <CheckList options={LOT_SIZES.map((x) => ({ id: x, label: x }))} value={f.sizes} onChange={(sizes) => onChange({ ...f, sizes })} />}
      </FilterButton>
    </>
  );
}

// ---------- add / edit ----------
type Form = Pick<LotData, 'name' | 'type' | 'size' | 'meantFor'> & { price: string };
/** Add a lot (name, lot type and size required; price optional) or edit one. Apartments ask which apartment instead of a size. */
export function LotForm({ ctx, lotId, name, onClose, onSaved }: { ctx: LotsCtx; lotId: string | null; /** New lot only: a name to start with. */ name?: string; onClose(): void; onSaved(id: string, name: string): void }) {
  const store = useStore();
  const customTypes = useCustomLotTypes();
  const rec = lotId ? store.get(lotId) : undefined;
  const start = useMemo<Form>(() => {
    const d = lotData(rec);
    return { name: d.name, type: d.type, size: d.size, meantFor: d.meantFor, price: d.price != null ? String(d.price) : '' };
  }, [lotId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState<Form>(() => (!lotId && name ? { ...start, name } : start));
  const [tried, setTried] = useState(false);
  const [managing, setManaging] = useState(false);
  const apt = f.type === APARTMENT;
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const missing = { name: !f.name.trim(), type: !f.type, size: !apt && !f.size };
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  const save = () => {
    setTried(true);
    if (missing.name || missing.type || missing.size) return;
    const price = f.price.trim() ? Number(f.price.replace(/[^\d.]/g, '')) : null;
    const base = lotData(rec);
    const data: LotData = { ...base, name: f.name.trim(), type: f.type, size: apt ? '' : f.size, meantFor: apt ? f.meantFor : null, price: Number.isFinite(price) ? price : null };
    // A lot that changes to or from an apartment can't stay where it was.
    if ((base.type === APARTMENT) !== apt) data.spot = null;
    const id = store.put('lot', data as unknown as Record<string, unknown>, lotId ?? undefined);
    if (lotId) toast('Saved');
    onSaved(id, data.name);
  };
  return (
    <Modal title={lotId ? 'Edit lot' : 'Add a lot'} onClose={onClose} dirty={dirty} className="pinned"
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={save}>{lotId ? 'Save' : 'Add lot'}</button></>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Lot name" hint={tried && missing.name ? <span className="field-err">Give it a name.</span> : undefined}>
          {(id) => <TextInput id={id} value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} aria-invalid={(tried && missing.name) || undefined} />}
        </Field>
        <Field label="Lot type" hint={tried && missing.type ? <span className="field-err">Pick a lot type.</span> : <button type="button" className="link-btn" onClick={() => setManaging(true)}>Manage your lot types</button>}>
          {(id) => <Picker id={id} placeholder="Pick a lot type" value={f.type ? [f.type] : []} onChange={(v) => set({ type: v[0] ?? '' })} options={lotTypeOptions(ctx.info.avail, f.type, customTypes.list)}
            onAdd={(label) => customTypes.add(label)} addLabel={(q) => `Add “${q}” as a lot type`} />}
        </Field>
        <div className="form-grid">
          {apt ? (
            <Field label="Meant for (optional)" hint="Which apartment you got it for.">
              {(id) => (
                <select id={id} className="select" value={f.meantFor ?? ''} onChange={(e) => set({ meantFor: e.target.value || null })}>
                  <option value="">None yet</option>
                  {ctx.apartments.map((a) => <option key={a.id} value={a.id}>{a.name} · {ctx.worldName(a.world)}</option>)}
                </select>
              )}
            </Field>
          ) : (
            <Field label="Size" hint={tried && missing.size ? <span className="field-err">Pick a size.</span> : undefined}>
              {(id) => (
                <select id={id} className="select" value={f.size} onChange={(e) => set({ size: e.target.value })} aria-invalid={(tried && missing.size) || undefined}>
                  <option value="">Pick a size</option>
                  {[...new Set([...LOT_SIZES, ...(f.size ? [f.size] : [])])].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </Field>
          )}
          <Field label="Price (optional)">
            {(id) => <TextInput id={id} inputMode="numeric" placeholder="§" value={f.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d,]/g, '') })} />}
          </Field>
        </div>
      </form>
      {managing && <ManageLotTypes onClose={() => setManaging(false)} />}
    </Modal>
  );
}
