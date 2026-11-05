import { useState, type ReactNode } from 'react';
import { Camera, MapPin, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { BY_ID } from '../../data/game';
import { PhotoBox, usePhotoPicker } from '../../components/photo';
import { BackLink } from '../../components/Shell';
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
  const where = row?.spot ? [ctx.worldName(row.world), row.spot.name, !apt && row.spot.neighborhood].filter(Boolean).join(' · ') : '';
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
  const facts = (
    <dl className="kv lot-facts">
      {row?.spot && <><dt>Placed on</dt><dd>{where}</dd></>}
      {lot.price != null && <><dt>Price</dt><dd>§{lot.price.toLocaleString()}</dd></>}
      {apt && lot.meantFor && !row?.spot && <><dt>Meant for</dt><dd>{BY_ID.lots.get(lot.meantFor)?.name}</dd></>}
      {row && hhCell(row) && <><dt>Household</dt><dd>{hhCell(row)}</dd></>}
    </dl>
  );
  const placeBox = !row?.spot && (
    <div className="not-placed"><b>Not placed</b><button type="button" className="btn primary" onClick={() => setPlacing(true)}>Place it</button></div>
  );
  const actions = (
    <div className="row" style={{ gap: 8 }}>
      <button type="button" className="btn" onClick={() => setEditing(true)}><PencilSimple size={16} /> Edit lot</button>
      {row?.spot && <button type="button" className="btn" onClick={() => setPlacing(true)}><MapPin size={16} weight="duotone" /> Move</button>}
      {row?.spot && <button type="button" className="btn ghost" onClick={takeOff}>Take off the map</button>}
    </div>
  );
  const pic = lot.photo ? (
    <button type="button" className="lot-photo" onClick={photo} aria-label="Reposition photo"><PhotoBox photo={lot.photo} aspect={16 / 10} fill /></button>
  ) : (
    <button type="button" className="lot-photo empty-photo" onClick={newPhoto}><Camera size={26} weight="duotone" /><span>Show off this build</span></button>
  );
  const cards = (
    <>
      {lot.type === RESIDENTIAL_RENTAL && <Units lot={lot} onChange={(units) => update({ units })} onMoveIn={setMovingIn}
        who={(unit) => { const h = hh.livesIn.get(homeKey({ kind: 'lot', id: lotId, unit })); return h ? <HhPill name={hh.nameOf(h.id)} href={savePath(save.id, `households/${h.id}`)} /> : null; }} />}
      <div className="card"><div className="card-head"><h2>Build credits</h2></div>
        <AutoText label="Build credits" value={lot.credits} onSave={(credits) => update({ credits })} placeholder="Who built it?" rows={2} /></div>
      <LotTraits value={lot.traits} onChange={(traits) => update({ traits })} />
      <History rows={lot.history} onChange={(history) => update({ history })} />
      <div className="card"><div className="card-head"><h2>Notes</h2></div>
        <AutoText label="Notes" value={lot.notes} onSave={(notes) => update({ notes })} placeholder="Anything worth remembering…" /></div>
      <div><button type="button" className="btn danger" onClick={() => setDeleting(true)}><Trash size={16} weight="duotone" /> Delete lot</button></div>
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
        <BackLink href={back} label="Lots" />
        {pic}
        <h1 className="m-h1">{lot.name}</h1>
        {tags}
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
      <div className="lot-cols">{cards}</div>
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
  return (
    <div className="card">
      <div className="card-head"><h2>Units</h2><button type="button" className="btn sm" onClick={add}><Plus size={14} weight="bold" /> Add unit</button></div>
      {lot.units.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No units yet.</p> : (
        <div className="unit-list">
          {lot.units.map((u) => (
            <div key={u.id} className="unit-row">
              {editing === u.id ? (
                <form className="row grow" style={{ gap: 6, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) onChange(lot.units.map((x) => (x.id === u.id ? { ...x, name: name.trim() } : x))); setEditing(null); }}>
                  <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={30} aria-label="Unit name" />
                  <button type="submit" className="btn sm primary">Save</button>
                </form>
              ) : (
                <>
                  <b>{u.name}</b>
                  <span className="grow row" style={{ gap: 6 }}>{who(u.id) ?? <><span className="muted small">Empty</span><button type="button" className="btn sm" onClick={() => onMoveIn(u.id)}>Move in</button></>}</span>
                  <button type="button" className="btn ghost icon sm" aria-label={`Rename ${u.name}`} onClick={() => { setEditing(u.id); setName(u.name); }}><PencilSimple size={15} /></button>
                  <button type="button" className="btn ghost icon sm" aria-label={`Remove ${u.name}`} onClick={() => onChange(lot.units.filter((x) => x.id !== u.id))}><X size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LotTraits({ value, onChange }: { value: string[]; onChange(v: string[]): void }) {
  const [text, setText] = useState('');
  const add = () => { const t = text.trim(); if (t && !value.includes(t)) onChange([...value, t]); setText(''); };
  return (
    <div className="card">
      <div className="card-head"><h2>Lot traits</h2></div>
      {value.length > 0 && (
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {value.map((t) => <span key={t} className="ftag">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><X size={11} weight="bold" /></button></span>)}
        </div>
      )}
      <form className="row" style={{ gap: 8, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <TextInput placeholder="Add a lot trait" value={text} onChange={(e) => setText(e.target.value)} maxLength={40} aria-label="Add a lot trait" />
        <button type="submit" className="btn" disabled={!text.trim()}>Add</button>
      </form>
    </div>
  );
}

function History({ rows, onChange }: { rows: LotData['history']; onChange(v: LotData['history']): void }) {
  const [when, setWhen] = useState('');
  const [text, setText] = useState('');
  return (
    <div className="card">
      <div className="card-head"><h2>History</h2></div>
      {rows.map((r) => (
        <div key={r.id} className="history-row">
          <span className="muted">{r.when}</span><span className="grow">{r.text}</span>
          <button type="button" className="btn ghost icon sm" aria-label="Remove" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}><X size={14} /></button>
        </div>
      ))}
      <form className="history-add" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onChange([...rows, { id: newId(), when: when.trim(), text: text.trim() }]); setWhen(''); setText(''); } }}>
        <TextInput placeholder="Year 2, Fall" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When" maxLength={30} />
        <TextInput placeholder="Adaeze buys the lot" value={text} onChange={(e) => setText(e.target.value)} aria-label="What happened" maxLength={120} />
        <button type="submit" className="btn" disabled={!text.trim()}><Plus size={14} weight="bold" /> Add</button>
      </form>
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
      <dl className="kv lot-facts"><dt>Placed on</dt><dd>{[ctx.worldName(apt.world), apt.neighborhood].filter(Boolean).join(' · ')}</dd></dl>
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

