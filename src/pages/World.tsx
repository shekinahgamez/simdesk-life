import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Crosshair, EyeSlash, MapTrifold, PencilSimple, Plus, X } from '@phosphor-icons/react';
import { useStore } from '../store/store';
import { useGameData } from '../data/gameData';
import { useLotResidents, useLots, useOwned, useWorlds } from '../store/hooks';
import { lotRec, pinKind, PIN_COLOR, worldRec } from '../lib/lots';
import { Empty, Field, Modal, PhotoPicker } from '../components/ui';
import { LotForm } from '../components/LotForm';

export default function WorldPage() {
  const { worldId } = useParams();
  const nav = useNavigate();
  const worlds = useWorlds();
  const allLots = useLots();
  const owned = useOwned();
  const residents = useLotResidents();
  const packs = useGameData((s) => s.data?.packs);
  const lotTypes = useGameData((s) => s.data?.lotTypes ?? []);
  const { recs, upsert } = useStore();
  const w = worlds.find((x) => x.id === worldId);
  const [hood, setHood] = useState('all');
  const [editing, setEditing] = useState(false);
  const [mapEdit, setMapEdit] = useState(false);
  const [addLot, setAddLot] = useState(false);
  const [pinning, setPinning] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const lots = useMemo(() => allLots.filter((l) => l.worldId === worldId), [allLots, worldId]);
  const hoods = useMemo(() => {
    const set = new Set<string>();
    for (const n of owned?.neighborhoods ?? []) if (n.world === worldId) set.add(n.name);
    for (const n of w?.rec?.customNeighborhoods ?? []) set.add(n);
    for (const l of lots) if (l.neighborhood) set.add(l.neighborhood);
    return [...set];
  }, [owned, worldId, w, lots]);
  const communityTypes = useMemo(() => new Set(lotTypes.filter((t) => t.kind !== 'residential').flatMap((t) => [t.id, t.name.toLowerCase()])), [lotTypes]);

  if (!w) return <Empty title="That world isn’t in this save." action={<Link className="btn" to="../worlds">Back to worlds</Link>} />;

  const shown = lots.filter((l) => hood === 'all' || l.neighborhood === hood);
  const numbered = lots.map((l, i) => ({ l, n: i + 1 }));
  const numOf = new Map(numbered.map((x) => [x.l.id, x.n]));
  const map = w.rec?.mapImage;
  const renamed = w.originalName && w.name !== w.originalName;
  const packName = packs?.find((p) => p.id === w.pack)?.name;

  const placePin = (e: React.MouseEvent) => {
    if (!pinning || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const l = lots.find((x) => x.id === pinning);
    if (l) upsert('lot', { ...lotRec(l), pin: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } });
    // move on to the next unpinned lot so pinning a whole world is quick
    const next = lots.find((x) => x.id !== pinning && !x.pin);
    setPinning(next?.id ?? null);
  };

  return (
    <div className="page">
      <div className="crumbs"><Link to="../worlds">Worlds</Link> / <span>{w.name}</span></div>
      <div className="page-head">
        <div>
          <h1>{w.name}</h1>
          <div className="sub">{[renamed ? w.originalName : null, w.custom ? 'Custom world' : packName, `${lots.length} lots`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setMapEdit(true)}><MapTrifold size={16} weight="duotone" /> Use my map</button>
          <button className="btn" onClick={() => setEditing(true)}><PencilSimple size={16} weight="bold" /> Edit world</button>
        </div>
      </div>

      {(w.rec?.inspiredBy || w.rec?.vibe) ? (
        <section className="card" style={{ background: 'var(--worlds-tint)', borderColor: 'transparent' }}>
          {w.rec?.inspiredBy && <div className="small"><span className="muted bold">Inspired by</span> <b style={{ fontSize: 16 }}>{w.rec.inspiredBy}</b></div>}
          {w.rec?.vibe && <p style={{ margin: '8px 0 0', lineHeight: 1.55 }}>{w.rec.vibe}</p>}
        </section>
      ) : (
        <button type="button" className="empty" style={{ padding: 20, background: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => setEditing(true)}>
          <span className="small muted">What’s the vibe? Add an “inspired by” and a few notes about how this place feels.</span>
        </button>
      )}

      {hoods.length > 0 && (
        <div className="chip-filter" role="group" aria-label="Neighborhoods">
          <button type="button" aria-pressed={hood === 'all'} onClick={() => setHood('all')}>All</button>
          {hoods.map((h) => <button key={h} type="button" aria-pressed={hood === h} onClick={() => setHood(h)}>{h}</button>)}
        </div>
      )}

      <section className="card" style={{ padding: 14 }}>
        {map ? (
          <>
            <div
              ref={mapRef}
              onClick={placePin}
              style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', cursor: pinning ? 'crosshair' : 'default', userSelect: 'none' }}
            >
              <img src={map} alt={`Map of ${w.name}`} style={{ width: '100%' }} draggable={false} />
              {lots.filter((l) => l.pin && (hood === 'all' || l.neighborhood === hood)).map((l) => {
                const kind = pinKind(l, residents.has(l.id), communityTypes);
                const c = PIN_COLOR[kind];
                return (
                  <Link
                    key={l.id}
                    to={`../lots/${l.id}`}
                    onClick={(e) => pinning && e.preventDefault()}
                    title={l.name}
                    aria-label={`${numOf.get(l.id)}. ${l.name}`}
                    style={{
                      position: 'absolute', left: `${l.pin!.x}%`, top: `${l.pin!.y}%`, transform: 'translate(-50%, -50%)', width: 28, height: 28,
                      borderRadius: '50%', background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, textDecoration: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.35)', border: '2px solid #fff',
                      outline: pinning === l.id ? '3px solid var(--accent)' : undefined,
                    }}
                  >
                    {numOf.get(l.id)}
                  </Link>
                );
              })}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <div className="row tiny muted" style={{ gap: 14 }}>
                {(['home', 'community', 'empty'] as const).map((k) => (
                  <span key={k} className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: PIN_COLOR[k].bg, border: '1px solid var(--line)' }} />{PIN_COLOR[k].label}</span>
                ))}
              </div>
              {pinning ? (
                <span className="row small">
                  <b>Click the map to place {lots.find((l) => l.id === pinning)?.name}</b>
                  <button className="btn sm" onClick={() => setPinning(null)}>Done pinning</button>
                </span>
              ) : (
                <button className="btn sm" disabled={!lots.length} onClick={() => setPinning(lots.find((l) => !l.pin)?.id ?? lots[0]?.id ?? null)}><Crosshair size={14} weight="bold" /> Place pins</button>
              )}
            </div>
          </>
        ) : (
          <div className="empty" style={{ border: 0, padding: 36, background: 'var(--worlds-tint)', borderRadius: 14 }}>
            <MapTrifold size={34} weight="duotone" color="var(--worlds-ink)" />
            <h2>No map yet</h2>
            <p>Add a screenshot of the world map (or your own drawing), then pin every lot on it.</p>
            <button className="btn primary" onClick={() => setMapEdit(true)}>Use my map</button>
          </div>
        )}
      </section>

      <section>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h2>Lots</h2>
          <button className="btn sm" onClick={() => setAddLot(true)}><Plus size={14} weight="bold" /> Add lot</button>
        </div>
        {shown.length === 0 ? (
          <Empty title="No lots here yet">Lots from the game data will show up here. You can also add your own.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pin</th><th>Lot</th><th>Size</th><th>Your lot type</th><th>Who’s there</th>{pinning !== null || map ? <th className="sr-only">Pin</th> : null}</tr></thead>
              <tbody>
                {shown.map((l) => {
                  const kind = pinKind(l, residents.has(l.id), communityTypes);
                  const hhNames = (residents.get(l.id) ?? []).map((id) => recs.household[id]?.name).filter(Boolean);
                  return (
                    <tr key={l.id} tabIndex={0} onClick={() => nav(`../lots/${l.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`../lots/${l.id}`)}>
                      <td><span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: PIN_COLOR[kind].bg, color: PIN_COLOR[kind].fg, border: '1px solid var(--line)' }}>{numOf.get(l.id)}</span></td>
                      <td>
                        <div className="bold">{l.name}</div>
                        <div className="tiny muted">{[l.name !== l.originalName ? l.originalName : null, l.neighborhood].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="small">{l.size ?? '—'}</td>
                      <td>{l.lotType ? <span className="tag worlds">{l.lotType}</span> : <span className="small muted">Assign type</span>}</td>
                      <td className="small">{hhNames.length ? hhNames.join(', ') : <span className="muted">Empty</span>}</td>
                      {map && (
                        <td onClick={(e) => e.stopPropagation()}>
                          {l.pin ? (
                            <button className="btn ghost sm icon" aria-label={`Remove pin for ${l.name}`} title="Remove pin" onClick={() => upsert('lot', { ...lotRec(l), pin: undefined })}><X size={14} /></button>
                          ) : (
                            <button className="btn ghost sm" onClick={() => setPinning(l.id)}>Pin it</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <WorldForm world={w} hoods={hoods} onClose={() => setEditing(false)} onHide={() => { upsert('world', { ...worldRec(w), hidden: true }); nav('../worlds'); }} />}
      {mapEdit && (
        <Modal title="Use my map" onClose={() => setMapEdit(false)} footer={<button className="btn primary" onClick={() => setMapEdit(false)}>Done</button>}>
          <p className="small muted" style={{ marginTop: 0 }}>A screenshot of the in-game map works great. Pins are stored as positions on the image, so they stay put.</p>
          <PhotoPicker value={map} onChange={(mapImage) => upsert('world', { ...worldRec(w), mapImage })} height={240} label="Upload a map image" maxSide={2000} />
        </Modal>
      )}
      {addLot && <LotForm world={w} neighborhoods={hoods} onClose={(r) => { setAddLot(false); if (r) nav(`../lots/${r.id}`); }} />}
    </div>
  );
}

function WorldForm({ world, hoods, onClose, onHide }: { world: ReturnType<typeof useWorlds>[number]; hoods: string[]; onClose(): void; onHide(): void }) {
  const { upsert } = useStore();
  const [r, setR] = useState(() => worldRec(world));
  const [newHood, setNewHood] = useState('');
  return (
    <Modal
      title={`Edit ${world.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" style={{ marginRight: 'auto' }} onClick={onHide}><EyeSlash size={16} /> Hide world</button>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => { upsert('world', r); onClose(); }}>Save changes</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <Field label="Your name for this world" hint={world.originalName ? `In the game it’s ${world.originalName}.` : undefined}>
          {(id) => <input id={id} className="input" placeholder={world.originalName} value={r.name ?? ''} onChange={(e) => setR({ ...r, name: e.target.value || undefined })} />}
        </Field>
        <Field label="Inspired by">{(id) => <input id={id} className="input" placeholder="New Orleans" value={r.inspiredBy ?? ''} onChange={(e) => setR({ ...r, inspiredBy: e.target.value || undefined })} />}</Field>
        <Field label="Vibe notes">{(id) => <textarea id={id} className="textarea" placeholder="Humid and musical. Porches and wrought iron everywhere." value={r.vibe ?? ''} onChange={(e) => setR({ ...r, vibe: e.target.value || undefined })} />}</Field>
        <div className="field">
          <span className="label">Neighborhoods</span>
          <div className="tags">
            {hoods.map((h) => {
              const own = r.customNeighborhoods?.includes(h);
              return (
                <span key={h} className="tag worlds">
                  {h}
                  {own && <button type="button" aria-label={`Remove ${h}`} onClick={() => setR({ ...r, customNeighborhoods: r.customNeighborhoods!.filter((x) => x !== h) })}><X size={12} weight="bold" /></button>}
                </span>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <input className="input grow" aria-label="New neighborhood" placeholder="Add a neighborhood" value={newHood} onChange={(e) => setNewHood(e.target.value)} />
            <button type="button" className="btn" disabled={!newHood.trim()} onClick={() => { setR({ ...r, customNeighborhoods: [...(r.customNeighborhoods ?? []), newHood.trim()] }); setNewHood(''); }}>Add</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
