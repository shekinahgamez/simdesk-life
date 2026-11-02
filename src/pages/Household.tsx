import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PencilSimple, Plus, X } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { simAge, simName, useLots, useStageTable, useWorlds } from '../store/hooks';
import { STAGE_LABEL, inDays } from '../lib/time';
import { Avatar, Empty, Modal, Picker } from '../components/ui';
import { ObjIcon } from '../components/categories';
import { HouseholdForm, ROTATION_LABEL } from '../components/HouseholdForm';
import { SimForm } from '../components/SimForm';
import { NotesArea } from './SimProfile';

export default function HouseholdPage() {
  const { householdId } = useParams();
  const nav = useNavigate();
  const save = useSave()!;
  const table = useStageTable();
  const { recs, upsert, upsertMany, remove } = useStore();
  const h = householdId ? recs.household[householdId] : undefined;
  const lots = useLots();
  const worlds = useWorlds();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<'new' | 'existing' | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const members = useMemo(() => Object.values(recs.sim).filter((s) => s.householdId === householdId), [recs.sim, householdId]);
  const others = useMemo(
    () => Object.values(recs.sim).filter((s) => s.householdId !== householdId).map((s) => ({ id: s.id, label: simName(s), hint: s.householdId ? recs.household[s.householdId]?.name : 'No household' })),
    [recs, householdId],
  );
  if (!h) return <Empty title="That household isn’t here." action={<Link className="btn" to="../households">Back to households</Link>} />;
  const lot = h.homeLotId ? lots.find((l) => l.id === h.homeLotId) : undefined;
  const world = lot ? worlds.find((w) => w.id === lot.worldId) : undefined;

  return (
    <div className="page">
      <div className="crumbs"><Link to="../households">Households</Link> / <span>{h.name}</span></div>
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 12 }}><ObjIcon cat="households" size="lg" /> {h.name}</h1>
          <div className="tags" style={{ marginTop: 10 }}>
            {world && <span className="tag worlds">{world.name}</span>}
            {lot && <Link to={`../lots/${lot.id}`} className="tag worlds" style={{ textDecoration: 'none' }}>{lot.name}</Link>}
            {save.modules.rotation && h.rotation && h.rotation !== 'none' && <span className="tag outline">{ROTATION_LABEL[h.rotation]}</span>}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setEditing(true)}><PencilSimple size={16} weight="bold" /> Edit</button>
          <button className="btn ghost danger" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2><ObjIcon cat="sims" /> Members</h2>
            <div className="row">
              <button className="btn sm" onClick={() => setAdding('existing')}>Move Sims in</button>
              <button className="btn sm primary" onClick={() => setAdding('new')}><Plus size={14} weight="bold" /> New Sim</button>
            </div>
          </div>
          {members.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>Nobody lives here yet.</p>
          ) : (
            <div className="stack" style={{ gap: 2 }}>
              {members.map((s) => {
                const a = simAge(s, save, table);
                return (
                  <div key={s.id} className="list-item">
                    <Avatar name={simName(s)} src={s.portrait} size={44} />
                    <Link to={`../sims/${s.id}`} className="grow" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="bold">{simName(s)}</div>
                      <div className="tiny muted">
                        {s.deceased ? 'Deceased' : a.stage ? STAGE_LABEL[a.stage] : 'Age not set'}
                        {!s.deceased && a.info?.agesUpIn != null ? ` · ages up ${inDays(a.info.agesUpIn)}` : ''}
                      </div>
                    </Link>
                    <button className="btn ghost sm icon" aria-label={`Move ${s.firstName} out`} title="Move out" onClick={() => upsert('sim', { ...s, householdId: undefined })}><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2><ObjIcon cat="worlds" /> Home</h2></div>
            {lot ? (
              <Link to={`../lots/${lot.id}`} style={{ textDecoration: 'none', color: 'inherit' }} className="stack">
                {lot.photos[0] && <img src={lot.photos[0]} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 14 }} />}
                <div className="bold">{lot.name}</div>
                <div className="small muted">{[world?.name, lot.neighborhood, lot.size].filter(Boolean).join(' · ')}</div>
              </Link>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>No home lot yet. <button className="btn ghost sm" onClick={() => setEditing(true)}>Pick one</button></p>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h2>Notes</h2></div>
            <NotesArea value={h.notes ?? ''} onChange={(notes) => upsert('household', { ...h, notes })} />
          </section>
        </div>
      </div>

      {editing && <HouseholdForm household={h} onClose={() => setEditing(false)} />}
      {adding === 'new' && <SimForm defaultHouseholdId={h.id} onClose={() => setAdding(null)} />}
      {adding === 'existing' && (
        <Modal
          title={`Move Sims into ${h.name}`}
          onClose={() => { setAdding(null); setPick([]); }}
          footer={<><button className="btn" onClick={() => { setAdding(null); setPick([]); }}>Cancel</button><button className="btn primary" disabled={!pick.length} onClick={() => { upsertMany('sim', pick.map((id) => ({ ...recs.sim[id], householdId: h.id }))); setAdding(null); setPick([]); }}>Move in</button></>}
        >
          <Picker label="Sims" multi placeholder="Search Sims" options={others} value={pick} onChange={setPick} tagClass="sims" />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title={`Delete ${h.name}?`} onClose={() => setConfirmDelete(false)} footer={<><button className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button><button className="btn primary" onClick={() => { remove('household', h.id); nav('../households'); }}>Delete household</button></>}>
          <p style={{ margin: 0 }}>The Sims stay; they just won’t belong to a household anymore.</p>
        </Modal>
      )}
    </div>
  );
}
