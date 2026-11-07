import { CaretRight, HouseSimple, MapPin, User, UsersThree } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { DayButtons } from '../components/DayMove';
import { PhotoBox } from '../components/photo';
import { PhoneTop } from '../components/Shell';
import { clubData } from '../lib/clubs';
import { householdData } from '../lib/households';
import { lotData } from '../lib/lots';
import { recentOf, type Recent } from '../lib/recent';
import { go, savePath } from '../lib/router';
import { saveData, todayOf } from '../lib/saves';
import { fullName, NO_HOUSEHOLD, simData } from '../lib/sims';
import { useRecords } from '../lib/sync/react';
import type { Rec, SaveRow } from '../lib/sync/types';
import { plural } from '../lib/text';
import { formatDate } from '../lib/time';
import { useIsPhone } from '../lib/useIsPhone';
import { ComingUp } from './calendar/shared';
import { presetHhFilter } from './households/HouseholdsList';
import { presetSimsFilter } from './sims/SimsList';
import { SimAvatar, useHouseholds } from './sims/shared';
import { PlayingNow } from './rotation/Rotation';

/** The save's home page: today's date and moving it, what needs sorting, what's coming up, and where you were. */
export function TodayPage({ save }: { save: SaveRow }) {
  const phone = useIsPhone();
  const d = saveData(save);
  const t = todayOf(d);
  const sims = useRecords('sim');
  const living = sims.filter((r) => !simData(r).deceased);

  const head = !phone && d.cover ? (
    <div className="stack" style={{ gap: 12 }}>
      <PhotoBox photo={d.cover} aspect={4} className="home-cover" alt="">
        <div className="home-cover-text"><h1>{d.name}</h1><div>{d.trackDate ? `${formatDate(t, 'weekday')} · Year ${t.year}` : ''}</div></div>
      </PhotoBox>
      {d.trackDate && <DayButtons save={save} />}
    </div>
  ) : (
    <div className={`today-head${phone ? ' phone' : ''}`}>
      <div style={{ minWidth: 0 }}>
        {!phone && <div className="muted small">{d.name}</div>}
        <h1>{d.trackDate ? formatDate(t, 'weekday') : d.name}</h1>
        {d.trackDate && <div className="muted">Year {t.year}</div>}
      </div>
      {d.trackDate && <DayButtons save={save} phone={phone} />}
    </div>
  );
  const coming = <ComingUp save={save} simIds={living.map((r) => r.id)} seeAll="calendar" showFaces />;
  const sort = <ToSort save={save} sims={living} />;
  const recent = <JumpBackIn save={save} />;
  const playing = <PlayingNow save={save} where="today" />;

  if (phone) {
    return (
      <div className="m-stack today">
        <PhoneTop save={save} />
        {head}
        {playing}
        {sort}
        {coming}
        {recent}
      </div>
    );
  }
  return (
    <div className="page stack today" style={{ gap: 20 }}>
      {head}
      <div className="today-cols">
        <div className="stack" style={{ gap: 16 }}>{playing}{sort}{recent}</div>
        <div className="stack" style={{ gap: 16 }}>{coming}</div>
      </div>
    </div>
  );
}

function TodayCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card today-card"><div className="card-head"><h2>{title}</h2></div>{children}</section>;
}

function Row({ icon, title, sub, onClick, href }: { icon: ReactNode; title: ReactNode; sub?: string; onClick?(): void; href?: string }) {
  const inner = <>{icon}<span className="grow"><span className="t">{title}</span>{sub && <span className="s">{sub}</span>}</span><CaretRight size={16} weight="bold" className="chev" aria-hidden="true" /></>;
  return href ? <a className="today-row" href={href}>{inner}</a> : <button type="button" className="today-row" onClick={onClick}>{inner}</button>;
}

function ToSort({ save, sims }: { save: SaveRow; sims: Rec[] }) {
  const households = useRecords('household');
  const noHh = sims.filter((r) => !simData(r).householdId).length;
  const noHome = households.filter((r) => !householdData(r).home).length;
  if (!noHh && !noHome) return null;
  return (
    <TodayCard title="To sort">
      {noHh > 0 && (
        <Row icon={<span className="obj sims"><User size={16} weight="duotone" /></span>}
          title={<><b>{plural(noHh, 'Sim')}</b> with no household</>} sub="Tap to see them in the Sims list"
          onClick={() => { presetSimsFilter(save.id, { households: [NO_HOUSEHOLD] }); go(savePath(save.id, 'sims')); }} />
      )}
      {noHome > 0 && (
        <Row icon={<span className="obj households"><HouseSimple size={16} weight="duotone" /></span>}
          title={<><b>{plural(noHome, 'household')}</b> with no home</>} sub="Pick their homes"
          onClick={() => { presetHhFilter(save.id, { homes: ['none'] }); go(savePath(save.id, 'households')); }} />
      )}
    </TodayCard>
  );
}

function JumpBackIn({ save }: { save: SaveRow }) {
  const sims = useRecords('sim');
  const lots = useRecords('lot');
  const clubs = useRecords('club');
  const hh = useHouseholds();
  const rows = recentOf(save.id).map((r) => describe(r, save, { sims, lots, clubs, hh })).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 4);
  if (!rows.length) return null;
  return <TodayCard title="Jump back in">{rows.map((r) => <Row key={r.href} {...r} />)}</TodayCard>;
}

function describe(r: Recent, save: SaveRow, c: { sims: Rec[]; lots: Rec[]; clubs: Rec[]; hh: ReturnType<typeof useHouseholds> }) {
  if (r.kind === 'sim') {
    const rec = c.sims.find((x) => x.id === r.id);
    if (!rec) return null;
    const s = simData(rec);
    return { href: savePath(save.id, `sims/${r.id}`), title: fullName(s), sub: 'Sim', icon: <SimAvatar sim={s} size={32} /> };
  }
  if (r.kind === 'household') {
    const rec = c.hh.byId.get(r.id);
    if (!rec) return null;
    const n = c.sims.filter((x) => simData(x).householdId === r.id && !simData(x).deceased).length;
    return { href: savePath(save.id, `households/${r.id}`), title: c.hh.nameOf(r.id), sub: plural(n, 'Sim'), icon: <span className="obj households"><HouseSimple size={16} weight="duotone" /></span> };
  }
  if (r.kind === 'lot') {
    const rec = c.lots.find((x) => x.id === r.id);
    if (!rec) return null;
    return { href: savePath(save.id, `worlds/lot/${r.id}`), title: lotData(rec).name || 'Unnamed lot', sub: 'Lot', icon: <span className="obj worlds"><MapPin size={16} weight="duotone" /></span> };
  }
  const rec = c.clubs.find((x) => x.id === r.id);
  if (!rec) return null;
  return { href: savePath(save.id, `clubs/${r.id}`), title: clubData(rec).name || 'Unnamed club', sub: 'Club', icon: <span className="obj clubs"><UsersThree size={16} weight="duotone" /></span> };
}
