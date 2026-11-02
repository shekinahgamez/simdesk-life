import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash, X } from '@phosphor-icons/react';
import { useStore } from '../store/store';
import { simName, useLots, useWorlds } from '../store/hooks';
import { WEEKDAYS } from '../lib/time';
import type { Club } from '../lib/types';
import { Avatar, Empty, Field, Modal, Picker } from '../components/ui';
import { ObjIcon } from '../components/categories';
import { NotesArea } from './SimProfile';

export default function ClubPage() {
  const { clubId } = useParams();
  const nav = useNavigate();
  const { recs, upsert, remove } = useStore();
  const lots = useLots();
  const worlds = useWorlds();
  const club = clubId ? recs.club[clubId] : undefined;
  const [addMembers, setAddMembers] = useState<string[] | null>(null);
  const [newRole, setNewRole] = useState('');
  const [newAct, setNewAct] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const worldName = useMemo(() => new Map(worlds.map((w) => [w.id, w.name])), [worlds]);
  const lotOptions = useMemo(() => lots.map((l) => ({ id: l.id, label: l.name, group: worldName.get(l.worldId) ?? 'Other' })).sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)), [lots, worldName]);
  if (!club) return <Empty title="That club isn’t here." action={<Link className="btn" to="../clubs">Back to clubs</Link>} />;

  const save = (patch: Partial<Club>) => upsert('club', { ...club, ...patch });
  const nonMembers = Object.values(recs.sim).filter((s) => !s.deceased && !club.members.some((m) => m.simId === s.id)).map((s) => ({ id: s.id, label: simName(s) }));
  const lot = club.lotId ? lots.find((l) => l.id === club.lotId) : undefined;
  const otherClubs = Object.values(recs.club).filter((c) => c.id !== club.id).map((c) => ({ id: c.id, label: c.name }));

  return (
    <div className="page">
      <div className="crumbs"><Link to="../clubs">Clubs</Link> / <span>{club.name}</span></div>
      <div className="page-head">
        <div className="grow">
          <input className="h1-input" aria-label="Club name" value={club.name} onChange={(e) => save({ name: e.target.value })} />
          <div className="row" style={{ marginTop: 8 }}>
            <span className="small muted">Purpose</span>
            <input className="input" style={{ maxWidth: 260, height: 32 }} aria-label="Purpose" placeholder="Book club, Coven, Gang…" value={club.purpose ?? ''} onChange={(e) => save({ purpose: e.target.value || undefined })} />
          </div>
        </div>
        <button className="btn ghost danger" onClick={() => setConfirmDelete(true)}><Trash size={16} /> Delete club</button>
      </div>

      <div className="grid-2">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2><ObjIcon cat="clubs" /> Members</h2><button className="btn sm primary" onClick={() => setAddMembers([])}><Plus size={14} weight="bold" /> Add members</button></div>
            {club.members.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>No members yet.</p>
            ) : (
              <div className="stack" style={{ gap: 2 }}>
                {club.members.map((m) => {
                  const s = recs.sim[m.simId];
                  if (!s) return null;
                  return (
                    <div key={m.simId} className="list-item">
                      <Avatar name={simName(s)} src={s.portrait} size={38} />
                      <Link to={`../sims/${s.id}`} className="grow bold" style={{ color: 'inherit', textDecoration: 'none' }}>{simName(s)}</Link>
                      <select className="select" style={{ width: 'auto', height: 34 }} aria-label={`${s.firstName}’s role`} value={m.role ?? ''} onChange={(e) => save({ members: club.members.map((x) => (x.simId === m.simId ? { ...x, role: e.target.value || undefined } : x)) })}>
                        <option value="">Member</option>
                        {club.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn ghost sm icon" aria-label={`Remove ${s.firstName}`} onClick={() => save({ members: club.members.filter((x) => x.simId !== m.simId) })}><X size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Roles</h2></div>
            <div className="tags">
              {club.roles.map((r) => (
                <span key={r} className="tag clubs">{r}<button type="button" aria-label={`Remove role ${r}`} onClick={() => save({ roles: club.roles.filter((x) => x !== r), members: club.members.map((m) => (m.role === r ? { ...m, role: undefined } : m)) })}><X size={12} weight="bold" /></button></span>
              ))}
            </div>
            <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (newRole.trim() && !club.roles.includes(newRole.trim())) save({ roles: [...club.roles, newRole.trim()] }); setNewRole(''); }}>
              <input className="input grow" aria-label="New role" placeholder="High Priestess, Treasurer…" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
              <button className="btn" disabled={!newRole.trim()}>Add role</button>
            </form>
          </section>

          <section className="card">
            <div className="card-head"><h2>Activities</h2></div>
            <div className="tags">
              {club.activities.map((a) => (
                <span key={a} className="tag outline">{a}<button type="button" aria-label={`Remove ${a}`} onClick={() => save({ activities: club.activities.filter((x) => x !== a) })}><X size={12} weight="bold" /></button></span>
              ))}
            </div>
            <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (newAct.trim()) save({ activities: [...club.activities, newAct.trim()] }); setNewAct(''); }}>
              <input className="input grow" aria-label="New activity" placeholder="Read books, Do magic, Prank…" value={newAct} onChange={(e) => setNewAct(e.target.value)} />
              <button className="btn" disabled={!newAct.trim()}>Add</button>
            </form>
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2><ObjIcon cat="worlds" /> Meeting spot</h2></div>
            <div className="stack">
              <Picker label="Meeting lot" placeholder="Search lots" options={lotOptions} value={club.lotId ? [club.lotId] : []} onChange={(v) => save({ lotId: v[0] })} />
              {lot && <Link className="small" to={`../lots/${lot.id}`}>Open {lot.name}</Link>}
              <label className="field">
                <span className="label">Meets every</span>
                <select className="select" value={club.meets?.weekday ?? ''} onChange={(e) => save({ meets: e.target.value === '' ? null : { ...club.meets, weekday: Number(e.target.value) } })}>
                  <option value="">Whenever they feel like it</option>
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </label>
              {club.meets && (
                <Field label="Time">{(id) => <input id={id} className="input" placeholder="6 PM to 9 PM" value={club.meets?.time ?? ''} onChange={(e) => save({ meets: { ...club.meets!, time: e.target.value || undefined } })} />}</Field>
              )}
              <span className="hint">Weekly meetings show on the calendar.</span>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2>Linked clubs</h2></div>
            {otherClubs.length ? (
              <Picker label="Linked clubs" multi placeholder="Rivals, sister clubs…" options={otherClubs} value={club.linkedClubIds} onChange={(linkedClubIds) => save({ linkedClubIds })} tagClass="clubs" />
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Make another club to link rivals or sister clubs.</p>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h2>Notes</h2></div>
            <NotesArea value={club.notes ?? ''} onChange={(notes) => save({ notes })} />
          </section>
        </div>
      </div>

      {addMembers && (
        <Modal title={`Add members to ${club.name}`} onClose={() => setAddMembers(null)} footer={<><button className="btn" onClick={() => setAddMembers(null)}>Cancel</button><button className="btn primary" disabled={!addMembers.length} onClick={() => { save({ members: [...club.members, ...addMembers.map((simId) => ({ simId }))] }); setAddMembers(null); }}>Add</button></>}>
          <Picker label="Sims" multi placeholder="Search Sims" options={nonMembers} value={addMembers} onChange={setAddMembers} tagClass="sims" />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title={`Delete ${club.name}?`} onClose={() => setConfirmDelete(false)} footer={<><button className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button><button className="btn primary" onClick={() => { remove('club', club.id); nav('../clubs'); }}>Delete club</button></>}>
          <p style={{ margin: 0 }}>Members stay; only the club goes.</p>
        </Modal>
      )}
      <style>{`.h1-input{font-family:var(--font-head);font-size:30px;font-weight:800;letter-spacing:-.025em;border:1px solid transparent;background:none;border-radius:10px;padding:2px 6px;margin-left:-7px;width:100%;max-width:600px}.h1-input:hover{border-color:var(--line)}.h1-input:focus{outline:none;border-color:var(--accent);background:var(--field)}`}</style>
    </div>
  );
}
