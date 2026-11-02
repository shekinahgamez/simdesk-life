import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { useStore } from '../store/store';
import { simName, useLots } from '../store/hooks';
import { nowIso, uid } from '../lib/ids';
import { WEEKDAYS } from '../lib/time';
import { Avatar, Empty, Field, Modal } from '../components/ui';
import { ObjIcon } from '../components/categories';

export default function ClubsPage() {
  const { recs, upsert } = useStore();
  const lots = useLots();
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const clubs = Object.values(recs.club).sort((a, b) => a.name.localeCompare(b.name));

  const create = () => {
    const id = uid();
    upsert('club', { id, name: name.trim(), purpose: purpose.trim() || undefined, roles: ['Leader', 'Member'], members: [], activities: [], linkedClubIds: [], createdAt: nowIso() });
    setAdding(false);
    nav(id);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 12 }}><ObjIcon cat="clubs" size="lg" /> Clubs</h1>
          <div className="sub">{clubs.length} clubs</div>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New club</button>
      </div>
      {clubs.length === 0 ? (
        <Empty icon={<ObjIcon cat="clubs" size="lg" />} title="No clubs yet" action={<button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> Start a club</button>}>
          Book clubs, covens, secret societies, the PTA. Give each one a purpose, roles and a place to meet.
        </Empty>
      ) : (
        <div className="grid-cards">
          {clubs.map((c) => {
            const lot = c.lotId ? lots.find((l) => l.id === c.lotId) : undefined;
            const members = c.members.map((m) => recs.sim[m.simId]).filter(Boolean);
            return (
              <Link key={c.id} to={c.id} className="card stack" style={{ textDecoration: 'none', color: 'inherit', gap: 12 }}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <ObjIcon cat="clubs" />
                  <h3 className="grow" style={{ fontSize: 17 }}>{c.name}</h3>
                </div>
                <div className="tags">
                  {c.purpose && <span className="tag clubs">{c.purpose}</span>}
                  {c.meets && <span className="tag outline">{WEEKDAYS[c.meets.weekday]}s</span>}
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="avatar-stack">{members.slice(0, 6).map((s) => <Avatar key={s.id} name={simName(s)} src={s.portrait} size={28} />)}</span>
                  <span className="tiny muted">{members.length} member{members.length === 1 ? '' : 's'}</span>
                </div>
                {lot && <div className="tiny muted">Meets at {lot.name}</div>}
              </Link>
            );
          })}
        </div>
      )}
      {adding && (
        <Modal title="New club" onClose={() => setAdding(false)} footer={<><button className="btn" onClick={() => setAdding(false)}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={create}>Create club</button></>}>
          <div className="stack" style={{ gap: 16 }}>
            <Field label="Club name">{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Willow Creek Book Club" />}</Field>
            <Field label="Purpose" hint="Your own label: Book club, Coven, Gang, Support group, Sorority…">{(id) => <input id={id} className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} />}</Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
