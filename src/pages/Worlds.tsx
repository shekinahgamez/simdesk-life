import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { useStore } from '../store/store';
import { useGameData } from '../data/gameData';
import { useLotResidents, useLots, useWorlds } from '../store/hooks';
import { nowIso, uid } from '../lib/ids';
import { Empty, Field, Modal, SearchBox } from '../components/ui';
import { ObjIcon } from '../components/categories';

export default function WorldsPage() {
  const worlds = useWorlds();
  const lots = useLots();
  const residents = useLotResidents();
  const packs = useGameData((s) => s.data?.packs);
  const { recs, upsert } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const hidden = Object.values(recs.world).filter((w) => w.hidden);

  const stats = useMemo(() => {
    const m = new Map<string, { lots: number; homes: number; photo?: string }>();
    for (const l of lots) {
      const s = m.get(l.worldId) ?? { lots: 0, homes: 0 };
      s.lots++;
      if (residents.has(l.id)) s.homes++;
      if (!s.photo && l.photos[0]) s.photo = l.photos[0];
      m.set(l.worldId, s);
    }
    return m;
  }, [lots, residents]);
  const packName = (id?: string) => packs?.find((p) => p.id === id)?.name;
  const shown = worlds.filter((w) => !q || `${w.name} ${w.originalName}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 12 }}><ObjIcon cat="worlds" size="lg" /> Worlds & lots</h1>
          <div className="sub">{worlds.length} worlds from your packs · {lots.length} lots</div>
        </div>
        <button className="btn" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> Custom world</button>
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Search worlds" />
      {shown.length === 0 ? (
        <Empty title="No worlds match." />
      ) : (
        <div className="grid-cards">
          {shown.map((w) => {
            const s = stats.get(w.id);
            const renamed = w.originalName && w.name !== w.originalName;
            return (
              <Link key={w.id} to={w.id} className="card" style={{ textDecoration: 'none', color: 'inherit', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 110, background: 'var(--worlds-tint)', position: 'relative' }}>
                  {(w.rec?.mapImage || s?.photo) && <img src={w.rec?.mapImage || s?.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {!w.rec?.mapImage && !s?.photo && <span style={{ position: 'absolute', left: 14, bottom: 12 }}><ObjIcon cat="worlds" size="lg" /></span>}
                </div>
                <div style={{ padding: '14px 16px' }} className="stack">
                  <div>
                    <h3 style={{ fontSize: 17 }}>{w.name}</h3>
                    <div className="tiny muted">{renamed ? `${w.originalName} · ` : ''}{w.custom ? 'Custom world' : packName(w.pack)}</div>
                  </div>
                  <div className="tags">
                    <span className="tag worlds">{s?.lots ?? 0} lots</span>
                    {s?.homes ? <span className="tag households">{s.homes} homes</span> : null}
                    {w.rec?.inspiredBy && <span className="tag outline">{w.rec.inspiredBy}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {hidden.length > 0 && (
        <div className="small muted">
          Hidden: {hidden.map((w, i) => (
            <span key={w.id}>{i > 0 && ', '}<button className="btn ghost sm" onClick={() => upsert('world', { ...w, hidden: false })}>{w.name || w.gameId || 'World'} (show)</button></span>
          ))}
        </div>
      )}
      {adding && (
        <Modal title="New custom world" onClose={() => setAdding(false)} footer={<><button className="btn" onClick={() => setAdding(false)}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={() => { const id = uid(); upsert('world', { id, name: name.trim(), customNeighborhoods: [], createdAt: nowIso() }); setAdding(false); nav(id); }}>Create world</button></>}>
          <Field label="World name" hint="For modded worlds or a world you’re building from scratch.">{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        </Modal>
      )}
    </div>
  );
}
