import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { simName, useLots, useWorlds } from '../store/hooks';
import type { Sim } from '../lib/types';
import { Avatar, Empty, SearchBox } from '../components/ui';
import { ObjIcon } from '../components/categories';
import { HouseholdForm, ROTATION_LABEL } from '../components/HouseholdForm';

export default function HouseholdsPage() {
  const save = useSave()!;
  const nav = useNavigate();
  const { household: households, sim: sims } = useStore((s) => s.recs);
  const lots = useLots();
  const worlds = useWorlds();
  const [q, setQ] = useState('');
  const [world, setWorld] = useState('all');
  const [adding, setAdding] = useState(false);

  const members = useMemo(() => {
    const m = new Map<string, Sim[]>();
    for (const s of Object.values(sims)) if (s.householdId && !s.deceased) m.set(s.householdId, [...(m.get(s.householdId) ?? []), s]);
    return m;
  }, [sims]);
  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const worldById = useMemo(() => new Map(worlds.map((w) => [w.id, w])), [worlds]);

  const rows = Object.values(households)
    .map((h) => {
      const lot = h.homeLotId ? lotById.get(h.homeLotId) : undefined;
      const w = lot ? worldById.get(lot.worldId) : undefined;
      return { h, lot, w, m: members.get(h.id) ?? [] };
    })
    .filter((r) => (!q || r.h.name.toLowerCase().includes(q.toLowerCase())) && (world === 'all' || r.w?.id === world))
    .sort((a, b) => a.h.name.localeCompare(b.h.name));
  const usedWorlds = worlds.filter((w) => Object.values(households).some((h) => h.homeLotId && lotById.get(h.homeLotId)?.worldId === w.id));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 12 }}><ObjIcon cat="households" size="lg" /> Households</h1>
          <div className="sub">{Object.keys(households).length} households</div>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New household</button>
      </div>
      {Object.keys(households).length === 0 ? (
        <Empty icon={<ObjIcon cat="households" size="lg" />} title="No households yet. Time to make some!" action={<button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New household</button>}>
          A household groups Sims who live together, with their home lot.
        </Empty>
      ) : (
        <>
          <div className="row">
            <SearchBox value={q} onChange={setQ} placeholder="Search households" />
            {usedWorlds.length > 0 && (
              <select className="select" style={{ width: 'auto' }} value={world} onChange={(e) => setWorld(e.target.value)} aria-label="Filter by world">
                <option value="all">All worlds</option>
                {usedWorlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Household</th><th>World</th><th>Home lot</th><th>Members</th>{save.modules.rotation && <th>Rotation</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ h, lot, w, m }) => (
                  <tr key={h.id} tabIndex={0} onClick={() => nav(h.id)} onKeyDown={(e) => e.key === 'Enter' && nav(h.id)}>
                    <td><span className="row" style={{ flexWrap: 'nowrap' }}><ObjIcon cat="households" /><span className="bold">{h.name}</span></span></td>
                    <td>{w ? <span className="tag worlds">{w.name}</span> : <span className="muted small">—</span>}</td>
                    <td className="small">{lot?.name ?? <span className="muted">—</span>}</td>
                    <td>
                      <span className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                        <span className="avatar-stack">{m.slice(0, 6).map((s) => <Avatar key={s.id} name={simName(s)} src={s.portrait} size={30} />)}</span>
                        <span className="tiny muted">{m.length}</span>
                      </span>
                    </td>
                    {save.modules.rotation && <td className="small">{h.rotation && h.rotation !== 'none' ? <span className="tag worlds">{ROTATION_LABEL[h.rotation]}</span> : <span className="muted">—</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {adding && <HouseholdForm onClose={(h) => { setAdding(false); if (h) nav(h.id); }} />}
    </div>
  );
}
