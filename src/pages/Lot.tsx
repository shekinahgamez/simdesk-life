import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowSquareOut, Copy, MapPin, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { useStore } from '../store/store';
import { useLot, useLotResidents, useOwned, useWorlds } from '../store/hooks';
import { lotRec } from '../lib/lots';
import { uid } from '../lib/ids';
import type { BuildCredits, LotRecord } from '../lib/types';
import { AddPhotoButton, Empty, Field, Modal, Picker, toast } from '../components/ui';
import { ObjIcon } from '../components/categories';
import { LotForm } from '../components/LotForm';
import { NotesArea } from './SimProfile';

const LOT_TRAITS = [
  'Great Soil', 'Homey', 'Fresh Air', 'Quiet', 'Romantic Aura', 'Peace and Quiet', 'Natural Light', 'Convivial', 'Chef’s Kitchen',
  'Gremlins', 'Haunted', 'Filthy', 'Grody', 'Cursed', 'Party Place', 'Science Lair', 'Gym', 'Mean Vibe', 'Penny Pixies', 'Sunny Aspect',
  'Child’s Play', 'Teen Hangout', 'Bachelor Pad', 'Good Schools', 'Off the Grid', 'Private Beach', 'Island Spirits',
];

export default function LotPage() {
  const { lotId } = useParams();
  const nav = useNavigate();
  const lot = useLot(lotId);
  const worlds = useWorlds();
  const owned = useOwned();
  const residents = useLotResidents();
  const { recs, upsert, remove } = useStore();
  const [editing, setEditing] = useState(false);
  const [credits, setCredits] = useState(false);
  const [hist, setHist] = useState({ when: '', text: '' });
  const [active, setActive] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!lot) return <Empty title="That lot isn’t here." action={<Link className="btn" to="../worlds">Back to worlds</Link>} />;
  const world = worlds.find((w) => w.id === lot.worldId);
  const rec = lotRec(lot);
  const save = (patch: Partial<LotRecord>) => upsert('lot', { ...rec, ...patch });
  const hhs = (residents.get(lot.id) ?? []).map((id) => recs.household[id]).filter(Boolean);
  const clubs = Object.values(recs.club).filter((c) => c.lotId === lot.id);
  const hoods = (owned?.neighborhoods ?? []).filter((n) => n.world === lot.worldId).map((n) => n.name);
  const photo = lot.photos[active] ?? lot.photos[0];
  const c = rec.credits ?? {};

  return (
    <div className="page">
      <div className="crumbs"><Link to="../worlds">Worlds</Link> / {world ? <Link to={`../worlds/${world.id}`}>{world.name}</Link> : 'World'} / <span>{lot.name}</span></div>

      <section className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--r-xl)' }}>
        <div className="row" style={{ alignItems: 'stretch', gap: 0 }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <div style={{ aspectRatio: '16 / 10', background: 'var(--worlds-tint)', position: 'relative' }}>
              {photo ? (
                <img src={photo} alt={`${lot.name} build`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                  <ObjIcon cat="worlds" size="lg" />
                  <span className="small bold" style={{ color: 'var(--worlds-ink)' }}>Show off this build</span>
                </div>
              )}
            </div>
            <div className="row" style={{ gap: 8, padding: 10, flexWrap: 'nowrap', overflowX: 'auto' }}>
              {lot.photos.map((p, i) => (
                <div key={p + i} style={{ position: 'relative', flex: '0 0 auto' }}>
                  <button type="button" onClick={() => setActive(i)} style={{ padding: 0, border: i === active ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 12, cursor: 'pointer', background: 'none' }} aria-label={`Show photo ${i + 1}`}>
                    <img src={p} alt="" loading="lazy" style={{ width: 84, height: 60, objectFit: 'cover', borderRadius: 10 }} />
                  </button>
                  <button className="btn sm icon" style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22 }} aria-label={`Remove photo ${i + 1}`} onClick={() => { save({ photos: lot.photos.filter((_, k) => k !== i) }); setActive(0); }}><X size={11} weight="bold" /></button>
                </div>
              ))}
              <AddPhotoButton size={64} label="Add photos" maxSide={1600} onAdd={(url) => upsert('lot', { ...lotRec(lot), photos: [...(useStore.getState().recs.lot[lot.id]?.photos ?? lot.photos), url] })} />
            </div>
          </div>
          <div className="stack" style={{ flex: '1 1 300px', padding: 26, gap: 14 }}>
            <div>
              <h1 style={{ fontSize: 32 }}>{lot.name}</h1>
              {lot.originalName && lot.originalName !== lot.name && <div className="small muted">{lot.originalName} in the game</div>}
            </div>
            <div className="tags">
              {lot.lotType && <span className="tag worlds">{lot.lotType}</span>}
              {lot.neighborhood && <span className="tag outline">{lot.neighborhood}</span>}
              {lot.size && <span className="tag outline">{lot.size}</span>}
            </div>
            <dl className="kv">
              <dt>Owner</dt>
              <dd>{hhs.length ? hhs.map((h, i) => <span key={h.id}>{i > 0 && ', '}<Link to={`../households/${h.id}`}>{h.name}</Link></span>) : 'Nobody yet'}</dd>
              <dt>Game lot type</dt><dd>{lot.gameLotType || '—'}</dd>
              <dt>World</dt><dd>{world?.name ?? '—'}</dd>
            </dl>
            <div className="row" style={{ marginTop: 'auto' }}>
              <button className="btn" onClick={() => setEditing(true)}><PencilSimple size={16} weight="bold" /> Edit lot</button>
              {world && <Link className="btn ghost" to={`../worlds/${world.id}`}><MapPin size={16} weight="duotone" /> View on map</Link>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2>Build credits</h2><button className="btn sm" onClick={() => setCredits(true)}><PencilSimple size={14} /> Edit</button></div>
            {Object.values(c).some(Boolean) ? (
              <dl className="kv">
                <dt>Creator</dt><dd>{c.creator || '—'}</dd>
                <dt>EA ID (Gallery)</dt>
                <dd className="row" style={{ gap: 6 }}>
                  {c.eaId || '—'}
                  {c.eaId && <button className="btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(c.eaId!); toast('EA ID copied. Off to the Gallery!'); }}><Copy size={14} /> Copy</button>}
                </dd>
                <dt>Build name</dt><dd>{c.buildName || '—'}</dd>
                <dt>Edited</dt><dd>{c.edited || '—'}</dd>
              </dl>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Downloaded from the Gallery? Credit the builder here.</p>
            )}
            {c.link && <a className="btn sm" style={{ marginTop: 12 }} href={/^https?:/i.test(c.link) ? c.link : `https://${c.link}`} target="_blank" rel="noreferrer noopener"><ArrowSquareOut size={14} /> Open creator link</a>}
          </section>

          <section className="card">
            <div className="card-head"><h2>Lot traits</h2></div>
            <Picker label="Lot traits" multi max={3} placeholder="Add a lot trait" options={LOT_TRAITS.map((t) => ({ id: t, label: t }))} value={rec.lotTraits} onChange={(lotTraits) => save({ lotTraits })} allowCreate={(t) => t} tagClass="worlds" />
          </section>

          <section className="card">
            <div className="card-head"><h2>History</h2></div>
            {rec.history.length > 0 && (
              <ol className="stack" style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, gap: 0 }}>
                {rec.history.map((h, i) => (
                  <li key={h.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--worlds-ink)', marginTop: 4 }} />
                      {i < rec.history.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--line)' }} />}
                    </span>
                    <span className="grow" style={{ paddingBottom: 14 }}>
                      <span className="tiny muted bold">{h.when}</span>
                      <span style={{ display: 'block' }}>{h.text}</span>
                    </span>
                    <button className="btn ghost sm icon" aria-label="Remove entry" onClick={() => save({ history: rec.history.filter((x) => x.id !== h.id) })}><Trash size={14} /></button>
                  </li>
                ))}
              </ol>
            )}
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (!hist.text.trim()) return; save({ history: [...rec.history, { id: uid(), when: hist.when.trim() || 'Sometime', text: hist.text.trim() }] }); setHist({ when: '', text: '' }); }}>
              <input className="input" style={{ width: 140 }} aria-label="When" placeholder="Year 2, Fall" value={hist.when} onChange={(e) => setHist({ ...hist, when: e.target.value })} />
              <input className="input grow" aria-label="What happened" placeholder="Adaeze buys the lot" value={hist.text} onChange={(e) => setHist({ ...hist, text: e.target.value })} />
              <button className="btn" disabled={!hist.text.trim()}><Plus size={14} weight="bold" /> Add</button>
            </form>
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2>Connected</h2></div>
            {clubs.length === 0 && hhs.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>No households or clubs here yet.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {hhs.map((h) => <Link key={h.id} to={`../households/${h.id}`} className="row small" style={{ color: 'inherit', textDecoration: 'none' }}><ObjIcon cat="households" /> {h.name} lives here</Link>)}
                {clubs.map((c) => <Link key={c.id} to={`../clubs/${c.id}`} className="row small" style={{ color: 'inherit', textDecoration: 'none' }}><ObjIcon cat="clubs" /> {c.name} meets here</Link>)}
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h2>Notes</h2></div>
            <NotesArea value={rec.notes ?? ''} onChange={(notes) => save({ notes })} placeholder="Add a patio before Founders’ Day…" />
          </section>
          {lot.custom && <button className="btn ghost danger" onClick={() => setConfirmDelete(true)}><Trash size={16} /> Delete this lot</button>}
        </div>
      </div>

      {editing && world && <LotForm lot={lot} world={world} neighborhoods={hoods} onClose={() => setEditing(false)} />}
      {credits && <CreditsForm value={c} onClose={() => setCredits(false)} onSave={(credits) => { save({ credits }); setCredits(false); }} />}
      {confirmDelete && (
        <Modal title={`Delete ${lot.name}?`} onClose={() => setConfirmDelete(false)} footer={<><button className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button><button className="btn primary" onClick={() => { remove('lot', lot.id); nav(world ? `../worlds/${world.id}` : '../worlds'); }}>Delete lot</button></>}>
          <p style={{ margin: 0 }}>Its photos, history and notes go too. Households living here will need a new home.</p>
        </Modal>
      )}
    </div>
  );
}

function CreditsForm({ value, onClose, onSave }: { value: BuildCredits; onClose(): void; onSave(v: BuildCredits): void }) {
  const [v, setV] = useState<BuildCredits>(value);
  const f = (k: keyof BuildCredits, label: string, ph = '') => (
    <Field label={label}>{(id) => <input id={id} className="input" placeholder={ph} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value || undefined })} />}</Field>
  );
  return (
    <Modal title="Build credits" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onSave(v)}>Save</button></>}>
      <div className="form-grid">
        {f('creator', 'Creator', 'SweetbrickBuilds')}
        {f('eaId', 'EA ID', 'Their Gallery ID')}
        {f('buildName', 'Original build name')}
        {f('edited', 'Edited?', 'Yes, new kitchen')}
        <div className="full">{f('link', 'Creator link', 'https://…')}</div>
      </div>
    </Modal>
  );
}
