import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { simAge, simName, useStageTable } from '../store/hooks';
import { STAGES, STAGE_LABEL, inDays } from '../lib/time';
import type { LifeStageId } from '../lib/types';
import { Avatar, Empty, SearchBox, useDebounced } from '../components/ui';
import { ObjIcon } from '../components/categories';
import { SimForm } from '../components/SimForm';

export default function SimsPage() {
  const save = useSave()!;
  const table = useStageTable();
  const nav = useNavigate();
  const { sim: sims, household: households } = useStore((s) => s.recs);
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim().toLowerCase(), 80);
  const [stage, setStage] = useState<LifeStageId | 'all' | 'deceased'>('all');
  const [adding, setAdding] = useState(false);

  // One pass computes everything the list needs, so it stays quick with hundreds of Sims.
  const rows = useMemo(
    () =>
      Object.values(sims)
        .map((s) => {
          const age = simAge(s, save, table);
          const hh = s.householdId ? households[s.householdId] : undefined;
          const name = simName(s);
          return { s, age, hh, name, key: `${name} ${hh?.name ?? ''}`.toLowerCase() };
        })
        .sort((a, b) => a.s.lastName.localeCompare(b.s.lastName) || a.s.firstName.localeCompare(b.s.firstName)),
    [sims, households, save, table],
  );
  const filtered = rows.filter(
    (r) =>
      (!dq || r.key.includes(dq)) &&
      (stage === 'all' ? !r.s.deceased : stage === 'deceased' ? !!r.s.deceased : !r.s.deceased && r.age.stage === stage),
  );
  const living = rows.filter((r) => !r.s.deceased).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 12 }}><ObjIcon cat="sims" size="lg" /> Sims</h1>
          <div className="sub">{living} living{rows.length - living ? `, ${rows.length - living} remembered` : ''}</div>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New Sim</button>
      </div>

      {rows.length === 0 ? (
        <Empty icon={<ObjIcon cat="sims" size="lg" />} title="No Sims yet. Time to make some!" action={<button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> Add your first Sim</button>}>
          Add a Sim with their portrait, traits and age. You can tuck them into a household later.
        </Empty>
      ) : (
        <>
          <div className="row">
            <SearchBox value={q} onChange={setQ} placeholder={`Search ${rows.length} Sims`} />
            <select className="select" style={{ width: 'auto' }} value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} aria-label="Life stage">
              <option value="all">All life stages</option>
              {STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
              <option value="deceased">Remembered (deceased)</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sim</th>
                  <th>Life stage</th>
                  <th>Household</th>
                  {save.trackDate && <th>Ages up</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ s, age, hh, name }) => (
                  <tr key={s.id} onClick={() => nav(s.id)} onKeyDown={(e) => e.key === 'Enter' && nav(s.id)} tabIndex={0}>
                    <td>
                      <span className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar name={name} src={s.portrait} size={36} />
                        <span className="bold">{name}</span>
                      </span>
                    </td>
                    <td>{s.deceased ? <span className="tag outline">Deceased</span> : age.stage ? <span className="tag sims">{STAGE_LABEL[age.stage]}</span> : <span className="muted">Not set</span>}</td>
                    <td>{hh ? <span className="tag households">{hh.name}</span> : <span className="muted small">None</span>}</td>
                    {save.trackDate && (
                      <td className="small">
                        {s.deceased ? '' : age.info?.agesUpIn != null ? inDays(age.info.agesUpIn) : age.info?.oldAgeAnyDay ? 'Any day now' : <span className="muted">—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="muted small" style={{ padding: 16, margin: 0 }}>No Sims match that.</p>}
          </div>
        </>
      )}
      {adding && <SimForm onClose={(s) => { setAdding(false); if (s) nav(s.id); }} />}
    </div>
  );
}
