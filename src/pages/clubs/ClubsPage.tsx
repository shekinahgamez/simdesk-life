import { useState } from 'react';
import { CaretLeft, Check, MapPin, PencilSimple, Plus, Prohibit, Star, UsersThree } from '@phosphor-icons/react';
import { ObjIcon } from '../../components/categories';
import { admissionLabel, perkKindLabel, reqCatLabel, type Activity, type ClubRow } from '../../lib/clubs';
import { go, savePath } from '../../lib/router';
import { saveData } from '../../lib/saves';
import type { SaveRow } from '../../lib/sync/types';
import { plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import { Faces } from '../households/shared';
import { ClubPhotos } from '../photos/PhotosPage';
import { SimAvatar } from '../sims/shared';
import { ClubForm, type ClubPart } from './ClubForm';
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

function ClubPage({ save, clubId }: { save: SaveRow; clubId: string }) {
  const ctx = useClubs(save);
  const phone = useIsPhone();
  const [editing, setEditing] = useState<null | { part?: ClubPart; pick?: boolean }>(null);
  const row = ctx.byId.get(clubId);
  if (!row) return <div className="page"><p>That club isn’t here anymore.</p><a className="btn" href={savePath(save.id, 'clubs')}>Back to Clubs</a></div>;
  const c = row.club;
  const place = ctx.placeOf(c.place);
  const pen = (part: ClubPart) => (
    <button type="button" className="btn ghost icon sm club-pen" aria-label={`Edit ${part}`} onClick={() => setEditing({ part })}><PencilSimple size={16} /></button>
  );
  const card = (title: string, part: ClubPart, count: string | null, body: React.ReactNode) => (
    <section className="card club-card">
      <div className="card-head"><h2>{title}{count && <span className="cnt">{count}</span>}</h2>{pen(part)}</div>
      {body}
    </section>
  );
  const members = card('Members', 'members', c.members.length ? String(c.members.length) : null, (
    <div className="club-faces">
      {c.members.map((sid) => {
        const sim = ctx.sims.get(sid);
        const inner = (
          <>
            <span className="club-face-pic">
              {sim ? <SimAvatar sim={sim} size={48} /> : <span className="sim-avatar initials" style={{ width: 48, height: 48 }} aria-hidden="true" />}
              {c.leader === sid && <span className="club-lead" title="Leader"><Star size={10} weight="fill" aria-hidden="true" /></span>}
            </span>
            <span className="club-face-nm">{ctx.firstOf(sid)}</span>
          </>
        );
        const label = `${ctx.nameOf(sid)}${c.leader === sid ? ', leader' : ''}`;
        return sim
          ? <a key={sid} className="club-face" href={savePath(save.id, `sims/${sid}`)} aria-label={label} title={label}>{inner}</a>
          : <span key={sid} className="club-face" aria-label={label}>{inner}</span>;
      })}
      <button type="button" className="club-face add" onClick={() => setEditing({ part: 'members', pick: true })}>
        <span className="club-face-pic"><span className="club-plus"><Plus size={18} weight="bold" aria-hidden="true" /></span></span>
        <span className="club-face-nm">Add</span>
      </button>
    </div>
  ));
  const chips = (list: Activity[], yes: boolean) => (
    <div className="club-chips">
      {list.map((a, i) => {
        const target = a.club ? ctx.byId.get(a.club) : undefined;
        return (
          <span key={i} className={`club-rule ${yes ? 'yes' : 'no'}`}>
            {yes ? <Check size={14} weight="bold" aria-label="Encouraged:" /> : <Prohibit size={14} weight="bold" aria-label="Banned:" />}
            {a.text}{target && <> <span className="club-arrow" aria-label="aimed at">→</span> <ClubPill save={save} row={target} /></>}
          </span>
        );
      })}
    </div>
  );
  const noRules = !c.encouraged.length && !c.banned.length;
  const rules = card('Rules', 'rules', null, noRules ? <p className="muted" style={{ margin: 0 }}>No rules yet.</p> : (
    <>
      {c.encouraged.length > 0 && <><div className="club-sub">Encouraged</div>{chips(c.encouraged, true)}</>}
      {c.banned.length > 0 && <><div className="club-sub">Banned</div>{chips(c.banned, false)}</>}
    </>
  ));
  const noDetails = !c.requirements.length && !c.perks.length && !c.notes;
  const details = card('Details', 'details', null, noDetails ? <p className="muted" style={{ margin: 0 }}>No requirements, perks or notes yet.</p> : (
    <>
      {c.requirements.length > 0 && <><div className="club-sub">Requirements</div>{c.requirements.map((r, i) => <div key={i} className="club-kv"><b>{reqCatLabel(r.cat)}</b><span>{r.value}</span></div>)}</>}
      {c.perks.length > 0 && <><div className="club-sub">Perks</div>{c.perks.map((p, i) => <div key={i} className="club-kv"><b>{perkKindLabel(p.kind)}</b><span>{p.text}</span></div>)}</>}
      {c.notes && <><div className="club-sub">Notes</div><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.notes}</p></>}
    </>
  ));
  const photos = <ClubPhotos save={save} clubId={clubId} />;
  const where = c.place && (place.lot
    ? <a className="club-where" href={savePath(save.id, `worlds/lot/${place.lot}`)}><MapPin size={15} weight="duotone" aria-hidden="true" />{place.text}{place.sub && ` · ${place.sub}`}</a>
    : <span className="club-where plain"><MapPin size={15} weight="duotone" aria-hidden="true" />{place.text}{place.sub && ` · ${place.sub}`}</span>);

  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 14 }}>
      <a className="ph-back" href={savePath(save.id, 'clubs')}><CaretLeft size={18} weight="bold" /> Clubs</a>
      <div className="club-head">
        <ObjIcon cat="clubs" size="lg" />
        <div className="grow">
          <h1 style={phone ? { fontSize: 24, margin: 0 } : { margin: 0 }}>{c.name || 'Unnamed club'}</h1>
          {c.description && <div className="sub" style={{ marginTop: 4 }}>{c.description}</div>}
          <div className="club-line"><span className="tag outline-soft">{admissionLabel(c.admission)}</span>{where}</div>
        </div>
        <button type="button" className="btn" onClick={() => setEditing({})}>Edit</button>
      </div>
      {phone ? (
        <div className="stack" style={{ gap: 12 }}>{members}{rules}{details}{photos}</div>
      ) : (
        <div className="hh-grid">
          <div className="stack" style={{ gap: 14 }}>{members}{rules}</div>
          <div className="stack" style={{ gap: 14 }}>{details}{photos}</div>
        </div>
      )}
      {editing && <ClubForm ctx={ctx} id={clubId} part={editing.part} pickMembers={editing.pick} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} onDeleted={() => go(savePath(save.id, 'clubs'))} />}
    </div>
  );
}
