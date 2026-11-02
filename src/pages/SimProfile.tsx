import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUp, Cake, Confetti, DotsThree, Lock, PencilSimple, Plus, UsersThree, X } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { simName, useLots, useOwned, useSimAge, useStageTable, useWorlds } from '../store/hooks';
import { addDays, formatDate, formatSeasonDay, formatShort, inDays, STAGES, STAGE_LABEL, toIndex } from '../lib/time';
import { eventsBetween } from '../lib/events';
import { relLabelFor, REL_ORDER } from '../lib/relationships';
import type { Relationship } from '../lib/types';
import { AddPhotoButton, Avatar, Empty, Modal, toast } from '../components/ui';
import { ObjIcon } from '../components/categories';
import { SimForm, useTraitLabel } from '../components/SimForm';
import { RelationshipForm } from '../components/RelationshipForm';

export default function SimProfile() {
  const { simId } = useParams();
  const nav = useNavigate();
  const save = useSave()!;
  const table = useStageTable();
  const owned = useOwned();
  const { recs, upsert, remove } = useStore();
  const sim = simId ? recs.sim[simId] : undefined;
  const age = useSimAge(sim);
  const traitLabel = useTraitLabel();
  const lots = useLots();
  const worlds = useWorlds();
  const [editing, setEditing] = useState(false);
  const [relEdit, setRelEdit] = useState<Relationship | 'new' | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'deceased' | null>(null);
  const [cause, setCause] = useState('');

  const rels = useMemo(
    () =>
      Object.values(recs.relationship)
        .filter((r) => r.a === simId || r.b === simId)
        .sort((a, b) => REL_ORDER.indexOf(a.type) - REL_ORDER.indexOf(b.type)),
    [recs.relationship, simId],
  );

  const upcoming = useMemo(() => {
    if (!sim) return [];
    const to = addDays(save.date, save.seasonLength * 2, save.seasonLength);
    const myClubs = Object.values(recs.club).filter((c) => c.members.some((m) => m.simId === sim.id));
    return eventsBetween(save, save.date, to, { sims: [sim], holidays: Object.values(recs.holiday), clubs: myClubs }, table).slice(0, 6);
  }, [sim, save, recs.holiday, recs.club, table]);

  if (!sim) return <Empty title="That Sim isn’t here." action={<Link className="btn" to="..">Back to Sims</Link>} />;

  const name = simName(sim);
  const hh = sim.householdId ? recs.household[sim.householdId] : undefined;
  const home = hh?.homeLotId ? lots.find((l) => l.id === hh.homeLotId) : undefined;
  const world = home ? worlds.find((w) => w.id === home.worldId) : undefined;
  const hhSims = hh ? Object.values(recs.sim).filter((s) => s.householdId === hh.id) : [];
  const clubs = Object.values(recs.club).filter((c) => c.members.some((m) => m.simId === sim.id));
  const aspiration = sim.aspiration ? owned?.aspirations.find((a) => a.id === sim.aspiration)?.name ?? sim.aspiration : undefined;
  const occultNames = sim.occults.map((o) => owned?.occults.find((x) => x.id === o)?.name ?? o);
  const info = age.info;
  const lifespanLabel = save.lifespan.preset === 'custom' ? 'Custom' : save.lifespan.preset[0].toUpperCase() + save.lifespan.preset.slice(1);
  const nextStageIdx = age.stage ? STAGES.indexOf(age.stage) + 1 : 0;

  const stagePhoto = (st: string) => sim.stagePhotos.find((p) => p.stage === st)?.url;
  const strip = STAGES.filter((st, i) => stagePhoto(st) || i <= Math.max(STAGES.indexOf(age.stage ?? 'youngAdult'), 0));

  const ageUpByHand = () => {
    const next = STAGES[nextStageIdx];
    if (!next) return;
    upsert('sim', { ...sim, manualStage: next });
    toast(`${sim.firstName} is now ${next === 'adult' || next === 'elder' || next === 'infant' ? 'an' : 'a'} ${STAGE_LABEL[next].toLowerCase()}. Happy birthday!`);
  };

  return (
    <div className="page">
      <div className="crumbs"><Link to="../sims">Sims</Link> / <span>{name}</span></div>

      {/* hero */}
      <section className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--r-xl)' }}>
        <div className="row" style={{ alignItems: 'stretch', gap: 0, flexWrap: 'wrap' }}>
          <div className="hero-photo" style={{ background: 'var(--sims-tint)', position: 'relative' }}>
            {sim.portrait ? (
              <img src={sim.portrait} alt={`${name}’s portrait`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <button type="button" onClick={() => setEditing(true)} style={{ all: 'unset', cursor: 'pointer', position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--sims-ink)' }}>
                <span style={{ fontFamily: 'var(--font-head)', fontSize: 64, fontWeight: 800 }}>{name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                <span className="small bold">Add a portrait</span>
              </button>
            )}
          </div>
          <div className="stack grow" style={{ padding: 26, gap: 14, minWidth: 260 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 10 }}>
                <h1 style={{ fontSize: 34 }}>{name}</h1>
                <div className="tags">
                  {sim.deceased && <span className="tag outline">Deceased</span>}
                  {age.stage && <span className="tag sims">{STAGE_LABEL[age.stage]}</span>}
                  {hh && <Link to={`../households/${hh.id}`} className="tag households" style={{ textDecoration: 'none' }}>{hh.name}</Link>}
                  {world && <span className="tag worlds">{world.name}</span>}
                  {occultNames.filter((o) => o.toLowerCase() !== 'human').map((o) => <span key={o} className="tag storylines">{o}</span>)}
                </div>
              </div>
              <div className="row" style={{ position: 'relative' }}>
                <button className="btn" onClick={() => setEditing(true)}><PencilSimple size={16} weight="bold" /> Edit Sim</button>
                <button className="btn icon" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><DotsThree size={20} weight="bold" /></button>
                {menu && (
                  <div className="combo-list" style={{ left: 'auto', width: 220 }} role="menu" onMouseLeave={() => setMenu(false)}>
                    {!save.trackDate && !sim.deceased && STAGES[nextStageIdx] && (
                      <button role="menuitem" onClick={() => { setMenu(false); ageUpByHand(); }}><ArrowUp size={14} /> Age up to {STAGE_LABEL[STAGES[nextStageIdx]].toLowerCase()}</button>
                    )}
                    {sim.deceased ? (
                      <button role="menuitem" onClick={() => { setMenu(false); upsert('sim', { ...sim, deceased: undefined }); }}>Bring back to life</button>
                    ) : (
                      <button role="menuitem" onClick={() => { setMenu(false); setConfirm('deceased'); }}>Mark as deceased</button>
                    )}
                    <button role="menuitem" onClick={() => { setMenu(false); setConfirm('delete'); }} style={{ color: 'var(--danger)' }}>Delete Sim</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <QuickFact label={sim.deceased ? 'Passed' : 'Ages up in'} value={sim.deceased ? (sim.deceased.date ? formatShort(sim.deceased.date) : 'Yes') : info?.agesUpIn != null ? `${info.agesUpIn} day${info.agesUpIn === 1 ? '' : 's'}` : info?.oldAgeAnyDay ? 'Any day now' : save.trackDate ? '—' : 'By hand'} />
              <QuickFact label="Birthday" value={sim.birthday ? formatSeasonDay(sim.birthday.season, sim.birthday.day) : '—'} />
              <QuickFact label="Aspiration" value={aspiration ?? '—'} />
            </div>

            <div>
              <div className="label" style={{ marginBottom: 8 }}>Through the years</div>
              <div className="row" style={{ gap: 10, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
                {strip.map((st) => {
                  const url = stagePhoto(st);
                  return (
                    <div key={st} className="stack" style={{ gap: 4, alignItems: 'center', flex: '0 0 auto' }}>
                      {url ? (
                        <div style={{ position: 'relative' }}>
                          <img src={url} alt={`${name} as ${STAGE_LABEL[st].toLowerCase()}`} loading="lazy" style={{ width: 88, height: 88, borderRadius: 14, objectFit: 'cover' }} />
                          <button className="btn sm icon" style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24 }} aria-label={`Remove ${STAGE_LABEL[st]} photo`} onClick={() => upsert('sim', { ...sim, stagePhotos: sim.stagePhotos.filter((p) => p.stage !== st) })}><X size={12} weight="bold" /></button>
                        </div>
                      ) : (
                        <AddPhotoButton label="Add" maxSide={700} onAdd={(url) => upsert('sim', { ...sim, stagePhotos: [...sim.stagePhotos.filter((p) => p.stage !== st), { stage: st, url }] })} />
                      )}
                      <span className="tiny muted bold">{STAGE_LABEL[st]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2><ObjIcon cat="sims" /> Age and lifespan</h2>{info && age.stage && <span className="small muted bold">{STAGE_LABEL[age.stage]} · Day {info.dayInStage} of {info.stageLength}{age.stage === 'elder' ? '+' : ''}</span>}</div>
            {info && !info.notBornYet ? (
              <>
                <div className="progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (info.dayInStage / info.stageLength) * 100)}%` }} /></div>
                <p className="small" style={{ margin: '10px 0 14px' }}>
                  {info.nextStage && info.agesUpOn
                    ? <>Ages up to <b>{STAGE_LABEL[info.nextStage].toLowerCase()}</b> {inDays(info.agesUpIn!)}, on {formatShort(info.agesUpOn)}.</>
                    : info.oldAgeAnyDay ? <>Past the elder minimum. Could pass of old age any day.</> : <>Elder for at least {info.stageLength - info.dayInStage + 1} more days.</>}
                </p>
              </>
            ) : info?.notBornYet ? (
              <p className="small muted">Not born yet. Due {sim.birthday && formatDate(sim.birthday)}.</p>
            ) : (
              <p className="small muted" style={{ marginTop: 0 }}>{save.trackDate ? 'Set an age to see countdowns.' : 'Date tracking is off, so you age Sims up by hand from the menu.'}</p>
            )}
            <dl className="kv">
              <dt>Birthday</dt><dd>{sim.birthday ? formatSeasonDay(sim.birthday.season, sim.birthday.day) : '—'}</dd>
              <dt>Lifespan</dt><dd>{lifespanLabel} (save default)</dd>
              <dt>Born</dt><dd>{sim.birthday ? (sim.birthday.year < 1 ? 'Before this save began' : `Year ${sim.birthday.year}`) : '—'}</dd>
              {info && <><dt>Age</dt><dd>{info.ageDays} days old</dd></>}
            </dl>
          </section>

          <section className="card">
            <div className="card-head"><h2><ObjIcon cat="sims" /> About</h2></div>
            <dl className="kv">
              <dt>Pronouns</dt><dd>{sim.pronouns || '—'}</dd>
              <dt>Orientation</dt><dd>{sim.orientation || '—'}</dd>
              <dt>Occult</dt><dd>{occultNames.length ? occultNames.join(' · ') : 'Human'}</dd>
              <dt>Aspiration</dt><dd>{aspiration ?? '—'}</dd>
              <dt>Career</dt><dd>{sim.career || '—'}</dd>
              <dt>Traits</dt>
              <dd>{sim.traits.length ? <div className="tags">{sim.traits.map((t) => <span key={t} className="tag sims">{traitLabel(t)}</span>)}</div> : '—'}</dd>
            </dl>
          </section>

          <section className="card">
            <div className="card-head">
              <h2><ObjIcon cat="sims" /> Relationships</h2>
              <button className="btn sm" onClick={() => setRelEdit('new')}><Plus size={14} weight="bold" /> Add</button>
            </div>
            {rels.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>No one linked yet. Add family, partners, friends and the occasional secret.</p>
            ) : (
              <div className="stack" style={{ gap: 2 }}>
                {rels.map((r) => {
                  const other = recs.sim[r.a === sim.id ? r.b : r.a];
                  if (!other) return null;
                  return (
                    <div key={r.id} className="list-item" style={{ padding: '8px 6px', gap: 8 }}>
                      <Avatar name={simName(other)} src={other.portrait} size={34} />
                      <Link to={`../sims/${other.id}`} className="grow bold" style={{ color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{simName(other)}</Link>
                      {r.secret && <span className="tag secret"><Lock size={11} weight="fill" /> Secret</span>}
                      <span className="small muted">{relLabelFor(r, sim.id)}</span>
                      <button className="btn ghost sm icon" aria-label={`Edit relationship with ${simName(other)}`} onClick={() => setRelEdit(r)}><PencilSimple size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Notes</h2></div>
            <NotesArea value={sim.notes ?? ''} onChange={(notes) => upsert('sim', { ...sim, notes })} />
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2><ObjIcon cat="households" /> Household</h2></div>
            {hh ? (
              <dl className="kv">
                <dt>Household</dt><dd><Link to={`../households/${hh.id}`}>{hh.name}</Link></dd>
                <dt>Home</dt><dd>{home ? <Link to={`../lots/${home.id}`}>{home.name}</Link> : '—'}</dd>
                <dt>World</dt><dd>{world?.name ?? '—'}</dd>
                <dt>Members</dt><dd>{hhSims.length} Sim{hhSims.length === 1 ? '' : 's'}</dd>
              </dl>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Not in a household. <button className="btn ghost sm" onClick={() => setEditing(true)}>Pick one</button></p>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2><ObjIcon cat="calendar" /> Coming up</h2></div>
            {upcoming.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>{save.trackDate ? 'Nothing in the next two seasons.' : 'Turn on date tracking to see what’s coming.'}</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {upcoming.map((e, i) => (
                  <div key={i} className="row small" style={{ flexWrap: 'nowrap' }}>
                    <span className={`obj ${e.kind === 'club' ? 'clubs' : e.kind === 'holiday' ? 'calendar' : 'sims'}`} aria-hidden="true">
                      {e.kind === 'ageUp' ? <ArrowUp size={14} weight="bold" /> : e.kind === 'birthday' ? <Cake size={14} weight="duotone" /> : e.kind === 'club' ? <UsersThree size={14} weight="duotone" /> : <Confetti size={14} weight="duotone" />}
                    </span>
                    <span className="grow">{e.kind === 'ageUp' ? `Ages up to ${STAGE_LABEL[e.stage!].toLowerCase()}` : e.kind === 'birthday' ? 'Birthday' : e.label}</span>
                    <span className="muted tiny">{formatShort(e.date)}{toIndex(e.date, save.seasonLength) - toIndex(save.date, save.seasonLength) === 0 ? ' · today' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {clubs.length > 0 && (
            <section className="card">
              <div className="card-head"><h2><ObjIcon cat="clubs" /> Clubs</h2></div>
              <div className="stack" style={{ gap: 6 }}>
                {clubs.map((c) => (
                  <Link key={c.id} to={`../clubs/${c.id}`} className="row small" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="grow bold">{c.name}</span>
                    <span className="muted">{c.members.find((m) => m.simId === sim.id)?.role || 'Member'}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {editing && <SimForm sim={sim} onClose={() => setEditing(false)} />}
      {relEdit && <RelationshipForm sim={sim} rel={relEdit === 'new' ? undefined : relEdit} onClose={() => setRelEdit(null)} />}
      {confirm === 'delete' && (
        <Modal title={`Delete ${sim.firstName}?`} onClose={() => setConfirm(null)} footer={<><button className="btn" onClick={() => setConfirm(null)}>Keep them</button><button className="btn primary" onClick={() => { remove('sim', sim.id); nav('../sims'); }}>Delete for good</button></>}>
          <p style={{ margin: 0 }}>This removes {name}, their photos and relationships from SimDesk. If they died in your game, “Mark as deceased” keeps their story instead.</p>
        </Modal>
      )}
      {confirm === 'deceased' && (
        <Modal title={`Remember ${sim.firstName}`} onClose={() => setConfirm(null)} footer={<><button className="btn" onClick={() => setConfirm(null)}>Cancel</button><button className="btn primary" onClick={() => { upsert('sim', { ...sim, deceased: { date: save.date, cause: cause.trim() || undefined } }); setConfirm(null); }}>Mark as deceased</button></>}>
          <div className="stack">
            <p style={{ margin: 0 }}>They’ll stay in your records, relationships and family, just out of the living lists. Passed on {formatDate(save.date)}.</p>
            <label className="field"><span className="label">Cause (optional)</span><input className="input" value={cause} onChange={(e) => setCause(e.target.value)} placeholder="Old age, pufferfish…" /></label>
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 14, padding: '10px 12px' }}>
      <div className="tiny muted bold">{label}</div>
      <div className="bold" style={{ fontSize: 16, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

/** Saves as you type (the store batches writes). */
export function NotesArea({ value, onChange, placeholder = 'Anything worth remembering…' }: { value: string; onChange(v: string): void; placeholder?: string }) {
  return <textarea className="textarea" aria-label="Notes" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 110 }} />;
}

