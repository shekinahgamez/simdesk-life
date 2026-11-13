import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, DotsThree, HouseSimple, MapPin, PencilSimple, Plus, X } from '@phosphor-icons/react';
import { BY_ID } from '../../data/game';
import { PhotoBox, usePhotoPicker } from '../../components/photo';
import { PhoneBar } from '../../components/AzList';
import { BackLink } from '../../components/Shell';
import { CaretLeft } from '@phosphor-icons/react';
import { AutoText, Confirm, TextInput, toast } from '../../components/ui';
import { APARTMENT, lotData, RESIDENTIAL_RENTAL, type LotData } from '../../lib/lots';
import { newId } from '../../lib/sync/store';
import { go, savePath } from '../../lib/router';
import { useRecords, useStore } from '../../lib/sync/react';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { LotForm, LotTypeTag } from './WorldsHome';
import { applyPlace, PlaceFlow, useLotsCtx } from './shared';
import { homeKey } from '../../lib/households';
import { HhPill, PickHousehold, useHhCtx, useHouseholdCell } from '../households/shared';

/** One of your lots: photo, where it's placed, units (rentals), credits, lot traits, history and notes. */
export function LotPage({ save, lotId }: { save: SaveRow; lotId: string }) {
  const ctx = useLotsCtx(save);
  const hh = useHhCtx(save);
  const hhCell = useHouseholdCell();
  const store = useStore();
  const [movingIn, setMovingIn] = useState<string | null>(null);
  const phone = useIsPhone();
  const rec = store.get(lotId);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const picker = usePhotoPicker({ aspect: 16 / 10, saveId: save.id, title: 'Position your photo', label: 'Lot photo' });
  if (!rec || rec.kind !== 'lot') return <div className="page"><p>That lot isn’t here anymore.</p><a className="btn" href={savePath(save.id, 'worlds')}>Back to Worlds &amp; lots</a></div>;
  const lot = lotData(rec);
  const row = ctx.rows.find((r) => r.id === lotId)!;
  const apt = lot.type === APARTMENT;
  const update = (p: Partial<LotData>) => { const cur = store.get(lotId); if (cur) store.put('lot', { ...cur.data, ...p }, lotId); };
  const placedSize = row?.spot && !apt ? row.spot.size : lot.size;
  const where = row?.spot ? [ctx.worldName(row.world), row.spot.name, !apt && ctx.hoodName(row.world, row.spot.neighborhood)].filter(Boolean).join(' · ') : '';
  const takeOff = () => { update({ spot: null }); toast(`${lot.name} taken off the map`); };
  const photo = async () => { const p = lot.photo ? await picker.reposition(lot.photo) : await picker.pick(); if (p) update({ photo: p }); };
  const newPhoto = async () => { const p = await picker.pick(); if (p) update({ photo: p }); };
  const back = savePath(save.id, 'worlds/lots');

  const tags = (
    <div className="row" style={{ gap: 6 }}>
      <LotTypeTag id={lot.type} />
      {!apt && placedSize && <span className="tag outline">{placedSize}{row?.spot && lot.size && lot.size !== placedSize ? ` · Original size ${lot.size}` : ''}</span>}
    </div>
  );
  const rental = lot.type === RESIDENTIAL_RENTAL;
  const worldName = row?.spot ? ctx.worldName(row.world) : '';
  const placeRest = row?.spot ? [row.spot.name, !apt && ctx.hoodName(row.world, row.spot.neighborhood)].filter(Boolean).join(' · ') : '';
  // Rentals show who lives where on the unit tiles, so the household isn't repeated up here.
  const hhHere = row && !rental ? hhCell(row) : null;
  const kv = lot.price != null || (apt && lot.meantFor && !row?.spot) || hhHere;
  const facts = (
    <>
      {row?.spot && (
        <div className="lot-place" title={where}><MapPin size={16} weight="duotone" /><span><b>{worldName}</b>{placeRest ? ` · ${placeRest}` : ''}</span></div>
      )}
      {kv && (
        <dl className="kv lot-facts">
          {lot.price != null && <><dt>Price</dt><dd>§{lot.price.toLocaleString()}</dd></>}
          {apt && lot.meantFor && !row?.spot && <><dt>Meant for</dt><dd>{BY_ID.lots.get(lot.meantFor)?.name}</dd></>}
          {hhHere && <><dt>Household</dt><dd>{hhHere}</dd></>}
        </dl>
      )}
    </>
  );
  const placeBox = !row?.spot && (
    <div className="not-placed"><b>Not placed</b><button type="button" className="btn primary" onClick={() => setPlacing(true)}>Place it</button></div>
  );
  const actions = (
    <div className="row" style={{ gap: 8, position: 'relative' }}>
      <button type="button" className="btn" onClick={() => setEditing(true)}><PencilSimple size={16} /> Edit lot</button>
      {row?.spot && <button type="button" className="btn" onClick={() => setPlacing(true)}><MapPin size={16} weight="duotone" /> Move</button>}
      <Menu label="More" items={[
        ...(row?.spot ? [{ label: 'Take off the map', run: takeOff }] : []),
        { label: 'Delete lot', run: () => setDeleting(true), danger: true },
      ]} />
    </div>
  );
  const pic = lot.photo ? (
    <button type="button" className="lot-photo" onClick={photo} aria-label="Reposition photo"><PhotoBox photo={lot.photo} aspect={16 / 10} fill /></button>
  ) : (
    <button type="button" className="lot-photo empty-photo" onClick={newPhoto}><Camera size={26} weight="duotone" /><span>Show off this build</span></button>
  );
  const cards = (
    <>
      {rental && <Units lot={lot} onChange={(units) => update({ units })} onMoveIn={setMovingIn}
        who={(unit) => { const h = hh.livesIn.get(homeKey({ kind: 'lot', id: lotId, unit })); return h ? <HhPill name={hh.nameOf(h.id)} href={savePath(save.id, `households/${h.id}`)} /> : null; }} />}
      <TheBuild lot={lot} onSave={update} compact={phone} />
      {/* History is no longer added to (nothing fills it in). Older entries still show so nothing is lost. */}
      {lot.history.length > 0 && <History rows={lot.history} onChange={(history) => update({ history })} />}
      <div className="card lot-notes"><div className="card-head"><h2>Notes</h2></div>
        <AutoText label="Notes" value={lot.notes} onSave={(notes) => update({ notes })} placeholder="Anything worth remembering…" /></div>
    </>
  );
  const dialogs = (
    <>
      {editing && <LotForm ctx={ctx} lotId={lotId} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {placing && <PlaceFlow ctx={ctx} lotId={lotId} onClose={() => setPlacing(false)} />}
      {deleting && (
        <Confirm title={`Delete ${lot.name}?`} text="It goes to Trash for 7 days." onCancel={() => setDeleting(false)}
          actions={[{ label: 'Keep it', run: () => setDeleting(false) }, { label: 'Delete', kind: 'danger', run: () => { setDeleting(false); go(back); store.moveToTrash(lotId, lot.name); } }]} />
      )}
      {picker.ui}
      {movingIn && <PickHousehold ctx={hh} home={{ kind: 'lot', id: lotId, unit: movingIn }} onClose={() => setMovingIn(null)} />}
    </>
  );

  if (phone) {
    return (
      <div className="m-stack">
        <PhoneBar title="Lot" left={<a className="pp-round" href={back} aria-label="Back to Lots" style={{ marginLeft: -10 }}><CaretLeft size={20} weight="bold" /></a>} />
        {lot.photo ? (
          <>
            {pic}
            <h1 className="m-h1">{lot.name}</h1>
            {tags}
          </>
        ) : (
          <div className="lot-m-head">
            <button type="button" className="lot-photo-sm" onClick={newPhoto}><Camera size={22} weight="duotone" /><span>Add photo</span></button>
            <div className="lot-m-title"><h1 className="m-h1">{lot.name}</h1>{tags}</div>
          </div>
        )}
        {placeBox}
        {(row?.spot || lot.price != null) && <div className="m-group lot-m-facts">{facts}</div>}
        {actions}
        {cards}
        {dialogs}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 16 }}>
      <div className="crumbs"><a href={savePath(save.id, 'worlds')}>Worlds &amp; lots</a> / {row?.world ? <><a href={savePath(save.id, `worlds/${row.world}`)}>{ctx.worldName(row.world)}</a> / </> : <><a href={back}>Lots</a> / </>}{lot.name}</div>
      <div className="lot-hero card">
        {pic}
        <div className="lot-hero-info">
          <h1>{lot.name}</h1>
          {tags}
          {facts}
          {placeBox}
          <span className="grow" />
          {actions}
        </div>
      </div>
      <div className={`lot-cols${rental ? ' has-units' : ''}`}>{cards}</div>
      {dialogs}
    </div>
  );
}

function Units({ lot, onChange, who, onMoveIn }: { lot: LotData; onChange(u: LotData['units']): void; who(unit: string): ReactNode; onMoveIn(unit: string): void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const add = () => {
    const n = lot.units.length + 1;
    let label = `Unit ${String.fromCharCode(64 + Math.min(n, 26))}`;
    while (lot.units.some((u) => u.name === label)) label += '+';
    onChange([...lot.units, { id: newId(), name: label }]);
  };
  const rename = (id: string) => { if (name.trim()) onChange(lot.units.map((x) => (x.id === id ? { ...x, name: name.trim() } : x))); setEditing(null); };
  return (
    <div className="card">
      <div className="card-head"><h2>Units</h2><button type="button" className="btn sm" onClick={add}><Plus size={14} weight="bold" /> Add unit</button></div>
      {lot.units.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No units yet.</p> : (
        <div className="unit-tiles">
          {lot.units.map((u) => {
            const lives = who(u.id);
            return (
              <div key={u.id} className={`unit-tile${lives ? '' : ' is-empty'}`}>
                <div className="unit-top">
                  <span className="unit-ic" aria-hidden="true"><HouseSimple size={18} weight="duotone" /></span>
                  {editing !== u.id && (
                    <Menu label={`Options for ${u.name}`} small items={[
                      { label: 'Rename unit', run: () => { setEditing(u.id); setName(u.name); } },
                      ...(lives ? [] : [{ label: 'Move in', run: () => onMoveIn(u.id) }]),
                      { label: 'Remove unit', run: () => onChange(lot.units.filter((x) => x.id !== u.id)), danger: true },
                    ]} />
                  )}
                </div>
                {editing === u.id ? (
                  <form className="row" style={{ gap: 6, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); rename(u.id); }}>
                    <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={30} aria-label="Unit name"
                      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }} />
                    <button type="submit" className="btn sm primary">Save</button>
                  </form>
                ) : <div className="unit-name">{u.name}</div>}
                <div className="unit-sub">{lives ?? <><span className="muted">Empty ·</span> <button type="button" className="link-btn" onClick={() => onMoveIn(u.id)}><Plus size={13} weight="bold" /> Move in</button></>}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A small ⋯ menu. */
function Menu({ label, items, small }: { label: string; small?: boolean; items: { label: string; run(): void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="lot-menu" ref={ref}>
      <button type="button" className={`btn icon${small ? ' ghost sm' : ''}`} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <DotsThree size={small ? 18 : 20} weight="bold" />
      </button>
      {open && (
        <div className="combo-list more-menu" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.run(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Creator, the Gallery ID and name, and lot traits. Tap anywhere on it to edit right there. */
function TheBuild({ lot, onSave, compact }: { lot: LotData; onSave(p: Partial<LotData>): void; compact?: boolean }) {
  const [on, setOn] = useState(false);
  const [f, setF] = useState({ credits: '', galleryId: '', galleryName: '', traits: [] as string[] });
  const [trait, setTrait] = useState('');
  const start = () => { setF({ credits: lot.credits, galleryId: lot.galleryId, galleryName: lot.galleryName, traits: lot.traits }); setTrait(''); setOn(true); };
  const addTrait = () => { const t = trait.trim(); if (t && !f.traits.includes(t)) setF((x) => ({ ...x, traits: [...x.traits, t] })); setTrait(''); };
  const save = () => {
    const t = trait.trim();
    const traits = t && !f.traits.includes(t) ? [...f.traits, t] : f.traits;
    onSave({ credits: f.credits.trim(), galleryId: f.galleryId.trim(), galleryName: f.galleryName.trim(), traits });
    setOn(false);
  };
  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setOn(false); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [on]);
  const dash = (v: string) => (v ? v : <span className="muted">--</span>);
  const opens = (e: React.MouseEvent) => !(e.target as HTMLElement).closest('a, button, input, select, textarea, label');
  // Old credits could be several lines; the one-line view shows them on one.
  const creator = lot.credits.replace(/\s*\n+\s*/g, ', ');
  return (
    <section className={`card build-card${on ? ' editing' : ' can-edit'}`} onClick={on ? undefined : (e) => { if (opens(e)) start(); }}>
      <div className="card-head"><h2>The build</h2>
        {!on && <button type="button" className="btn ghost icon sm edit-pen" aria-label="Edit the build" onClick={start}><PencilSimple size={16} /></button>}
      </div>
      {!on && compact ? (
        <div>
          <dl className="build-kv">
            {creator && <><dt>Creator</dt><dd>{creator}</dd></>}
            {lot.galleryId && <><dt>Gallery ID</dt><dd>{lot.galleryId}</dd></>}
            {lot.galleryName && <><dt>Name on Gallery</dt><dd>{lot.galleryName}</dd></>}
            {lot.traits.length > 0 && <><dt>Lot traits</dt><dd><span className="tags">{lot.traits.map((t) => <span key={t} className="tag outline">{t}</span>)}</span></dd></>}
          </dl>
          {(() => {
            const empty = [!creator && 'Creator', !lot.galleryId && 'Gallery ID', !lot.galleryName && 'Gallery name', !lot.traits.length && 'Lot traits'].filter(Boolean);
            return empty.length > 0 ? <button type="button" className="link-btn m-add" onClick={start}><Plus size={14} weight="bold" /> {empty.join(', ')}</button> : null;
          })()}
        </div>
      ) : !on ? (
        <dl className="build-kv">
          <dt>Creator</dt><dd>{dash(creator)}</dd>
          <dt>Gallery ID</dt><dd>{dash(lot.galleryId)}</dd>
          <dt>Name on Gallery</dt><dd>{dash(lot.galleryName)}</dd>
          <dt>Lot traits</dt><dd>{lot.traits.length ? <span className="tags">{lot.traits.map((t) => <span key={t} className="tag outline">{t}</span>)}</span> : dash('')}</dd>
        </dl>
      ) : (
        <>
          <div className="build-kv edit">
            <label htmlFor="lb-creator">Creator</label>
            <TextInput id="lb-creator" value={f.credits} placeholder="--" maxLength={80} onChange={(e) => setF({ ...f, credits: e.target.value })} />
            <label htmlFor="lb-gid">Gallery ID</label>
            <div><TextInput id="lb-gid" value={f.galleryId} placeholder="--" maxLength={40} onChange={(e) => setF({ ...f, galleryId: e.target.value })} />
              <div className="hint">The creator’s EA ID, for searching the Gallery.</div></div>
            <label htmlFor="lb-gname">Name on Gallery</label>
            <div><TextInput id="lb-gname" value={f.galleryName} placeholder="--" maxLength={80} onChange={(e) => setF({ ...f, galleryName: e.target.value })} />
              <div className="hint">What the build is called on the Gallery.</div></div>
            <label htmlFor="lb-trait" className="top">Lot traits</label>
            <div>
              <TextInput id="lb-trait" value={trait} placeholder="Add a lot trait" maxLength={40} onChange={(e) => setTrait(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTrait(); } }} />
              {f.traits.length > 0 && (
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  {f.traits.map((t) => <span key={t} className="ftag">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setF((x) => ({ ...x, traits: x.traits.filter((y) => y !== t) }))}><X size={11} weight="bold" /></button></span>)}
                </div>
              )}
            </div>
          </div>
          <div className="edit-foot">
            <button type="button" className="btn" onClick={() => setOn(false)}>Cancel</button>
            <button type="button" className="btn primary" onClick={save}>Done</button>
          </div>
        </>
      )}
    </section>
  );
}

function History({ rows, onChange }: { rows: LotData['history']; onChange(v: LotData['history']): void }) {
  return (
    <div className="card">
      <div className="card-head"><h2>History</h2></div>
      {rows.map((r) => (
        <div key={r.id} className="history-row">
          <span className="muted">{r.when}</span><span className="grow">{r.text}</span>
          <button type="button" className="btn ghost icon sm" aria-label="Remove" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

/** One of the game's apartments: which downloaded apartment it's using, the ones saved for it, and notes. */
export function ApartmentPage({ save, gameId }: { save: SaveRow; gameId: string }) {
  const ctx = useLotsCtx(save);
  const store = useStore();
  const phone = useIsPhone();
  const notesRecs = useRecords('apt');
  const apt = ctx.apartments.find((a) => a.id === gameId);
  if (!apt) return <div className="page"><p>That apartment isn’t in this save.</p><a className="btn" href={savePath(save.id, 'worlds')}>Back to Worlds &amp; lots</a></div>;
  const using = ctx.bySpot.get(gameId) ?? null;
  const saved = ctx.rows.filter((r) => r.lot.type === APARTMENT && r.lot.meantFor === gameId && r.lot.spot !== gameId);
  const noteRec = notesRecs.find((r) => (r.data as { gameId?: string }).gameId === gameId);
  const use = (lotId: string | null) => {
    if (lotId) applyPlace(store, ctx.rows, lotId, gameId);
    else if (using) applyPlace(store, ctx.rows, using.id, null);
  };
  const open = (id: string) => go(savePath(save.id, `worlds/lot/${id}`));
  const body = (
    <>
      <div className="m-label">Using</div>
      <div className="m-group">
        {using ? (
          <div className="m-row">
            <button type="button" className="lot-row-main" onClick={() => open(using.id)}><span className="t">{using.lot.name}</span></button>
            <button type="button" className="btn ghost sm" onClick={() => use(null)}>Stop using</button>
          </div>
        ) : <div className="m-row"><span className="t">The game’s original</span></div>}
      </div>
      {saved.length > 0 && (
        <>
          <div className="m-label">Saved for this apartment · {saved.length}</div>
          <div className="m-group">
            {saved.map((r) => (
              <div key={r.id} className="m-row">
                <button type="button" className="lot-row-main" onClick={() => open(r.id)}><span className="t">{r.lot.name}</span>{r.lot.price != null && <span className="s">§{r.lot.price.toLocaleString()}</span>}</button>
                <button type="button" className="place-pill" onClick={() => use(r.id)}>Use this</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="m-label">Notes</div>
      <AutoText label="Notes" value={(noteRec?.data as { notes?: string } | undefined)?.notes ?? ''} placeholder="Anything worth remembering…"
        onSave={(notes) => store.put('apt', { gameId, notes }, noteRec?.id)} />
    </>
  );
  const head = (
    <>
      <div className="row" style={{ gap: 6 }}><LotTypeTag id={APARTMENT} /></div>
      <dl className="kv lot-facts"><dt>Placed on</dt><dd>{[ctx.worldName(apt.world), ctx.hoodName(apt.world, apt.neighborhood)].filter(Boolean).join(' · ')}</dd></dl>
    </>
  );
  if (phone) {
    return <div className="m-stack"><BackLink href={savePath(save.id, 'worlds/lots')} label="Lots" /><h1 className="m-h1">{apt.name}</h1>{head}{body}</div>;
  }
  return (
    <div className="page stack" style={{ gap: 16, maxWidth: 760 }}>
      <div className="crumbs"><a href={savePath(save.id, 'worlds')}>Worlds &amp; lots</a> / <a href={savePath(save.id, `worlds/${apt.world}`)}>{ctx.worldName(apt.world)}</a> / {apt.name}</div>
      <div className="page-head"><div><h1>{apt.name}</h1></div></div>
      {head}
      <div className="stack" style={{ gap: 10 }}>{body}</div>
    </div>
  );
}

