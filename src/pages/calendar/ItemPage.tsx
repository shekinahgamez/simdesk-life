import { ItemPhotos } from '../photos/PhotosPage';
import { useState } from 'react';
import { MapPin, PencilSimple } from '@phosphor-icons/react';
import { BackLink } from '../../components/Shell';
import { ThemedBanner } from '../../components/Banner';
import { itemsBetween, nextHolidayDay } from '../../lib/calendar';
import { lotTypeName } from '../../lib/lots';
import { savePath } from '../../lib/router';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { dateOf, formatDate, SEASONS, weekday } from '../../lib/time';
import { daysWord } from '../../lib/sims';
import { plural } from '../../lib/text';
import { SimAvatar } from '../sims/shared';
import { useLotsCtx } from '../worlds/shared';
import { EventForm, HolidayForm, VacationForm } from './CalendarPage';
import { KIND_LABEL, spanText, useCalCtx, useTraditionName, whenText } from './shared';

export type ItemKind = 'event' | 'holiday' | 'vacation' | 'birthday';
export const isItemKind = (s: string | undefined): s is ItemKind => s === 'event' || s === 'holiday' || s === 'vacation' || s === 'birthday';

/** One event, holiday, vacation or birthday: a themed header, who's in it, notes, and an Edit button. A birthday's id is the Sim's, and `when` is the day. */
export function ItemPage({ save, kind, id, when: whenDay }: { save: SaveRow; kind: ItemKind; id: string; when?: string }) {
  const ctx = useCalCtx(save);
  const lots = useLotsCtx(save);
  const phone = useIsPhone();
  const trad = useTraditionName();
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const { info } = ctx;
  const back = savePath(save.id, 'calendar');
  const ev = kind === 'event' ? ctx.state.events.find((e) => e.id === id)?.data : undefined;
  const hol = kind === 'holiday' ? ctx.state.holidays.find((h) => h.id === id)?.data : undefined;
  const vac = kind === 'vacation' ? ctx.state.vacations.find((v) => v.id === id)?.data : undefined;
  const bsim = kind === 'birthday' ? ctx.simById.get(id) : undefined;
  // a birthday is on its Sim's next age-up (or the day in the link)
  const bday = kind === 'birthday' && bsim
    ? (Number.isFinite(+(whenDay ?? '')) && whenDay ? +whenDay : info.track ? itemsBetween(ctx.state, info.today, info.today + 500).find((i) => i.kind === 'birthday' && i.id === id)?.day ?? null : null)
    : null;
  const data = ev ?? hol ?? vac;
  if (kind === 'birthday' ? !bsim : !data) return <div className="page"><p>That {KIND_LABEL[kind].toLowerCase()} isn’t here anymore.</p><a className="btn" href={back}>Back to the calendar</a></div>;

  // the day this page is about: an event or vacation's own day, a holiday's next one
  const day = ev ? ev.day : vac ? vac.from : hol ? nextHolidayDay(hol, info.today, info.cal) : bday ?? info.today;
  const end = vac ? vac.to : day;
  const date = dateOf(day, info.cal);
  const when = whenText(ctx, { kind, day, end });
  const seasonLink = savePath(save.id, `calendar/${date.year}/${date.season}`);
  const getaway = vac?.kind === 'getaway';
  const label = getaway ? 'Getaway' : KIND_LABEL[kind];
  const sub = kind === 'holiday'
    ? [`Holiday · ${SEASONS[hol!.season]} ${Math.min(hol!.day, info.cal.seasonLength)}, every year`, info.track ? `next one ${daysWord(day - info.today)}` : ''].filter(Boolean).join(' · ')
    : kind === 'vacation'
      ? [label, spanText(ctx, vac!.from, vac!.to), plural(vac!.to - vac!.from + 1, 'day'), vac!.world ? lots.worldName(vac!.world) : ''].filter(Boolean).join(' · ')
      : kind === 'birthday'
        ? bday === null ? 'Birthday' : ['Birthday', `${weekday(date)}, ${formatDate(date, 'short')} · Year ${date.year}`, when].filter(Boolean).join(' · ')
        : ['Event', `${weekday(date)}, ${formatDate(date, 'short')} · Year ${date.year}`, when].filter(Boolean).join(' · ');
  const title = kind === 'birthday' ? `${ctx.firstOf(id)}’s birthday` : data!.name || label;
  const notes = data?.notes.trim() ?? '';
  const art = kind === 'holiday' ? hol!.banner : kind === 'event' ? ev!.banner : kind === 'vacation' ? vac!.banner : 'birthday';

  const person = (simId: string) => {
    const sim = ctx.simById.get(simId);
    return (
      <a key={simId} className="cal-person" href={savePath(save.id, `sims/${simId}`)}>
        {sim ? <SimAvatar sim={sim} size={40} /> : <span className="sim-avatar initials" style={{ width: 40, height: 40 }}>?</span>}
        <span className="grow"><b>{ctx.nameOf(simId)}</b>{ctx.hhOf(simId) && <span className="s">{ctx.hhOf(simId)}</span>}</span>
      </a>
    );
  };
  const goingIds = ev ? ev.going.filter((g) => g !== ev.host) : [];
  const stayRow = vac?.stay ? lots.rows.find((r) => r.id === vac.stay) : undefined;
  const cards = (
    <>
      {kind === 'birthday' && (
        <section className="card">
          <div className="cal-h">Whose birthday</div>
          {person(id)}
        </section>
      )}
      {ev && (
        <section className="card">
          {ev.host && <><div className="cal-h">Hosted by</div>{person(ev.host)}</>}
          <div className="cal-h" style={{ marginTop: ev.host ? 12 : 0 }}>Going{goingIds.length ? ` · ${goingIds.length}` : ''}</div>
          {goingIds.length ? goingIds.map(person) : <p className="muted small" style={{ margin: 0 }}>No one yet. Edit to add guests.</p>}
        </section>
      )}
      {vac && (
        <section className="card">
          <div className="cal-h">Who’s going{vac.going.length ? ` · ${vac.going.length}` : ''}</div>
          {vac.going.length ? vac.going.map(person) : <p className="muted small" style={{ margin: 0 }}>No one yet. Edit to add Sims.</p>}
        </section>
      )}
      {vac && stayRow && (
        <section className="card">
          <div className="cal-h">{getaway ? 'Hosted at' : 'Staying at'}</div>
          <a className="cal-person" href={savePath(save.id, `worlds/lot/${stayRow.id}`)}>
            <span className="cal-tile k-vacation"><MapPin size={18} weight="fill" className="kind-ic" /></span>
            <span className="grow"><b>{stayRow.lot.name}</b><span className="s">{[lotTypeName(stayRow.lot.type), stayRow.spot ? lots.worldName(stayRow.world) : ''].filter(Boolean).join(' · ')}</span></span>
          </a>
        </section>
      )}
      {hol && (
        <section className="card">
          <div className="cal-h">Traditions</div>
          {hol.traditions.length ? <div className="row" style={{ gap: 8 }}>{hol.traditions.map((t) => <span key={t} className="chip">{trad(t)}</span>)}</div>
            : <p className="muted small" style={{ margin: 0 }}>None yet. Edit to add some.</p>}
        </section>
      )}
      <ItemPhotos save={save} item={{ kind, id }} gameDay={info.track ? (ev ? ev.day : vac ? vac.from : kind === 'birthday' ? bday : info.today) : null} />
      {kind !== 'birthday' && (
        <section className="card">
          <div className="cal-h">Notes</div>
          {notes ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{notes}</p> : <p className="muted small" style={{ margin: 0 }}>Nothing yet.</p>}
        </section>
      )}
    </>
  );
  const dialogs = (
    <>
      {editing && (
        kind === 'event' ? <EventForm ctx={ctx} id={id} day={day} onClose={() => setEditing(false)} />
          : kind === 'holiday' ? <HolidayForm ctx={ctx} id={id} day={day} onClose={() => setEditing(false)} />
            : kind === 'vacation' ? <VacationForm save={save} ctx={ctx} id={id} day={day} onClose={() => setEditing(false)} /> : null
      )}
      {planning && <EventForm ctx={ctx} id={null} day={day} onClose={() => setPlanning(false)} />}
    </>
  );
  const viewSim = <a className="btn fog" href={savePath(save.id, `sims/${id}`)}>View Sim</a>;
  const hero = (
    <ThemedBanner art={art} className={phone ? 'sm' : ''}>
      <div className="grow"><h1>{title}</h1><div className="s">{sub}</div></div>
      {!phone && kind !== 'birthday' && <button type="button" className="btn fog" onClick={() => setEditing(true)}><PencilSimple size={16} /> Edit</button>}
      {!phone && kind === 'birthday' && viewSim}
    </ThemedBanner>
  );
  const phoneBtns = kind === 'birthday'
    ? <div className="row"><button type="button" className="btn sm ghost" style={{ color: 'var(--accent)' }} onClick={() => setPlanning(true)}>Plan an event</button><a className="btn sm primary" href={savePath(save.id, `sims/${id}`)}>View Sim</a></div>
    : <div className="row"><button type="button" className="btn sm" onClick={() => setEditing(true)}><PencilSimple size={14} /> Edit</button></div>;

  if (phone) {
    return (
      <div className="m-stack">
        <BackLink href={back} label="Calendar" />
        {hero}
        {phoneBtns}
        {cards}
        {dialogs}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 16 }}>
      <div className="crumbs"><a href={back}>Calendar</a> / <a href={seasonLink}>{SEASONS[date.season]}</a> / {title}</div>
      {hero}
      {kind === 'birthday' && <div className="row"><button type="button" className="btn primary" onClick={() => setPlanning(true)}>Plan an event</button></div>}
      <div className="cal-item-grid">{cards}</div>
      {dialogs}
    </div>
  );
}
