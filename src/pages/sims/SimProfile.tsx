import { SimPhotos } from '../photos/PhotosPage';
import { SimClubs } from '../clubs/SimClubs';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp, Briefcase, CalendarBlank, Camera, CaretLeft, CaretRight, DotsThree, Fire, HeartBreak, Hourglass, HouseSimple, LockSimple, PencilSimple, Plus,
  ThumbsDown, ThumbsUp, User, UsersThree, Baby, HeartStraight, Heart, Diamond, Star, Smiley, Lightning, Bed, TreeStructure, type Icon,
} from '@phosphor-icons/react';
import { DateFields } from '../../components/savebits';
import { AgeFields, bornDayFromInput, defaultAge, inputFromBornDay, type AgeInput } from '../../components/AgeFields';
import { PhotoBox, usePhotoPicker } from '../../components/photo';
import { AutoText, Confirm, Field, Modal, Picker, Seg, TextInput, Toggle, toast } from '../../components/ui';
import { useLayer } from '../../lib/layers';
import { usePhotos, type PhotoRef } from '../../lib/photos';
import { go, savePath } from '../../lib/router';
import { lifespanLabel } from '../../lib/saves';
import {
  ASPIRATION_TEXT, BLANK_SIM, aspirationName, careerText, daysWord, fullName, genderName, householdLabel, initials, occultName, otherSide, REL_TYPES, relData,
  relLabel, relRank, shortSeason, simAge, simData, stageOf, traitName, type RelData, type RelType, type SimAge, type SimData, type Gender,
} from '../../lib/sims';
import { plural } from '../../lib/text';
import { useRecords, useStore } from '../../lib/sync/react';
import type { Rec, SaveRow } from '../../lib/sync/types';
import { dateOf, dayOf, formatDate, STAGE_IDS, stageName, type StageId } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import { SimForm } from './SimForm';
import { ChoiceList, RowPop } from './RowEdit';
import {
  aspirationOptions, occultOptions, SimAvatar, traitOptions, useCustomTraits, useHouseholds, useRealAge, useRealAgeRanges, useSaveInfo, type SaveInfo,
} from './shared';
import { PlayingTag } from '../rotation/Rotation';
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
  // Reads the latest copy first, so an Undo a few seconds later doesn't undo anything else.
  const update = (patch: Partial<SimData>) => store.put('sim', { ...(store.get(rec.id)?.data ?? rec.data), ...patch }, rec.id);

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
        <RelationshipForm info={info} simId={rec.id} sims={sims} rels={rels} rel={dialog.rel} onClose={() => setDialog(null)} />
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

/** The Age block: real-life age when the save shows it, otherwise days old. */
function ageFact(c: Ctx): string | null {
  if (c.sim.deceased) return null;
  if (c.realAge) return c.realAge.replace(/ old$/, '');
  if (c.age.kind === 'age') return plural(c.age.age.ageDays, 'day');
  return null;
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

const EMPTY = <span className="muted empty-dash">--</span>;

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

// ---------- desktop ----------
function DesktopProfile({ c }: { c: Ctx }) {
  const [relEdit, setRelEdit] = useState(false);
  return (
    <div className="page stack cp" style={{ gap: 16 }}>
      <nav className="crumbs" aria-label="Breadcrumb"><a href={savePath(c.saveId, 'sims')}>Sims</a> / <span>{c.name}</span></nav>
      <CompactHero c={c} phone={false} />
      <div className="cp-cols">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2><span className="obj sims"><UsersThree size={16} weight="duotone" /></span>Relationships</h2>
              <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                {c.myRels.length > 0 && <button type="button" className={`btn ghost icon sm${relEdit ? ' on' : ''}`} aria-pressed={relEdit} aria-label="Edit relationships" onClick={() => setRelEdit((x) => !x)}><PencilSimple size={16} /></button>}
                <button type="button" className="btn sm" onClick={c.addRel}><Plus size={14} weight="bold" /> Add</button>
              </span></div>
            <RelGroups c={c} phone={false} editing={relEdit} />
          </section>
          <section className="card">
            <div className="card-head"><h2><span className="obj sims"><User size={16} weight="duotone" /></span>About</h2></div>
            <AboutRows c={c} phone={false} />
          </section>
          {hasLikes(c) && (
            <section className="card">
              <div className="card-head"><h2><span className="obj sims"><Fire size={16} weight="duotone" /></span>Likes and turn ons</h2></div>
              <LikesBody c={c} phone={false} />
            </section>
          )}
          <SimClubs save={c.save} simId={c.rec.id} />
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <ComingUp save={c.save} simIds={[c.rec.id]} seeAll={`calendar/sim/${c.rec.id}`} />
          {c.hhName && (
            <section className="card">
              <div className="card-head"><h2><span className="obj households"><HouseSimple size={16} weight="duotone" /></span>
                <a href={savePath(c.saveId, `households/${c.sim.householdId}`)} className="cp-hh-link">{householdLabel(c.hhName)}</a></h2></div>
              <HouseholdFaces c={c} />
            </section>
          )}
          <section className="card">
            <div className="card-head"><h2>Notes</h2></div>
            <Notes c={c} />
          </section>
          <PhotosAndYears c={c} phone={false} />
        </div>
      </div>
    </div>
  );
}

// ---------- phone ----------
function PhoneProfile({ c }: { c: Ctx }) {
  const picker = usePhotoPicker({ aspect: 1, saveId: c.saveId, label: 'Portrait' });
  const back = <a className="pp-round" href={savePath(c.saveId, 'sims')} aria-label="Back to Sims"><CaretLeft size={20} weight="bold" /></a>;
  const edit = <button type="button" className="pp-edit" onClick={c.edit}>Edit</button>;
  const subline = [c.sim.deceased ? 'Deceased' : c.stage ? stageName(c.stage) : 'Age not set', c.sim.occult ? occultName(c.sim.occult) : '', c.hhName ? householdLabel(c.hhName) : '']
    .filter(Boolean).join(' · ');

  const [relEdit, setRelEdit] = useState(false);
  const body = (
    <div className="m-stack pp-body cp">
      {!c.sim.portrait && <CompactHero c={c} phone />}
      {c.sim.portrait && <CompactLine c={c} />}
      <div className="m-label edit-label"><span>Relationships</span>
        <span className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
          {c.myRels.length > 0 && <button type="button" className={`btn ghost icon sm${relEdit ? ' on' : ''}`} aria-pressed={relEdit} aria-label="Edit relationships" onClick={() => setRelEdit((x) => !x)}><PencilSimple size={16} /></button>}
          <button type="button" className="link-btn m-add" onClick={c.addRel}><Plus size={14} weight="bold" /> Add</button>
        </span>
      </div>
      <div className="m-group cp-pad"><RelGroups c={c} phone editing={relEdit} /></div>
      <ComingUp save={c.save} simIds={[c.rec.id]} seeAll={`calendar/sim/${c.rec.id}`} />
      <div className="m-label">About</div>
      <div className="m-group cp-pad"><AboutRows c={c} phone /></div>
      {hasLikes(c) && (<><div className="m-label">Likes and turn ons</div><div className="m-group cp-pad"><LikesBody c={c} phone /></div></>)}
      <SimClubs save={c.save} simId={c.rec.id} phone />
      {c.hhName && (
        <>
          <div className="m-label edit-label"><span>{householdLabel(c.hhName)}</span>
            <a className="link-btn m-add" href={savePath(c.saveId, `households/${c.sim.householdId}`)}>Open <CaretRight size={14} weight="bold" /></a></div>
          <div className="m-group cp-pad"><HouseholdFaces c={c} /></div>
        </>
      )}
      <div className="m-label">Notes</div>
      <Notes c={c} />
      <PhotosAndYears c={c} phone />
      <div className="m-group">
        {c.canAgeUp && c.nextManual && <button type="button" className="m-row" onClick={c.ageUp}><span className="t grow">Age up to {stageName(c.nextManual).toLowerCase()}</span><CaretRight size={16} weight="bold" className="chev" /></button>}
        <button type="button" className="m-row" onClick={c.sim.deceased ? c.bringBack : c.markDeceased}><span className="t grow">{c.sim.deceased ? 'Bring back to life' : 'Mark as deceased'}</span><CaretRight size={16} weight="bold" className="chev" /></button>
        <button type="button" className="m-row" onClick={c.del}><span className="t grow" style={{ color: 'var(--danger)' }}>Delete Sim</span></button>
      </div>
      {picker.ui}
    </div>
  );

  if (!c.sim.portrait) {
    return (
      <div className="pp pp-small">
        <div className="pp-bar">{back}{edit}</div>
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

// ---------- edit in place ----------
/** Escape cancels an in-place edit (unless a pop-up is open on top of it). */
function useEscape(run: () => void) {
  const ref = useRef(run);
  ref.current = run;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"]')) ref.current(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
}




function EditFoot({ cancel, save }: { cancel(): void; save(): void }) {
  return (
    <div className="edit-foot">
      <button type="button" className="btn" onClick={cancel}>Cancel</button>
      <button type="button" className="btn primary" onClick={save}>Done</button>
    </div>
  );
}

const PRONOUNS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they'];
const ORIENTATIONS = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Exploring'];


function AgeEdit({ c, done }: { c: Ctx; done(): void }) {
  const { info, sim } = c;
  const { ranges } = useRealAgeRanges();
  const [age, setAge] = useState<AgeInput>(() => (sim.bornDay != null ? inputFromBornDay(sim.bornDay, info.today, info.table) : defaultAge('youngAdult', info.table)));
  const [stage, setStage] = useState<StageId>(sim.stage ?? 'youngAdult');
  const stageId = useId();
  useEscape(done);
  const save = () => {
    if (info.track) c.update({ bornDay: bornDayFromInput(age, info.today, info.table), stage: null });
    else c.update({ stage });
    done();
  };
  return (
    <div className="age-body">
      {info.track ? (
        <AgeFields value={age} onChange={setAge} table={info.table} today={info.today} calendar={info.cal} realAges={info.d.realAges ? ranges : null} />
      ) : (
        <div className="field">
          <label htmlFor={stageId}>Life stage</label>
          <select id={stageId} className="select" value={stage} onChange={(e) => setStage(e.target.value as StageId)}>
            {STAGE_IDS.map((s) => <option key={s} value={s}>{stageName(s)}</option>)}
          </select>
        </div>
      )}
      <EditFoot cancel={done} save={save} />
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

const NEW_SIM = '__new-sim__';
type NewSim = { first: string; last: string; stage: StageId; gender: Gender | null };

const REL_ICONS: Record<RelType, Icon> = {
  parent: Baby, sibling: UsersThree, spouse: HeartStraight, partner: Heart, fiance: Diamond, ex: HeartBreak,
  bestFriend: Star, friend: Smiley, enemy: Lightning, roommate: Bed, cousin: TreeStructure, other: DotsThree,
};

function RelationshipForm({ info, simId, sims, rels, rel, onClose }: { info: SaveInfo; simId: string; sims: Rec[]; rels: Rec[]; rel: Rec | null; onClose(): void }) {
  const store = useStore();
  const hh = useHouseholds();
  const ids = { ns: useId() };
  const [fresh, setFresh] = useState<NewSim | null>(null);
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
  const [more, setMore] = useState(!!(myLabel || theirLabel || secret));
  const isNew = other === NEW_SIM && !!fresh;
  // Housemates come first, one tap each (not ones already linked).
  const linked = new Set(rels.map(relData).filter((d) => d.a === simId || d.b === simId).map((d) => otherSide(d, simId)));
  const mates = me.householdId ? sims.filter((s) => s.id !== simId && simData(s).householdId === me.householdId && !linked.has(s.id)) : [];
  const o = isNew ? null : other ? simData(sims.find((s) => s.id === other)) : null;
  const otherName = isNew ? fresh!.first.trim() || 'them' : o ? o.first || fullName(o) : 'them';
  const theirWord = isNew ? (fresh!.gender === 'male' ? 'his' : fresh!.gender === 'female' ? 'her' : 'their') : 'their';
  const options = sims.filter((s) => s.id !== simId).map((s) => ({ id: s.id, label: fullName(simData(s)) })).sort((a, b) => a.label.localeCompare(b.label));
  const existing = other && !isNew ? rels.filter((r) => r.id !== rel?.id).map(relData).find((d) => (d.a === simId && d.b === other) || (d.b === simId && d.a === other)) : null;
  const dirty = other !== startOther || myLabel !== (start ? (start.a === simId ? start.labelA : start.labelB) : '') || secret !== (start?.secret ?? false) || type !== (start?.type ?? 'friend');

  const save = (again = false) => {
    if (!other || (isNew && !fresh!.first.trim())) return;
    let otherId = other;
    if (isNew) {
      const n = fresh!;
      const data: SimData = {
        ...BLANK_SIM, first: n.first.trim(), last: n.last.trim(), gender: n.gender,
        ...(info.track ? { bornDay: bornDayFromInput(defaultAge(n.stage, info.table), info.today, info.table), addedDay: info.today } : { stage: n.stage }),
      };
      otherId = store.put('sim', data as unknown as Record<string, unknown>);
      toast(`${fullName(data)} added`);
    }
    const parentFirst = type === 'parent' && otherIsParent;
    const a = parentFirst ? otherId : simId;
    const b = parentFirst ? simId : otherId;
    const data: RelData = { a, b, type, labelA: a === simId ? myLabel.trim() : theirLabel.trim(), labelB: a === simId ? theirLabel.trim() : myLabel.trim(), secret };
    store.put('rel', data as unknown as Record<string, unknown>, rel?.id);
    if (again) {
      toast(`Linked ${me.first} and ${isNew ? fresh!.first.trim() : otherName}`);
      setOther(''); setFresh(null); setType('friend'); setMyLabel(''); setTheirLabel(''); setSecret(false); setMore(false); setOtherIsParent(true);
      return;
    }
    onClose();
  };
  return (
    <Modal title={rel ? 'Edit relationship' : `Add a relationship for ${me.first || 'this Sim'}`} onClose={onClose} dirty={dirty}
      footer={(close) => (
        <>
          {rel && <button type="button" className="btn danger" onClick={() => { store.moveToTrash(rel.id, 'Relationship'); onClose(); }}>Remove</button>}
          <span className="grow" />
          {rel && <button type="button" className="btn" onClick={close}>Cancel</button>}
          {!rel && <button type="button" className="btn ghost" disabled={!other || (isNew && !fresh!.first.trim())} onClick={() => save(true)}><Plus size={16} weight="bold" /> Save and add another</button>}
          <button type="button" className="btn primary" disabled={!other || (isNew && !fresh!.first.trim())} onClick={() => save()}>Save</button>
        </>
      )}>
      {(
        <div className="stack" style={{ gap: 16 }}>
          {isNew ? (
            <div className="field">
              <span className="label">Who</span>
              <div className="new-sim-box">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>New Sim</b>
                  <button type="button" className="link-btn" onClick={() => { setOther(''); setFresh(null); }}>Change</button>
                </div>
                <div className="form-grid">
                  <Field label="First name">{(id) => <TextInput kind="name" id={id} value={fresh!.first} onChange={(e) => setFresh({ ...fresh!, first: e.target.value })} maxLength={60} />}</Field>
                  <Field label="Last name">{(id) => <TextInput kind="name" id={id} value={fresh!.last} onChange={(e) => setFresh({ ...fresh!, last: e.target.value })} maxLength={60} />}</Field>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={ids.ns}>Life stage</label>
                    <select id={ids.ns} className="select" value={fresh!.stage} onChange={(e) => setFresh({ ...fresh!, stage: e.target.value as StageId })}>
                      {STAGE_IDS.map((s) => <option key={s} value={s}>{stageName(s)}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <span className="label">Gender</span>
                    <div className="seg" role="group" aria-label="Gender">
                      {(['male', 'female'] as Gender[]).map((g) => (
                        <button key={g} type="button" aria-pressed={fresh!.gender === g} onClick={() => setFresh({ ...fresh!, gender: fresh!.gender === g ? null : g })}>{g === 'male' ? 'Male' : 'Female'}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="muted small">Saved with the relationship. Fill in the rest on {theirWord} profile any time.</div>
              </div>
            </div>
          ) : (
            <>
            {!rel && mates.length > 0 && (
              <div className="field">
                <span className="label">Who</span>
                <div className="muted small" style={{ marginTop: -4 }}>In {householdLabel(hh.nameOf(me.householdId))}</div>
                <div className="rel-mates">
                  {mates.map((s) => {
                    const sd = simData(s);
                    return (
                      <button key={s.id} type="button" className="rel-mate" aria-pressed={other === s.id} onClick={() => setOther(other === s.id ? '' : s.id)}>
                        <SimAvatar sim={sd} size={28} />{fullName(sd)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Field label={!rel && mates.length > 0 ? 'Or search all Sims' : 'Who'}>{(id) => <Picker id={id} options={options} value={other ? [other] : []} onChange={(v) => setOther(v[0] ?? '')} placeholder="Search Sims"
              onAdd={(label) => { const [first, ...rest] = label.split(/\s+/); setFresh({ first, last: rest.join(' '), stage: 'youngAdult', gender: null }); return NEW_SIM; }}
              addLabel={(t) => `Make a new Sim, “${t}”`} />}</Field>
            </>
          )}
          {existing && <div className="notice warn small" role="status">{me.first} and {otherName} are already linked as {relLabel(existing, simId).toLowerCase()}. You can still add this.</div>}
          <div className="field">
            <span className="label">{o || isNew ? `${otherName} is ${me.first || 'this Sim'}’s` : 'Relationship'}</span>
            <div className="rel-tiles" role="radiogroup" aria-label="Relationship">
              {REL_TYPES.map((t) => {
                const I = REL_ICONS[t.id];
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={type === t.id} className="rel-tile" onClick={() => setType(t.id)}>
                    <I size={18} weight={type === t.id ? 'fill' : 'duotone'} aria-hidden="true" />{t.id === 'parent' ? 'Parent' : t.id === 'other' ? 'Other' : t.label}
                  </button>
                );
              })}
            </div>
          </div>
          {type === 'parent' && (
            <Seg<'parent' | 'child'> label="Direction" value={otherIsParent ? 'parent' : 'child'} onChange={(v) => setOtherIsParent(v === 'parent')}
              options={[{ v: 'parent', label: `${o || isNew ? otherName : 'They’re'}${o || isNew ? ' is' : ''} ${me.first}’s parent` }, { v: 'child', label: `${o || isNew ? otherName : 'They’re'}${o || isNew ? ' is' : ''} ${me.first}’s child` }]} />
          )}
          {!more && <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(true)}>Names on profiles, secret</button>}
          {more && <>
          <div className="form-grid">
            <Field label={`On ${me.first || 'this Sim'}’s profile (optional)`} hint={`What ${me.first} calls ${otherName}, like “Biological father”.`}>
              {(id) => <TextInput id={id} value={myLabel} onChange={(e) => setMyLabel(e.target.value)} maxLength={40} />}
            </Field>
            <Field label={`On ${otherName}’s profile (optional)`} hint={`What ${otherName} calls ${me.first}.`}>
              {(id) => <TextInput id={id} value={theirLabel} onChange={(e) => setTheirLabel(e.target.value)} maxLength={40} />}
            </Field>
          </div>
          <label className="switch-line"><span><b>Secret</b><span className="muted small" style={{ display: 'block' }}>Shows a lock on both profiles, for things other Sims don’t know.</span></span><Toggle label="Secret" on={secret} onChange={setSecret} /></label>
          </>}
        </div>
      )}
    </Modal>
  );
}

// ---------- compact profile (Nov 2026) ----------
/** "Elder in 370 days", the age bar's fill, and the stage, or null when there's no running age. */
function ageLine(c: Ctx): { stage: string; pct: number; next: string | null } | null {
  if (c.sim.deceased || c.age.kind !== 'age') return null;
  const a = c.age.age;
  const pct = a.stage === 'elder' ? (a.barFull ? 100 : Math.min(100, ((a.daysAsElder ?? 0) / a.stageDays) * 100)) : ((a.dayInStage - 1) / a.stageDays) * 100;
  const next = a.stage === 'elder'
    ? (a.barFull ? 'Age bar full · final chapter' : `Age bar fills in ${plural(a.stageDays - (a.daysAsElder ?? 0), 'day')}`)
    : `${stageName(a.nextStage!)} ${a.birthdayIn! <= 0 ? 'today' : a.birthdayIn === 1 ? 'tomorrow' : `in ${plural(a.birthdayIn!, 'day')}`}`;
  return { stage: stageName(a.stage), pct, next };
}

/** The banner: portrait, name, one line of facts and the age bar. Tap the age for lifespan details. */
function CompactHero({ c, phone }: { c: Ctx; phone: boolean }) {
  const [menu, setMenu] = useState(false);
  const [ageOpen, setAgeOpen] = useState(false);
  const picker = usePhotoPicker({ aspect: 1, saveId: c.saveId, label: 'Portrait' });
  const addPortrait = async () => { const p = await picker.pick(); if (p) c.setPortrait(p); };
  const al = ageLine(c);
  const stageText = c.sim.deceased ? 'Deceased' : c.stage ? stageName(c.stage) : 'Age not set';
  const age = ageFact(c);
  const bday = !c.sim.deceased && c.age.kind === 'age' && c.age.age.stage !== 'elder' ? formatDate(dateOf(c.age.age.birthdayDay!, c.info.cal), 'short') : null;
  const career = careerText(c.sim);
  return (
    <div className="cp-hero card">
      {c.sim.portrait ? (
        <button type="button" className="cp-pt" aria-label="Reposition portrait"
          onClick={async () => { const p = await picker.reposition(c.sim.portrait!); if (p) c.setPortrait(p); }}>
          <PhotoBox photo={c.sim.portrait} aspect={1} alt={c.name} fill />
        </button>
      ) : (
        <button type="button" className="cp-pt empty" aria-label="Add a portrait" onClick={addPortrait}>
          <span>{initials(c.sim)}</span>
          <span className="cp-cam" aria-hidden="true"><Camera size={16} weight="bold" /></span>
        </button>
      )}
      <div className="cp-who">
        <h1 className="cp-name">{c.name}</h1>
        <div className="cp-line">
          <button type="button" className="cp-it cp-age" onClick={() => setAgeOpen(true)} aria-label="Age and lifespan">
            <b>{stageText}</b>{age ? <> · {age}</> : null}
          </button>
          {bday && <span className="cp-it"><CalendarBlank size={16} aria-hidden="true" />{bday}</span>}
          {c.sim.deceased && <span className="cp-it">Passed{c.sim.deceased.day !== null ? ` ${formatDate(dateOf(c.sim.deceased.day, c.info.cal), 'short')}, Year ${dateOf(c.sim.deceased.day, c.info.cal).year}` : ''}</span>}
          {c.hhName && <a className="cp-it cp-link" href={savePath(c.saveId, `households/${c.sim.householdId}`)}><HouseSimple size={16} aria-hidden="true" />{householdLabel(c.hhName)}</a>}
          <PlayingTag save={c.save} hhId={c.sim.householdId} />
          {c.sim.occult && <span className="cp-it">{occultName(c.sim.occult)}</span>}
          {!phone && career && <span className="cp-it"><Briefcase size={16} aria-hidden="true" />{career}</span>}
        </div>
        {al && (
          <button type="button" className="cp-agebar" onClick={() => setAgeOpen(true)} aria-label="Age and lifespan">
            <span className="bar"><i style={{ width: `${Math.max(3, al.pct)}%` }} /></span>{al.next}
          </button>
        )}
        {!al && c.canAgeUp && c.nextManual && (
          <button type="button" className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={c.ageUp}><ArrowUp size={14} weight="bold" /> Age up to {stageName(c.nextManual).toLowerCase()}</button>
        )}
      </div>
      {!phone && (
        <div className="cp-acts">
          <button type="button" className="btn icon" aria-label="Edit Sim" onClick={c.edit}><PencilSimple size={20} /></button>
          <span style={{ position: 'relative' }}>
            <button type="button" className="btn icon" aria-label="More" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><DotsThree size={20} weight="bold" /></button>
            {menu && <MoreMenu c={c} onClose={() => setMenu(false)} />}
          </span>
        </div>
      )}
      {ageOpen && <AgeDialog c={c} onClose={() => setAgeOpen(false)} />}
      {picker.ui}
    </div>
  );
}

function AgeDialog({ c, onClose }: { c: Ctx; onClose(): void }) {
  const [editing, setEditing] = useState(false);
  return (
    <Modal title="Age and lifespan" onClose={onClose} autoFocus={false}
      footer={editing ? undefined : (<>
        {!c.sim.deceased && <button type="button" className="btn" onClick={() => setEditing(true)}><PencilSimple size={16} /> Change age</button>}
        <button type="button" className="btn primary" onClick={onClose}>Done</button>
      </>)}>
      {editing ? <AgeEdit c={c} done={() => setEditing(false)} /> : <AgeCard c={c} compact />}
    </Modal>
  );
}

const GROUP_NAMES: Record<string, string> = { Child: 'Kids', Ex: 'Exes', Enemy: 'Enemies', Connected: 'Connected', Spouse: 'Spouse', Engaged: 'Engaged' };
const groupName = (label: string, n: number) => (n > 1 ? GROUP_NAMES[label] ?? `${label}s` : label === 'Child' ? 'Kid' : label);

/** Relationships grouped by kind, people side by side: "Kids: Kamille, Blair, Bryson". */
function RelGroups({ c, phone, editing }: { c: Ctx; phone: boolean; editing: boolean }) {
  if (!c.myRels.length) {
    return <p className="muted" style={{ margin: phone ? '10px 0' : 0 }}>No one linked yet. Add family, partners, friends and the occasional secret.</p>;
  }
  const groups: { label: string; items: { rec: Rec; other: Rec; d: RelData }[] }[] = [];
  for (const { rec, d } of c.myRels) {
    const other = c.sims.find((s) => s.id === otherSide(d, c.rec.id))!;
    // Grouped by kind; a custom name ("Matched on Slide…") shows under the Sim's name instead.
    const label = relLabel({ ...d, labelA: '', labelB: '' }, c.rec.id);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push({ rec, other, d }); else groups.push({ label, items: [{ rec, other, d }] });
  }
  return (
    <dl className="cp-rl">
      {groups.map((g) => (
        <FragmentPair key={g.label} k={groupName(g.label, g.items.length)}>
          <div className="cp-ppl">
            {g.items.map(({ rec, other, d }) => {
              const o = simData(other);
              return (
                <span key={rec.id} className="cp-person">
                  <a href={savePath(c.saveId, `sims/${other.id}`)} title={fullName(o)}>
                    <SimAvatar sim={o} size={28} />
                    <span className="cp-pname">{g.items.length > 2 ? o.first || fullName(o) : fullName(o)}
                      {(() => { const own = relLabel(d, c.rec.id); return own !== label(g) ? <small>{own}</small> : null; })()}</span>
                    {o.deceased && <span className="muted small">†</span>}
                    {d.secret && <LockSimple size={13} weight="bold" className="muted" aria-label="Secret" />}
                  </a>
                  {editing && (
                    <button type="button" className="btn ghost icon sm" aria-label={`Edit relationship with ${fullName(o)}`} onClick={() => c.editRel(rec)}><PencilSimple size={15} /></button>
                  )}
                </span>
              );
            })}
          </div>
        </FragmentPair>
      ))}
    </dl>
  );
}
const label = (g: { label: string }) => g.label;
function FragmentPair({ k, children }: { k: string; children: ReactNode }) { return <><dt>{k}</dt><dd>{children}</dd></>; }

type AboutKey = 'gender' | 'pronouns' | 'orientation' | 'occult' | 'aspiration' | 'career' | 'traits';
const ABOUT_KEYS: Record<string, AboutKey> = { Gender: 'gender', Pronouns: 'pronouns', Orientation: 'orientation', Occult: 'occult', Aspiration: 'aspiration', Career: 'career', Traits: 'traits' };

/** About, where each row is its own button: tap it, pick, done. It saves by itself, with Undo. */
function AboutRows({ c, phone }: { c: Ctx; phone: boolean }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<{ k: AboutKey; el: HTMLElement | null } | null>(null);
  const rows = aboutRows(c).map((r) => (r.empty ? { ...r, v: EMPTY } : r));
  const empty = rows.filter((r) => r.empty).length;
  const shown = rows.filter((r) => all || !r.empty);
  const close = () => setOpen(null);
  return (
    <>
      <div className={`cp-about${phone ? ' phone' : ''}`}>
        {shown.map((r) => (
          <button key={r.k} type="button" className={`cp-arow${open?.k === ABOUT_KEYS[r.k] ? ' on' : ''}${r.k === 'Traits' ? ' wide' : ''}`}
            onClick={(e) => setOpen({ k: ABOUT_KEYS[r.k], el: e.currentTarget })} aria-label={`Change ${r.k.toLowerCase()}`}>
            <span className="k">{r.k}</span><span className="v">{r.k === 'Traits' && !r.empty ? c.sim.traits.map((t) => traitName(t, c.custom)).join(' · ') : r.v}</span>
          </button>
        ))}
      </div>
      {empty > 0 && (
        <button type="button" className="link-btn show-more" onClick={() => setAll((x) => !x)}>{all ? 'Show less' : `Show more (${empty} empty)`}</button>
      )}
      {open && <AboutPop c={c} k={open.k} anchor={open.el} phone={phone} onClose={close} />}
    </>
  );
}

const ABOUT_TITLES: Record<AboutKey, string> = { gender: 'Gender', pronouns: 'Pronouns', orientation: 'Orientation', occult: 'Occult', aspiration: 'Aspiration', career: 'Career', traits: 'Traits' };

function AboutPop({ c, k, anchor, phone, onClose }: { c: Ctx; k: AboutKey; anchor: HTMLElement | null; phone: boolean; onClose(): void }) {
  const custom = useCustomTraits();
  const title = ABOUT_TITLES[k];
  const save = (patch: Partial<SimData>, close = true) => {
    const before = Object.fromEntries(Object.keys(patch).map((key) => [key, c.sim[key as keyof SimData]])) as Partial<SimData>;
    c.update(patch);
    toast(`${title} saved`, { label: 'Undo', run: () => c.update(before) });
    if (close) onClose();
  };
  const text = (list: string[], key: 'pronouns' | 'orientation') => (
    <ChoiceList search={false} none="--" value={c.sim[key] || null}
      options={(c.sim[key] && !list.includes(c.sim[key]) ? [c.sim[key], ...list] : list).map((o) => ({ id: o, label: o }))}
      onPick={(v) => save({ [key]: v ?? '' } as Partial<SimData>)}
      onAdd={(t) => t} addLabel={(t) => `Use “${t}”`} />
  );
  let body: ReactNode = null;
  if (k === 'gender') {
    body = (
      <ChoiceList search={false} none="--" value={c.sim.gender}
        options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]} onPick={(v) => save({ gender: (v as Gender | null) ?? null })} />
    );
  } else if (k === 'pronouns') body = text(PRONOUNS, 'pronouns');
  else if (k === 'orientation') body = text(ORIENTATIONS, 'orientation');
  else if (k === 'occult') {
    body = <ChoiceList none="Human" value={c.sim.occult} options={occultOptions(c.info, c.sim.occult)} onPick={(v) => save({ occult: v })} search={occultOptions(c.info, c.sim.occult).length > 8} />;
  } else if (k === 'aspiration') {
    const opts = aspirationOptions(c.info, c.sim.aspiration);
    const typed = c.sim.aspiration?.startsWith(ASPIRATION_TEXT) ? [{ id: c.sim.aspiration, label: c.sim.aspiration.slice(ASPIRATION_TEXT.length) }] : [];
    body = <ChoiceList none="--" value={c.sim.aspiration} options={[...typed, ...opts]} onPick={(v) => save({ aspiration: v })}
      onAdd={(t) => `${ASPIRATION_TEXT}${t}`} />;
  } else if (k === 'career') {
    body = <CareerField c={c} onSave={(career) => save({ career })} />;
  } else if (k === 'traits') {
    body = (
      <div style={{ minWidth: 0 }}>
        <Picker multiple options={traitOptions(c.info, custom.list, c.sim.traits)} value={c.sim.traits} onChange={(traits) => save({ traits }, false)}
          placeholder="Add a trait" onAdd={(label) => custom.add(label)} />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button type="button" className="btn sm primary" onClick={onClose}>Done</button></div>
      </div>
    );
  }
  return <RowPop anchor={anchor} title={title} phone={phone} onClose={onClose} width={k === 'traits' ? 380 : 320}>{body}</RowPop>;
}

function CareerField({ c, onSave }: { c: Ctx; onSave(v: string): void }) {
  const [v, setV] = useState(c.sim.career);
  const id = useId();
  const done = () => { if (v.trim() !== c.sim.career) onSave(v.trim()); else onSave(c.sim.career); };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <label htmlFor={id} className="muted small">Career and level, like “Doctor · Level 4”</label>
      <TextInput id={id} value={v} onChange={(e) => setV(e.target.value)} maxLength={60} placeholder="--" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } }} />
      <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn sm primary" onClick={done}>Save</button></div>
    </div>
  );
}

/** Likes, dislikes, turn ons and turn offs, as plain lines with an icon each. Shown once a Sim has any. */
function LikesBody({ c, phone }: { c: Ctx; phone: boolean }) {
  const d = c.rec.data as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
  const lines = [
    { k: 'Likes', icon: <ThumbsUp size={20} weight="duotone" color="var(--success, #2e8b57)" />, v: arr('likes') },
    { k: 'Dislikes', icon: <ThumbsDown size={20} weight="duotone" />, v: arr('dislikes') },
    { k: 'Turn ons', icon: <Fire size={20} weight="duotone" color="#d6492e" />, v: arr('turnOns') },
    { k: 'Turn offs', icon: <HeartBreak size={20} weight="duotone" />, v: arr('turnOffs') },
  ];
  if (!lines.some((l) => l.v.length)) return null;
  return <LikesLines lines={lines} max={phone ? 5 : 8} />;
}
function LikesLines({ lines, max }: { lines: { k: string; icon: ReactNode; v: string[] }[]; max: number }) {
  const [all, setAll] = useState<Record<string, boolean>>({});
  return (
    <div className="cp-likes">
      {lines.map((l) => (
        <div key={l.k} className="cp-lk" aria-label={l.k}>
          <span className="ic" title={l.k}>{l.icon}</span>
          <span>{l.v.length === 0 ? EMPTY : (all[l.k] || l.v.length <= max) ? l.v.join(' · ') : <>{l.v.slice(0, max).join(' · ')} <button type="button" className="link-btn" onClick={() => setAll((x) => ({ ...x, [l.k]: true }))}>+{l.v.length - max} more</button></>}</span>
        </div>
      ))}
    </div>
  );
}
const hasLikes = (c: Ctx) => ['likes', 'dislikes', 'turnOns', 'turnOffs'].some((k) => Array.isArray((c.rec.data as Record<string, unknown>)[k]) && ((c.rec.data as Record<string, unknown>)[k] as unknown[]).length > 0);

/** The household as a row of faces. */
function HouseholdFaces({ c }: { c: Ctx }) {
  const mates = c.sims.filter((r) => simData(r).householdId === c.sim.householdId && !simData(r).deceased);
  return (
    <div className="cp-faces">
      {mates.map((r) => {
        const o = simData(r);
        return (
          <a key={r.id} href={savePath(c.saveId, `sims/${r.id}`)} className={r.id === c.rec.id ? 'me' : ''} aria-current={r.id === c.rec.id ? 'page' : undefined}>
            <SimAvatar sim={o} size={40} /><span>{o.first || fullName(o)}</span>
          </a>
        );
      })}
    </div>
  );
}

/** Photos and life stage photos in one card. */
function PhotosAndYears({ c, phone }: { c: Ctx; phone: boolean }) {
  return (
    <SimPhotos save={c.save} simId={c.rec.id} phone={phone}
      extra={(
        <div className="cp-years">
          <div className="small bold muted">Through the years</div>
          <ThroughTheYears c={c} phone={phone} />
        </div>
      )} />
  );
}

/** Under the big phone photo: the age bar and birthday (the name is already on the photo). */
function CompactLine({ c }: { c: Ctx }) {
  const [ageOpen, setAgeOpen] = useState(false);
  const al = ageLine(c);
  const bday = !c.sim.deceased && c.age.kind === 'age' && c.age.age.stage !== 'elder' ? formatDate(dateOf(c.age.age.birthdayDay!, c.info.cal), 'short') : null;
  const age = ageFact(c);
  if (!al && !bday && !age) return null;
  return (
    <div className="cp-under">
      <div className="cp-line">
        <button type="button" className="cp-it cp-age" onClick={() => setAgeOpen(true)}><b>{c.sim.deceased ? 'Deceased' : c.stage ? stageName(c.stage) : 'Age not set'}</b>{age ? <> · {age}</> : null}</button>
        {bday && <span className="cp-it"><CalendarBlank size={16} aria-hidden="true" />{bday}</span>}
      </div>
      {al && <button type="button" className="cp-agebar" onClick={() => setAgeOpen(true)}><span className="bar"><i style={{ width: `${Math.max(3, al.pct)}%` }} /></span>{al.next}</button>}
      {ageOpen && <AgeDialog c={c} onClose={() => setAgeOpen(false)} />}
    </div>
  );
}
