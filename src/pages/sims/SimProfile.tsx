import { SimPhotos } from '../photos/PhotosPage';
import { SimClubs } from '../clubs/SimClubs';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp, CaretLeft, CaretRight, DotsThree, Hourglass, HouseSimple, LockSimple, PencilSimple, Plus, User,
} from '@phosphor-icons/react';
import { DateFields } from '../../components/savebits';
import { PhotoBox, usePhotoPicker } from '../../components/photo';
import { AutoText, Confirm, Field, Modal, Picker, Seg, TextInput, Toggle, toast } from '../../components/ui';
import { useLayer } from '../../lib/layers';
import { usePhotos, type PhotoRef } from '../../lib/photos';
import { go, savePath } from '../../lib/router';
import { lifespanLabel } from '../../lib/saves';
import {
  aspirationName, careerText, daysWord, fullName, genderName, householdLabel, initials, occultName, otherSide, REL_TYPES, relData,
  relLabel, relRank, shortSeason, simAge, simData, stageOf, traitName, type RelData, type RelType, type SimAge, type SimData,
} from '../../lib/sims';
import { plural } from '../../lib/text';
import { useRecords, useStore } from '../../lib/sync/react';
import type { Rec, SaveRow } from '../../lib/sync/types';
import { dateOf, dayOf, formatDate, STAGE_IDS, stageName, type StageId } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import { SimForm } from './SimForm';
import { SimAvatar, useCustomTraits, useHouseholds, useRealAge, useSaveInfo, type SaveInfo } from './shared';
import { ComingUp } from '../calendar/shared';

const an = (s: StageId) => (['infant', 'adult', 'elder'].includes(s) ? 'an' : 'a');

/** One Sim's page. Desktop: hero card and two columns. Phone: photo that shrinks as you scroll, and tabs. */
export function SimProfile({ save, simId }: { save: SaveRow; simId: string }) {
  const info = useSaveInfo(save);
  const store = useStore();
  const phone = useIsPhone();
  const photos = usePhotos();
  const sims = useRecords('sim');
  const rels = useRecords('rel');
  const hh = useHouseholds();
  const custom = useCustomTraits();
  const realAgeOf = useRealAge(info);
  const rec = sims.find((r) => r.id === simId);
  const [dialog, setDialog] = useState<null | 'edit' | 'deceased' | 'delete' | 'stagePhoto' | { rel: Rec | null }>(null);

  const myRels = useMemo(() => rels.map((r) => ({ rec: r, d: relData(r) }))
    .filter(({ d }) => (d.a === simId || d.b === simId) && sims.some((s) => s.id === otherSide(d, simId)))
    .sort((x, y) => relRank(x.d.type) - relRank(y.d.type)), [rels, sims, simId]);

  if (!rec) {
    return (
      <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 14, paddingTop: 12 }}>
        <h1 className={phone ? 'm-h1' : ''}>That Sim isn’t here</h1>
        <p className="muted" style={{ margin: 0 }}>They may have been deleted. Check Trash in Save settings to bring them back.</p>
        <div><a className="btn" href={savePath(save.id, 'sims')}>Back to Sims</a></div>
      </div>
    );
  }

  const sim = simData(rec);
  const age = simAge(sim, info.today, info.table, info.track);
  const realAge = realAgeOf(age, !!sim.deceased)?.long ?? null;
  const stage = stageOf(age);
  const name = fullName(sim);
  const hhName = hh.nameOf(sim.householdId);
  const members = sim.householdId ? sims.filter((r) => simData(r).householdId === sim.householdId && !simData(r).deceased).length : 0;
  const update = (patch: Partial<SimData>) => store.put('sim', { ...rec.data, ...patch }, rec.id);

  const ageUp = () => {
    const cur = sim.stage ?? 'youngAdult';
    const next = STAGE_IDS[Math.min(STAGE_IDS.indexOf(cur) + 1, STAGE_IDS.length - 1)];
    update({ stage: next });
    toast(`${sim.first} is now ${an(next)} ${stageName(next).toLowerCase()}. Happy birthday!`);
  };
  const canAgeUp = !info.track && !sim.deceased && (sim.stage ?? 'youngAdult') !== 'elder';
  const nextManual = canAgeUp ? STAGE_IDS[STAGE_IDS.indexOf(sim.stage ?? 'youngAdult') + 1] : null;

  const setPortrait = (p: PhotoRef | null) => {
    const old = sim.portrait?.id;
    update({ portrait: p });
    if (old && old !== p?.id) void photos.remove([old]);
  };
  const setStagePhotos = (list: SimData['stagePhotos']) => update({ stagePhotos: list });

  const coming = comingUp(sim, age, info);
  const ctx: Ctx = {
    info, sim, rec, age, realAge, stage, name, hhName, members, myRels, sims, custom: custom.list, coming,
    canAgeUp, nextManual, ageUp, setPortrait, setStagePhotos, update,
    edit: () => setDialog('edit'), markDeceased: () => setDialog('deceased'), bringBack: () => { update({ deceased: null }); toast(`${sim.first} is back`); },
    del: () => setDialog('delete'), addRel: () => setDialog({ rel: null }), editRel: (r) => setDialog({ rel: r }),
    addStagePhoto: () => setDialog('stagePhoto'), saveId: save.id, save,
  };

  return (
    <>
      {phone ? <PhoneProfile c={ctx} /> : <DesktopProfile c={ctx} />}
      {dialog === 'edit' && <SimForm info={info} simId={rec.id} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />}
      {dialog === 'deceased' && <DeceasedDialog info={info} sim={sim} onClose={() => setDialog(null)} onSave={(deceased) => { update({ deceased }); setDialog(null); toast(`${sim.first} is remembered`); }} />}
      {dialog === 'delete' && (
        <Confirm title={`Delete ${sim.first || 'this Sim'}?`}
          text={`${name}, their photos and relationships go to Trash for 7 days. If they died in your game, “Mark as deceased” keeps their story instead.`}
          onCancel={() => setDialog(null)}
          actions={[
            { label: 'Keep them', run: () => setDialog(null) },
            { label: 'Delete', kind: 'danger', run: () => {
              store.moveManyToTrash([rec.id, ...myRels.map((r) => r.rec.id)], name);
              setDialog(null);
              go(savePath(save.id, 'sims'));
            } },
          ]} />
      )}
      {dialog === 'stagePhoto' && <StagePhotoAdder sim={sim} stage={stage} saveId={save.id} onClose={() => setDialog(null)}
        onAdd={(s, photo) => { setStagePhotos([...sim.stagePhotos.filter((x) => x.stage !== s), { stage: s, photo }]); setDialog(null); }} />}
      {typeof dialog === 'object' && dialog && 'rel' in dialog && (
        <RelationshipForm simId={rec.id} sims={sims} rels={rels} rel={dialog.rel} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

type Ctx = {
  info: SaveInfo; sim: SimData; rec: Rec; age: SimAge; realAge: string | null; stage: StageId | null; name: string; hhName: string; members: number;
  myRels: { rec: Rec; d: RelData }[]; sims: Rec[]; custom: { id: string; name: string }[]; coming: Coming | null;
  canAgeUp: boolean; nextManual: StageId | null; ageUp(): void; setPortrait(p: PhotoRef | null): void;
  setStagePhotos(l: SimData['stagePhotos']): void; update(p: Partial<SimData>): void;
  edit(): void; markDeceased(): void; bringBack(): void; del(): void; addRel(): void; editRel(r: Rec): void; addStagePhoto(): void; saveId: string; save: SaveRow;
};

type Coming = { title: string; when: string; date: string; short: string };
function comingUp(sim: SimData, age: SimAge, info: SaveInfo): Coming | null {
  if (sim.deceased || age.kind !== 'age' || age.age.stage === 'elder' || !age.age.nextStage) return null;
  const d = dateOf(age.age.birthdayDay!, info.cal);
  return { title: `Birthday · ages up to ${stageName(age.age.nextStage).toLowerCase()}`, when: daysWord(age.age.birthdayIn ?? 0), date: formatDate(d, 'short'), short: shortSeason(d) };
}

// ---------- facts ----------
function birthdayFact(c: Ctx, short: boolean): ReactNode {
  if (c.sim.deceased) return 'Passed';
  if (c.age.kind === 'age') {
    if (c.age.age.stage === 'elder') return c.age.age.barFull ? 'Final chapter' : 'Elder';
    const d = dateOf(c.age.age.birthdayDay!, c.info.cal);
    return short ? shortSeason(d) : formatDate(d, 'short');
  }
  if (c.age.kind === 'manual') return 'By hand';
  return 'Not set';
}

function Facts({ c, short }: { c: Ctx; short: boolean }) {
  const career = careerText(c.sim);
  const asp = aspirationName(c.sim.aspiration);
  const cls = short ? 'm-fact' : 'fact';
  return (
    <div className={short ? 'm-facts' : 'facts'}>
      <div className={cls}><div className="k">Birthday</div><div className="x">{birthdayFact(c, short)}</div></div>
      <div className={cls}><div className="k">Aspiration</div><div className="x">{asp || 'None yet'}</div></div>
      <div className={cls}><div className="k">Career</div><div className="x">{career ? (short ? career.replace(' · Level ', ' · ') : career) : 'None yet'}</div></div>
    </div>
  );
}

// ---------- through the years ----------
function ThroughTheYears({ c, phone }: { c: Ctx; phone: boolean }) {
  const [menu, setMenu] = useState<StageId | null>(null);
  const picker = usePhotoPicker({ aspect: 0.8, saveId: c.saveId, label: 'Life stage photo' });
  const photos = usePhotos();
  const list = [...c.sim.stagePhotos].sort((a, b) => STAGE_IDS.indexOf(a.stage) - STAGE_IDS.indexOf(b.stage));
  const target = list.find((x) => x.stage === menu);
  return (
    <div className="tyears">
      {list.map((s) => (
        <button key={s.stage} type="button" className="ty" onClick={() => setMenu(s.stage)} aria-label={`${stageName(s.stage)} photo`}>
          <PhotoBox photo={s.photo} aspect={0.8} size="thumb" className="ty-img" />
          <span>{stageName(s.stage)}</span>
        </button>
      ))}
      <button type="button" className="ty" onClick={c.addStagePhoto}>
        <span className="ty-img ty-add"><Plus size={18} /> Add a photo</span>
        <span>&nbsp;</span>
      </button>
      {picker.ui}
      {target && (
        <Confirm title={`${stageName(target.stage)} photo`} onCancel={() => setMenu(null)}
          actions={[
            { label: 'Reposition', kind: 'primary', run: async () => {
              setMenu(null);
              const p = await picker.reposition(target.photo);
              if (p) c.setStagePhotos(list.map((x) => (x.stage === target.stage ? { ...x, photo: p } : x)));
            } },
            { label: 'Remove', kind: 'danger', run: () => {
              setMenu(null);
              c.setStagePhotos(list.filter((x) => x.stage !== target.stage));
              void photos.remove([target.photo.id]);
            } },
            { label: 'Cancel', run: () => setMenu(null) },
          ]} />
      )}
      {phone && null}
    </div>
  );
}

function StagePhotoAdder({ sim, stage, saveId, onClose, onAdd }: { sim: SimData; stage: StageId | null; saveId: string; onClose(): void; onAdd(s: StageId, p: PhotoRef): void }) {
  const upTo = stage ? STAGE_IDS.indexOf(stage) : STAGE_IDS.length - 1;
  const [pick, setPick] = useState<StageId>(stage ?? 'youngAdult');
  const picker = usePhotoPicker({ aspect: 0.8, saveId, label: 'Life stage photo' });
  const taken = new Set(sim.stagePhotos.map((s) => s.stage));
  return (
    <Modal title="Add a photo" onClose={onClose}
      footer={(close) => (<><button type="button" className="btn" onClick={close}>Cancel</button>
        <button type="button" className="btn primary" onClick={async () => { const p = await picker.pick(); if (p) onAdd(pick, p); }}>Choose photo</button></>)}>
      <div className="field">
        <span className="label">Which life stage is it from?</span>
        <div className="chip-row">
          {STAGE_IDS.slice(0, upTo + 1).map((s) => (
            <button key={s} type="button" className="fchip" aria-pressed={pick === s} onClick={() => setPick(s)}>{stageName(s)}{taken.has(s) ? ' (replace)' : ''}</button>
          ))}
        </div>
      </div>
      {picker.ui}
    </Modal>
  );
}

// ---------- cards ----------
function AgeCard({ c, compact }: { c: Ctx; compact?: boolean }) {
  const { age, sim, info } = c;
  if (sim.deceased) {
    const d = sim.deceased.day !== null ? formatDate(dateOf(sim.deceased.day, info.cal), 'full') : null;
    return (
      <div className="age-body">
        <div className="age-line"><b>Passed</b>{d ? ` on ${d}` : ''}.</div>
        {sim.deceased.cause && <div className="muted">Cause: {sim.deceased.cause}</div>}
        {sim.deceased.notes && <p style={{ margin: 0 }}>{sim.deceased.notes}</p>}
      </div>
    );
  }
  if (age.kind === 'manual' || age.kind === 'unset') {
    return (
      <div className="age-body">
        <div className="age-line"><b>{age.kind === 'manual' ? stageName(age.stage) : 'Age not set'}</b></div>
        <div className="muted">Date tracking is off, so you age {sim.first} up by hand.</div>
        {c.canAgeUp && c.nextManual && <div><button type="button" className="btn sm" onClick={c.ageUp}><ArrowUp size={14} weight="bold" /> Age up to {stageName(c.nextManual).toLowerCase()}</button></div>}
      </div>
    );
  }
  if (age.kind === 'notBorn') return <div className="age-body"><div className="age-line">Not born yet. Due {daysWord(age.daysUntilBorn)}.</div></div>;
  const a = age.age;
  const pct = a.stage === 'elder' ? (a.barFull ? 100 : Math.min(100, ((a.daysAsElder ?? 0) / a.stageDays) * 100)) : ((a.dayInStage - 1) / a.stageDays) * 100;
  const born = dateOf(sim.bornDay!, info.cal);
  return (
    <div className="age-body">
      {compact && <div className="age-line"><b>{stageName(a.stage)}</b> · Day {a.dayInStage}{a.stage === 'elder' ? '' : ` of ${a.stageDays}`}</div>}
      <div className="progress"><span style={{ width: `${Math.max(3, pct)}%` }} /></div>
      {a.stage === 'elder' ? (
        a.barFull
          ? <div className="final-chapter"><Hourglass size={16} weight="duotone" /> Age bar full · final chapter</div>
          : <div className="muted">Their age bar fills in {plural(a.stageDays - (a.daysAsElder ?? 0), 'day')}.</div>
      ) : (
        <div>Ages up to <b>{stageName(a.nextStage!).toLowerCase()}</b> {daysWord(a.birthdayIn!)}, on {formatDate(dateOf(a.birthdayDay!, info.cal), 'short')}.</div>
      )}
      <dl className="kv">
        <dt>Lifespan</dt><dd>{lifespanLabel(info.d.lifespan)}</dd>
        <dt>Born</dt><dd>{sim.bornDay! < 0 || born.year < 1 ? 'Before this save began' : `Year ${born.year}`}</dd>
        <dt>Age</dt><dd>{plural(a.ageDays, 'day')} old</dd>
      </dl>
    </div>
  );
}

function aboutRows(c: Ctx): { k: string; v: ReactNode; empty: boolean }[] {
  const traits = c.sim.traits;
  return [
    { k: 'Gender', v: genderName(c.sim.gender), empty: !c.sim.gender },
    { k: 'Pronouns', v: c.sim.pronouns, empty: !c.sim.pronouns },
    { k: 'Orientation', v: c.sim.orientation, empty: !c.sim.orientation },
    { k: 'Occult', v: occultName(c.sim.occult), empty: false },
    { k: 'Aspiration', v: aspirationName(c.sim.aspiration), empty: !c.sim.aspiration },
    { k: 'Career', v: careerText(c.sim), empty: !careerText(c.sim) },
    { k: 'Traits', v: <span className="tags">{traits.map((t) => <span key={t} className="tag sims ink">{traitName(t, c.custom)}</span>)}</span>, empty: traits.length === 0 },
  ];
}

function About({ c, phone }: { c: Ctx; phone: boolean }) {
  const [all, setAll] = useState(false);
  const rows = aboutRows(c);
  const empty = rows.filter((r) => r.empty).length;
  const shown = rows.filter((r) => all || !r.empty);
  const more = empty > 0 && !all && (
    <button type="button" className="link-btn show-more" onClick={() => setAll(true)}>Show more ({empty} empty)</button>
  );
  if (phone) {
    return (
      <div className="m-group">
        {shown.map((r) => (
          <div key={r.k} className={`m-row ${r.k === 'Traits' ? 'col' : ''}`}><span className="k">{r.k}</span><span className="v2">{r.v}</span></div>
        ))}
        {more && <div className="m-row">{more}</div>}
      </div>
    );
  }
  return (
    <>
      <dl className="kv about">{shown.map((r) => <FragmentRow key={r.k} k={r.k} v={r.v} />)}</dl>
      {more}
    </>
  );
}
function FragmentRow({ k, v }: { k: string; v: ReactNode }) { return <><dt>{k}</dt><dd>{v}</dd></>; }

function Relationships({ c, phone }: { c: Ctx; phone: boolean }) {
  if (!c.myRels.length) {
    return <p className="muted" style={{ margin: 0 }}>No one linked yet. Add family, partners, friends and the occasional secret.</p>;
  }
  return (
    <div className={phone ? 'm-group' : 'rel-list'}>
      {c.myRels.map(({ rec, d }) => {
        const other = c.sims.find((s) => s.id === otherSide(d, c.rec.id))!;
        const o = simData(other);
        return (
          <div key={rec.id} className={phone ? 'm-row rel-row' : 'rel-row'}>
            <a className="rel-who" href={savePath(c.saveId, `sims/${other.id}`)}>
              <SimAvatar sim={o} size={phone ? 36 : 34} />
              <span>{fullName(o)}{o.deceased ? <span className="muted small"> · deceased</span> : null}</span>
            </a>
            <span className="rel-what">
              {d.secret && <span className="tag outline secret-tag"><LockSimple size={12} weight="bold" /> Secret</span>}
              <span>{relLabel(d, c.rec.id)}</span>
              <button type="button" className="btn ghost icon sm" aria-label={`Edit relationship with ${fullName(o)}`} onClick={() => c.editRel(rec)}>
                <PencilSimple size={16} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Notes({ c }: { c: Ctx }) {
  return <AutoText key={c.rec.id} label="Notes" placeholder="Anything worth remembering…" value={c.sim.notes} onSave={(notes) => c.update({ notes })} />;
}

function MoreMenu({ c, onClose }: { c: Ctx; onClose(): void }) {
  useLayer(onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [onClose]);
  const item = (label: string, run: () => void, danger = false) => (
    <button type="button" role="menuitem" className={danger ? 'danger' : ''} onClick={() => { onClose(); run(); }}>{label}</button>
  );
  return (
    <div className="combo-list more-menu" role="menu" ref={ref}>
      {c.canAgeUp && c.nextManual && item(`Age up to ${stageName(c.nextManual).toLowerCase()}`, c.ageUp)}
      {c.sim.deceased ? item('Bring back to life', c.bringBack) : item('Mark as deceased', c.markDeceased)}
      {item('Delete Sim', c.del, true)}
    </div>
  );
}

function Tags({ c }: { c: Ctx }) {
  return (
    <div className="tags">
      {c.sim.deceased ? <span className="tag outline">Deceased</span> : <span className="tag sims ink">{[c.stage ? stageName(c.stage) : 'Age not set', c.realAge?.replace(/ old$/, '')].filter(Boolean).join(' · ')}</span>}
      {c.hhName && <span className="tag households ink">{householdLabel(c.hhName)}</span>}
      {c.sim.occult && <span className="tag storylines ink">{occultName(c.sim.occult)}</span>}
    </div>
  );
}

// ---------- desktop ----------
function DesktopProfile({ c }: { c: Ctx }) {
  const [menu, setMenu] = useState(false);
  const picker = usePhotoPicker({ aspect: 1, saveId: c.saveId, label: 'Portrait' });
  const addPortrait = async () => { const p = await picker.pick(); if (p) c.setPortrait(p); };
  return (
    <div className="page stack" style={{ gap: 16 }}>
      <nav className="crumbs" aria-label="Breadcrumb"><a href={savePath(c.saveId, 'sims')}>Sims</a> / <span>{c.name}</span></nav>
      <div className="sim-hero card">
        {c.sim.portrait ? (
          <button type="button" className="sim-hero-photo" aria-label="Reposition portrait"
            onClick={async () => { const p = await picker.reposition(c.sim.portrait!); if (p) c.setPortrait(p); }}>
            <PhotoBox photo={c.sim.portrait} aspect={1} alt={c.name} fill />
          </button>
        ) : (
          <button type="button" className="sim-hero-photo empty-photo" onClick={addPortrait}>
            <span className="big-initials">{initials(c.sim)}</span>
            <span className="small bold">Add a portrait</span>
          </button>
        )}
        <div className="sim-hero-info">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <h1 className="sim-name">{c.name}</h1>
            <div className="row" style={{ position: 'relative', flexWrap: 'nowrap' }}>
              <button type="button" className="btn" onClick={c.edit}><PencilSimple size={16} /> Edit Sim</button>
              <button type="button" className="btn icon" aria-label="More" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><DotsThree size={20} weight="bold" /></button>
              {menu && <MoreMenu c={c} onClose={() => setMenu(false)} />}
            </div>
          </div>
          <Tags c={c} />
          <Facts c={c} short={false} />
          <div>
            <div className="small bold" style={{ marginBottom: 8 }}>Through the years</div>
            <ThroughTheYears c={c} phone={false} />
          </div>
        </div>
      </div>
      <div className="sim-cols">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2><span className="obj sims"><User size={16} weight="duotone" /></span>Age and lifespan</h2>
              {c.age.kind === 'age' && !c.sim.deceased && <span className="muted small">{stageName(c.age.age.stage)} · Day {c.age.age.dayInStage}{c.age.age.stage === 'elder' ? '' : ` of ${c.age.age.stageDays}`}</span>}
            </div>
            <AgeCard c={c} />
          </section>
          <section className="card">
            <div className="card-head"><h2><span className="obj sims"><User size={16} weight="duotone" /></span>About</h2></div>
            <About c={c} phone={false} />
          </section>
          <SimClubs save={c.save} simId={c.rec.id} />
          <SimPhotos save={c.save} simId={c.rec.id} />
          <section className="card">
            <div className="card-head"><h2><span className="obj sims"><User size={16} weight="duotone" /></span>Relationships</h2>
              <button type="button" className="btn sm" onClick={c.addRel}><Plus size={14} weight="bold" /> Add</button></div>
            <Relationships c={c} phone={false} />
          </section>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          {c.hhName && (
            <section className="card">
              <div className="card-head"><h2><span className="obj households"><HouseSimple size={16} weight="duotone" /></span>Household</h2></div>
              <dl className="kv"><dt>Household</dt><dd><a href={savePath(c.saveId, `households/${c.sim.householdId}`)}>{householdLabel(c.hhName)}</a></dd><dt>Members</dt><dd>{plural(c.members, 'Sim')}</dd></dl>
            </section>
          )}
          <ComingUp save={c.save} simIds={[c.rec.id]} seeAll={`calendar/sim/${c.rec.id}`} />
          <section className="card">
            <div className="card-head"><h2>Notes</h2></div>
            <Notes c={c} />
          </section>
        </div>
      </div>
      {picker.ui}
    </div>
  );
}

// ---------- phone ----------
function PhoneProfile({ c }: { c: Ctx }) {
  const [tab, setTab] = useState<'about' | 'family' | 'notes'>('about');
  const picker = usePhotoPicker({ aspect: 1, saveId: c.saveId, label: 'Portrait' });
  const back = <a className="pp-round" href={savePath(c.saveId, 'sims')} aria-label="Back to Sims"><CaretLeft size={20} weight="bold" /></a>;
  const edit = <button type="button" className="pp-edit" onClick={c.edit}>Edit</button>;
  const subline = [c.sim.deceased ? 'Deceased' : c.stage ? stageName(c.stage) : 'Age not set', c.realAge?.replace(/ old$/, '') ?? '', c.sim.occult ? occultName(c.sim.occult) : '', c.hhName ? householdLabel(c.hhName) : '']
    .filter(Boolean).join(' · ');

  const body = (
    <div className="m-stack pp-body">
      <Facts c={c} short />
      <div className="m-seg pp-tabs" role="tablist">
        {(['about', 'family', 'notes'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'about' ? 'About' : t === 'family' ? 'Family' : 'Notes'}
          </button>
        ))}
      </div>
      {tab === 'about' && (
        <>
          <div className="m-label">Age and lifespan</div>
          <div className="m-group"><div className="m-row col"><AgeCard c={c} compact /></div></div>
          <ComingUp save={c.save} simIds={[c.rec.id]} seeAll={`calendar/sim/${c.rec.id}`} />
          <SimClubs save={c.save} simId={c.rec.id} phone />
          <SimPhotos save={c.save} simId={c.rec.id} phone />
          <div className="m-label">Details</div>
          <About c={c} phone />
          <div className="m-label">Through the years</div>
          <ThroughTheYears c={c} phone />
          {c.hhName && (
            <div className="m-group"><a className="m-row" href={savePath(c.saveId, `households/${c.sim.householdId}`)}><span className="grow"><span className="t" style={{ display: 'block' }}>Household</span><span className="s">{householdLabel(c.hhName)} · {plural(c.members, 'Sim')}</span></span><CaretRight size={16} weight="bold" className="chev" /></a></div>
          )}
          <div className="m-group">
            {c.canAgeUp && c.nextManual && <button type="button" className="m-row" onClick={c.ageUp}><span className="t grow">Age up to {stageName(c.nextManual).toLowerCase()}</span><CaretRight size={16} weight="bold" className="chev" /></button>}
            <button type="button" className="m-row" onClick={c.sim.deceased ? c.bringBack : c.markDeceased}><span className="t grow">{c.sim.deceased ? 'Bring back to life' : 'Mark as deceased'}</span><CaretRight size={16} weight="bold" className="chev" /></button>
            <button type="button" className="m-row" onClick={c.del}><span className="t grow" style={{ color: 'var(--danger)' }}>Delete Sim</span></button>
          </div>
        </>
      )}
      {tab === 'family' && (
        <>
          <Relationships c={c} phone />
          <button type="button" className="m-softbtn" onClick={c.addRel}><Plus size={18} weight="bold" /> Add a relationship</button>
        </>
      )}
      {tab === 'notes' && <Notes c={c} />}
      {picker.ui}
    </div>
  );

  if (!c.sim.portrait) {
    return (
      <div className="pp pp-small">
        <div className="pp-bar">{back}{edit}</div>
        <div className="pp-who">
          <button type="button" className="pp-circle initials" aria-label="Add a portrait" onClick={async () => { const p = await picker.pick(); if (p) c.setPortrait(p); }}>{initials(c.sim)}</button>
          <div style={{ minWidth: 0 }}><h1 className="pp-name">{c.name}</h1><div className="pp-sub">{subline}</div></div>
        </div>
        {body}
      </div>
    );
  }
  return <ShrinkingHeader c={c} back={back} edit={edit} subline={subline}>{body}</ShrinkingHeader>;
}

/** The big photo that shrinks into the small circle as you scroll up (and grows back down). */
function ShrinkingHeader({ c, back, edit, subline, children }: { c: Ctx; back: ReactNode; edit: ReactNode; subline: string; children: ReactNode }) {
  const photo = useRef<HTMLDivElement>(null);
  const nameEl = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 390 : Math.min(window.innerWidth, 860)));
  const top = 12; // under the status bar (plus the safe area, added in CSS)
  const big = w; // square photo, full width
  const collapsed = { x: 20, y: 56, size: 64 };
  const distance = big - (collapsed.y + collapsed.size + 14);
  useLayoutEffect(() => {
    const draw = () => {
      const p = Math.max(0, Math.min(1, window.scrollY / distance));
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const L = (a: number, b: number) => a + (b - a) * e;
      const el = photo.current;
      if (el) {
        el.style.transform = `translate(${L(0, collapsed.x)}px, ${L(0, collapsed.y)}px)`;
        el.style.width = `${L(big, collapsed.size)}px`;
        el.style.height = `${L(big, collapsed.size)}px`;
        el.style.borderRadius = `${L(0, collapsed.size / 2)}px`;
      }
      if (shade.current) shade.current.style.opacity = String(1 - e);
      if (bar.current) bar.current.style.opacity = String(e);
      const n = nameEl.current;
      if (n) {
        n.style.transform = `translate(${L(20, collapsed.x + collapsed.size + 14)}px, ${L(big - 92, collapsed.y + 8)}px)`;
      }
    };
    const resize = () => setW(Math.min(window.innerWidth, 860));
    draw();
    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('scroll', draw); window.removeEventListener('resize', resize); };
  }, [big, distance]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pp pp-big">
      <div className="pp-fixed" style={{ ['--pp-top' as string]: `${top}px` }}>
        <div className="pp-headbar" ref={bar} style={{ height: collapsed.y + collapsed.size + 14 }} />
        <div className="pp-photo" ref={photo}>
          <PhotoBox photo={c.sim.portrait!} aspect={1} alt={c.name} fill />
          <div className="pp-shade" ref={shade} />
        </div>
        <div className="pp-namebox" ref={nameEl}>
          <h1 className="pp-name">{c.name}</h1>
          <div className="pp-sub">{subline}</div>
        </div>
        <div className="pp-bar floating">{back}{edit}</div>
      </div>
      <div style={{ height: big + 16 }} aria-hidden="true" />
      {children}
    </div>
  );
}

// ---------- dialogs ----------
function DeceasedDialog({ info, sim, onClose, onSave }: { info: SaveInfo; sim: SimData; onClose(): void; onSave(d: SimData['deceased']): void }) {
  const [date, setDate] = useState(() => dateOf(info.today, info.cal));
  const [cause, setCause] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Modal title={`Remember ${sim.first || 'them'}`} onClose={onClose} dirty={!!(cause || notes)}
      footer={(close) => (<><button type="button" className="btn" onClick={close}>Cancel</button>
        <button type="button" className="btn primary" onClick={() => onSave({ day: info.track ? dayOf(date, info.cal) : null, cause: cause.trim(), notes: notes.trim() })}>Mark as deceased</button></>)}>
      <div className="stack" style={{ gap: 16 }}>
        <p className="muted" style={{ margin: 0 }}>They stay in your records, relationships and family, just out of the living lists. You can bring them back any time.</p>
        {info.track && <div className="field"><span className="label">When did they pass?</span><DateFields label="When they passed" value={date} onChange={setDate} seasonLength={info.cal.seasonLength} today={dateOf(info.today, info.cal)} /></div>}
        <Field label="Cause (optional)">{(id) => <TextInput id={id} placeholder="Old age, pufferfish…" value={cause} onChange={(e) => setCause(e.target.value)} maxLength={80} />}</Field>
        <Field label="Notes (optional)">{(id) => <textarea id={id} className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

function RelationshipForm({ simId, sims, rels, rel, onClose }: { simId: string; sims: Rec[]; rels: Rec[]; rel: Rec | null; onClose(): void }) {
  const store = useStore();
  const me = simData(sims.find((s) => s.id === simId));
  const start = rel ? relData(rel) : null;
  const startOther = start ? otherSide(start, simId) : '';
  const [other, setOther] = useState(startOther);
  const [type, setType] = useState<RelType>(start?.type ?? 'friend');
  // For parent / child: is the other Sim my parent, or my child?
  const [otherIsParent, setOtherIsParent] = useState(start ? start.type === 'parent' && start.a === startOther : true);
  const [myLabel, setMyLabel] = useState(start ? (start.a === simId ? start.labelA : start.labelB) : '');
  const [theirLabel, setTheirLabel] = useState(start ? (start.a === simId ? start.labelB : start.labelA) : '');
  const [secret, setSecret] = useState(start?.secret ?? false);
  const o = other ? simData(sims.find((s) => s.id === other)) : null;
  const otherName = o ? o.first || fullName(o) : 'them';
  const options = sims.filter((s) => s.id !== simId).map((s) => ({ id: s.id, label: fullName(simData(s)) })).sort((a, b) => a.label.localeCompare(b.label));
  const existing = other ? rels.filter((r) => r.id !== rel?.id).map(relData).find((d) => (d.a === simId && d.b === other) || (d.b === simId && d.a === other)) : null;
  const dirty = other !== startOther || myLabel !== (start ? (start.a === simId ? start.labelA : start.labelB) : '') || secret !== (start?.secret ?? false) || type !== (start?.type ?? 'friend');

  const save = () => {
    if (!other) return;
    const parentFirst = type === 'parent' && otherIsParent;
    const a = parentFirst ? other : simId;
    const b = parentFirst ? simId : other;
    const data: RelData = { a, b, type, labelA: a === simId ? myLabel.trim() : theirLabel.trim(), labelB: a === simId ? theirLabel.trim() : myLabel.trim(), secret };
    store.put('rel', data as unknown as Record<string, unknown>, rel?.id);
    onClose();
  };
  return (
    <Modal title={rel ? 'Edit relationship' : `Add a relationship for ${me.first || 'this Sim'}`} onClose={onClose} dirty={dirty}
      footer={(close) => (
        <>
          {rel && <button type="button" className="btn danger" onClick={() => { store.moveToTrash(rel.id, 'Relationship'); onClose(); }}>Remove</button>}
          <span className="grow" />
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn primary" disabled={!other} onClick={save}>Save</button>
        </>
      )}>
      {options.length === 0 ? <p className="muted" style={{ margin: 0 }}>Add another Sim first, then link them here.</p> : (
        <div className="stack" style={{ gap: 16 }}>
          <Field label="Who">{(id) => <Picker id={id} options={options} value={other ? [other] : []} onChange={(v) => setOther(v[0] ?? '')} placeholder="Search Sims" />}</Field>
          {existing && <div className="notice warn small" role="status">{me.first} and {otherName} are already linked as {relLabel(existing, simId).toLowerCase()}. You can still add this.</div>}
          <Field label="Relationship">
            {(id) => (
              <select id={id} className="select" value={type} onChange={(e) => setType(e.target.value as RelType)}>
                {REL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            )}
          </Field>
          {type === 'parent' && (
            <Seg<'parent' | 'child'> label="Direction" value={otherIsParent ? 'parent' : 'child'} onChange={(v) => setOtherIsParent(v === 'parent')}
              options={[{ v: 'parent', label: `${o ? otherName : 'They’re'}${o ? ' is' : ''} ${me.first}’s parent` }, { v: 'child', label: `${o ? otherName : 'They’re'}${o ? ' is' : ''} ${me.first}’s child` }]} />
          )}
          <div className="form-grid">
            <Field label={`On ${me.first || 'this Sim'}’s profile (optional)`} hint={`What ${me.first} calls ${otherName}, like “Biological father”.`}>
              {(id) => <TextInput id={id} value={myLabel} onChange={(e) => setMyLabel(e.target.value)} maxLength={40} />}
            </Field>
            <Field label={`On ${otherName}’s profile (optional)`} hint={`What ${otherName} calls ${me.first}.`}>
              {(id) => <TextInput id={id} value={theirLabel} onChange={(e) => setTheirLabel(e.target.value)} maxLength={40} />}
            </Field>
          </div>
          <label className="switch-line"><span><b>Secret</b><span className="muted small" style={{ display: 'block' }}>Shows a lock on both profiles, for things other Sims don’t know.</span></span><Toggle label="Secret" on={secret} onChange={setSecret} /></label>
        </div>
      )}
    </Modal>
  );
}
