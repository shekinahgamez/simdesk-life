import { MRow } from '../../components/Shell';
import { ObjIcon } from '../../components/categories';
import { clubRows, clubsOfSim } from '../../lib/clubs';
import { savePath } from '../../lib/router';
import { saveData } from '../../lib/saves';
import { useRecords } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { clubsOn } from './shared';

/** The clubs a Sim is in, on their profile. Nothing at all when they're in none (or the save has no Get Together). */
export function SimClubs({ save, simId, phone }: { save: SaveRow; simId: string; phone?: boolean }) {
  const recs = useRecords('club');
  if (!clubsOn(saveData(save))) return null;
  const mine = clubsOfSim(clubRows(recs), simId);
  if (mine.length === 0) return null;
  const sub = (r: (typeof mine)[number]) => [r.club.encouraged.slice(0, 2).map((a) => a.text).join(', '), r.leads ? 'Leader' : 'Member'].filter(Boolean).join(' · ');
  if (phone) {
    return (
      <>
        <div className="m-label">Clubs · {mine.length}</div>
        <div className="m-group">{mine.map((r) => <MRow key={r.id} href={savePath(save.id, `clubs/${r.id}`)} title={r.club.name || 'Unnamed club'} sub={sub(r)} icon={<ObjIcon cat="clubs" />} />)}</div>
      </>
    );
  }
  return (
    <section className="card club-card">
      <div className="card-head"><h2><ObjIcon cat="clubs" />Clubs<span className="cnt">{mine.length}</span></h2></div>
      <div className="club-members">
        {mine.map((r) => (
          <a key={r.id} className="club-member" href={savePath(save.id, `clubs/${r.id}`)}>
            <span className="grow"><b>{r.club.name || 'Unnamed club'}</b><small>{sub(r)}</small></span>
          </a>
        ))}
      </div>
    </section>
  );
}
