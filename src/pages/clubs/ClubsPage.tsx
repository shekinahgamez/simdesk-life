import { useState } from 'react';
import { CaretLeft, CaretRight, Plus, UsersThree } from '@phosphor-icons/react';
import { ObjIcon } from '../../components/categories';
import { admissionLabel, perkKindLabel, reqCatLabel, MAX_ACTIVITIES, type Activity, type ClubRow } from '../../lib/clubs';
import { go, savePath } from '../../lib/router';
import { saveData } from '../../lib/saves';
import type { SaveRow } from '../../lib/sync/types';
import { plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import { Faces } from '../households/shared';
import { ClubPhotos } from '../photos/PhotosPage';
import { SimAvatar } from '../sims/shared';
import { ClubForm } from './ClubForm';
import { clubsOn, useClubs, type ClubsCtx } from './shared';

/** The Clubs section: the list, and one club's page. Only there when the save has Get Together on. */
export function ClubsPage({ save, rest }: { save: SaveRow; rest: string[] }) {
  if (!clubsOn(saveData(save))) return <NeedPack save={save} />;
  return rest[0] ? <ClubPage key={rest[0]} save={save} clubId={rest[0]} /> : <ClubsList save={save} />;
}

function NeedPack({ save }: { save: SaveRow }) {
  return (
    <div className="empty" style={{ margin: '40px auto', maxWidth: 480 }}>
      <ObjIcon cat="clubs" size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>Clubs need Get Together</h2>
      <p>Turn that pack on for this save and clubs show up.</p>
      <a className="btn primary" href={savePath(save.id, 'settings')}>Open Save settings</a>
    </div>
  );
}

const clubHref = (save: SaveRow, id: string) => savePath(save.id, `clubs/${id}`);

function ClubCard({ save, ctx, row }: { save: SaveRow; ctx: ClubsCtx; row: ClubRow }) {
  const c = row.club;
  const members = c.members.filter((id) => ctx.sims.has(id)).map((id) => ({ id, sim: ctx.sims.get(id)! }));
  const place = ctx.placeOf(c.place).text;
  const open = () => go(clubHref(save, row.id));
  return (
    <div className="hh-card club-item" role="link" tabIndex={0} aria-label={c.name || 'Unnamed club'} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }} style={{ gap: 4 }}>
      <h3 style={{ margin: 0 }}>{c.name || 'Unnamed club'}</h3>
      {c.encouraged.length > 0 && <div className="ln" style={{ margin: 0 }}>{c.encouraged.map((a) => a.text).join(' · ')}</div>}
      <div className="ln" style={{ margin: 0 }}>{[place, admissionLabel(c.admission), plural(c.members.length, 'member')].filter(Boolean).join(' · ')}</div>
      {members.length > 0 && <div style={{ marginTop: 8 }}><Faces sims={members} size={34} max={5} /></div>}
    </div>
  );
}

function ClubsList({ save }: { save: SaveRow }) {
  const ctx = useClubs(save);
  const phone = useIsPhone();
  const [adding, setAdding] = useState(false);
  const add = <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New club</button>;
  const body = ctx.rows.length === 0 ? (
    <div className="empty">
      <ObjIcon cat="clubs" size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>No clubs yet</h2>
      <p>Who’s in it, who leads it, where it meets.</p>
      {add}
    </div>
  ) : (
    <div className="hh-cards" style={phone ? { gridTemplateColumns: '1fr' } : undefined}>{ctx.rows.map((r) => <ClubCard key={r.id} save={save} ctx={ctx} row={r} />)}</div>
  );
  const form = adding && <ClubForm ctx={ctx} id={null} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); go(clubHref(save, id)); }} />;
  if (phone) {
    return (
      <div className="m-stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="m-h1" style={{ paddingTop: 6 }}>Clubs</h1>
          {ctx.rows.length > 0 && add}
        </div>
        {body}
        {form}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <ObjIcon cat="clubs" size="lg" />
          <div><h1>Clubs</h1><div className="sub">{ctx.rows.length ? plural(ctx.rows.length, 'club') : 'Your Sims’ clubs'}</div></div>
        </div>
        {ctx.rows.length > 0 && add}
      </div>
      {body}
      {form}
    </div>
  );
}

/** A club's own name as a small pink pill with the club icon in front. One per row, never a pile. */
function ClubPill({ save, row }: { save: SaveRow; row: ClubRow }) {
  return <a className="tag clubs club-pill" href={clubHref(save, row.id)}><UsersThree size={15} weight="duotone" aria-hidden="true" />{row.club.name}</a>;
}

function ActivityList({ save, ctx, list }: { save: SaveRow; ctx: ClubsCtx; list: Activity[] }) {
  return (
    <ul className="club-list">
      {list.map((a, i) => {
        const target = a.club ? ctx.byId.get(a.club) : undefined;
        return <li key={i}>{a.text}{target && <> <span className="club-arrow" aria-label="aimed at">→</span> <ClubPill save={save} row={target} /></>}</li>;
      })}
    </ul>
  );
}

function ClubPage({ save, clubId }: { save: SaveRow; clubId: string }) {
  const ctx = useClubs(save);
  const phone = useIsPhone();
  const [editing, setEditing] = useState(false);
  const row = ctx.byId.get(clubId);
  if (!row) return <div className="page"><p>That club isn’t here anymore.</p><a className="btn" href={savePath(save.id, 'clubs')}>Back to Clubs</a></div>;
  const c = row.club;
  const place = ctx.placeOf(c.place);
  const card = (title: string, count: string | null, body: React.ReactNode) => (
    <section className="card club-card">
      <div className="card-head"><h2>{title}{count && <span className="cnt">{count}</span>}</h2></div>
      {body}
    </section>
  );
  const members = card('Members', String(c.members.length), c.members.length ? (
    <div className="club-members">
      {c.members.map((sid) => (
        <a key={sid} className="club-member" href={ctx.sims.has(sid) ? savePath(save.id, `sims/${sid}`) : undefined}>
          {ctx.sims.has(sid) ? <SimAvatar sim={ctx.sims.get(sid)!} size={36} /> : <span className="sim-avatar initials" style={{ width: 36, height: 36 }} aria-hidden="true" />}
          <span className="grow">{ctx.nameOf(sid)}</span>
          {c.leader === sid && <span className="tag clubs">Leader</span>}
          <CaretRight size={16} weight="bold" className="club-chev" aria-hidden="true" />
        </a>
      ))}
    </div>
  ) : <p className="muted" style={{ margin: 0 }}>No members yet.</p>);
  const meets = c.place && card('Meets at', null, place.lot ? (
    <a className="club-member" href={savePath(save.id, `worlds/lot/${place.lot}`)}><span className="grow"><b>{place.text}</b>{place.sub && <small>{place.sub}</small>}</span><CaretRight size={16} weight="bold" className="club-chev" aria-hidden="true" /></a>
  ) : <div className="club-member"><span className="grow"><b>{place.text}</b>{place.sub && <small>{place.sub}</small>}</span></div>);
  const rules = (c.encouraged.length > 0 || c.banned.length > 0) && card('Rules', null, (
    <>
      {c.encouraged.length > 0 && <><div className="club-sub">Encouraged<span className="cnt">{c.encouraged.length} of {MAX_ACTIVITIES}</span></div><ActivityList save={save} ctx={ctx} list={c.encouraged} /></>}
      {c.banned.length > 0 && <><div className="club-sub">Banned<span className="cnt">{c.banned.length} of {MAX_ACTIVITIES}</span></div><ActivityList save={save} ctx={ctx} list={c.banned} /></>}
    </>
  ));
  const reqs = c.requirements.length > 0 && card('Requirements', `${c.requirements.length} of 5`, c.requirements.map((r, i) => <div key={i} className="club-kv"><b>{reqCatLabel(r.cat)}</b><span>{r.value}</span></div>));
  const perks = c.perks.length > 0 && card('Perks', null, c.perks.map((p, i) => <div key={i} className="club-kv"><b>{perkKindLabel(p.kind)}</b><span>{p.text}</span></div>));
  const notes = c.notes && card('Notes', null, <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.notes}</p>);
  const photos = <ClubPhotos save={save} clubId={clubId} />;

  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 14 }}>
      <a className="ph-back" href={savePath(save.id, 'clubs')}><CaretLeft size={18} weight="bold" /> Clubs</a>
      <div className="club-head">
        <ObjIcon cat="clubs" size="lg" />
        <div className="grow"><h1 style={phone ? { fontSize: 24, margin: 0 } : { margin: 0 }}>{c.name || 'Unnamed club'}</h1>{c.description && <div className="sub" style={{ marginTop: 4 }}>{c.description}</div>}</div>
        <button type="button" className="btn" onClick={() => setEditing(true)}>Edit</button>
      </div>
      <div className="row" style={{ gap: 6 }}><span className="tag outline-soft">{admissionLabel(c.admission)}</span></div>
      {phone ? (
        <div className="stack" style={{ gap: 12 }}>{members}{meets}{rules}{reqs}{perks}{notes}{photos}</div>
      ) : (
        <div className="hh-grid">
          <div className="stack" style={{ gap: 14 }}>{members}{rules}{photos}</div>
          <div className="stack" style={{ gap: 14 }}>{meets}{reqs}{perks}{notes}</div>
        </div>
      )}
      {editing && <ClubForm ctx={ctx} id={clubId} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} onDeleted={() => go(savePath(save.id, 'clubs'))} />}
    </div>
  );
}
