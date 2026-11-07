import { useCallback, useState } from 'react';
import { CaretLeft, CaretRight, Plus, Trash, X } from '@phosphor-icons/react';
import { SeasonBanner } from '../../components/SeasonArt';
import { BannerPicker } from '../../components/Banner';
import { DEFAULT_EVENT_BANNER, DEFAULT_HOLIDAY_BANNER, DEFAULT_TRIP_BANNER, EVENT_BANNERS, HOLIDAY_BANNERS, TRIP_BANNERS } from '../../components/bannerIds';
import { bannerForName } from '../../lib/bannerNames';
import { DateField, RangeField } from '../../components/SeasonPicker';
import { Confirm, Field, Modal, Picker, Seg, Sheet, TextInput, toast } from '../../components/ui';
import { holidayData, eventData, vacationData, itemsBetween, nextSeason, seasonRange, type CalItem, type Kind, type TripKind } from '../../lib/calendar';
import { APARTMENT, isHotelType, VACATION_RENTAL } from '../../lib/lots';
import { householdData } from '../../lib/households';
import { householdLabel } from '../../lib/sims';
import { go, savePath } from '../../lib/router';
import { useStore, useRecords } from '../../lib/sync/react';
import { useIsPhone } from '../../lib/useIsPhone';
import type { SaveRow } from '../../lib/sync/types';
import { dateOf, dayOf, SEASONS, WEEKDAYS, weekday, type Season } from '../../lib/time';
import { daysWord } from '../../lib/sims';
import { BY_ID } from '../../data/game';
import { useLotsCtx, type LotsCtx } from '../worlds/shared';
import { itemTitle, KIND_LABEL, KindIcon, spanText, TRADITION_PREFIX, useCalCtx, useCustomTraditions, type CalCtx } from './shared';
import { ItemPopover } from './ItemPopover';

type Form = { kind: 'holiday' | 'event' | 'vacation'; id: string | null; day: number };

/** Calendar: one season at a time. A grid on desktop, a list by day on phones. */
export function CalendarPage({ save, rest }: { save: SaveRow; rest: string[] }) {
  const ctx = useCalCtx(save);
  const lots = useLotsCtx(save);
  const phone = useIsPhone();
  const hhRecs = useRecords('household');
  const { info } = ctx;
  const todayDate = dateOf(info.today, info.cal);
  // calendar/<year>/<season>, calendar/sim/<id>, calendar/household/<id>
  const filterKind = rest[0] === 'sim' || rest[0] === 'household' ? rest[0] : null;
  const filterId = filterKind ? rest[1] : null;
  const view = !filterKind && rest.length >= 2 && Number.isFinite(+rest[0]) ? { year: +rest[0], season: (Math.min(3, Math.max(0, +rest[1])) as Season) } : null;
  const [own, setOwn] = useState<{ year: number; season: Season } | null>(null);
  const shown = view ?? own ?? { year: todayDate.year, season: todayDate.season };
  const [adding, setAdding] = useState<number | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [pop, setPop] = useState<{ item: CalItem; rect: DOMRect } | null>(null);
  const closePop = useCallback(() => setPop(null), []);

  const filterSims = filterKind === 'sim' && filterId ? [filterId]
    : filterKind === 'household' && filterId ? ctx.sims.filter((s) => s.sim.householdId === filterId).map((s) => s.id) : null;
  const filterName = filterKind === 'sim' && filterId ? ctx.nameOf(filterId)
    : filterKind === 'household' && filterId ? householdLabel(householdData(hhRecs.find((r) => r.id === filterId)).name) : '';
  const [start, end] = seasonRange(shown.year, shown.season, info.cal);
  const all = itemsBetween(ctx.state, start, end);
  const items = filterSims ? all.filter((i) => i.kind !== 'holiday' && i.sims.some((x) => filterSims.includes(x))) : all;
  const step = (d: 1 | -1) => {
    const n = nextSeason(shown.year, shown.season, d);
    if (filterKind) setOwn(n); else go(savePath(save.id, `calendar/${n.year}/${n.season}`), { replace: true });
  };
  const toToday = () => { if (filterKind) setOwn(null); else go(savePath(save.id, 'calendar'), { replace: true }); };
  const isToday = (day: number) => info.track && day === info.today;
  /** Phones go straight to the item's page (a Sim's profile for a birthday); desktop opens the little card. */
  const open = (i: CalItem, e?: { currentTarget: Element }) => {
    if (phone || !e) go(savePath(save.id, i.kind === 'birthday' ? `calendar/birthday/${i.id}/${i.day}` : `calendar/${i.kind}/${i.id}`));
    else setPop({ item: i, rect: e.currentTarget.getBoundingClientRect() });
  };
  const addDay = info.track && info.today >= start && info.today <= end ? info.today : start;

  const prev = nextSeason(shown.year, shown.season, -1);
  const next = nextSeason(shown.year, shown.season, 1);
  const away = info.track && (shown.year !== todayDate.year || shown.season !== todayDate.season);
  const nav = (
    <div className="cal-nav">
      {phone
        ? <button type="button" className="btn icon fog" aria-label={`Back to ${SEASONS[prev.season]}`} onClick={() => step(-1)}><CaretLeft size={18} weight="bold" /></button>
        : <button type="button" className="btn fog" onClick={() => step(-1)}><CaretLeft size={16} weight="bold" /> {SEASONS[prev.season]}</button>}
      {phone
        ? <button type="button" className="btn icon fog" aria-label={`On to ${SEASONS[next.season]}`} onClick={() => step(1)}><CaretRight size={18} weight="bold" /></button>
        : <button type="button" className="btn fog" onClick={() => step(1)}>{SEASONS[next.season]} <CaretRight size={16} weight="bold" /></button>}
    </div>
  );
  const backChip = away && (
    <div className="row"><button type="button" className="cal-back" onClick={toToday}>Back to {SEASONS[todayDate.season]} · Year {todayDate.year}</button></div>
  );
  const banner = (
    <SeasonBanner season={shown.season} className={phone ? 'sm' : ''}>
      <div><h2>{SEASONS[shown.season]}</h2><div className="s">Year {shown.year}{phone && info.track && todayDate.year === shown.year && todayDate.season === shown.season ? ` · Day ${todayDate.day}` : ` · ${info.cal.seasonLength} days`}</div></div>
      {nav}
    </SeasonBanner>
  );
  const filterTag = filterKind && (
    <div className="row" style={{ gap: 6 }}>
      <span className="ftag">Only {filterName}<button type="button" aria-label="Show everything" onClick={() => go(savePath(save.id, 'calendar'))}><X size={11} weight="bold" /></button></span>
    </div>
  );
  const dialogs = (
    <>
      {adding !== null && <AddMenu phone={phone} day={adding} ctx={ctx} onClose={() => setAdding(null)} onPick={(kind) => { setForm({ kind, id: null, day: adding }); setAdding(null); }} />}
      {pop && !phone && <ItemPopover save={save} ctx={ctx} lots={lots} item={pop.item} rect={pop.rect} onClose={closePop}
        onEdit={() => { if (pop.item.kind !== 'birthday') setForm({ kind: pop.item.kind, id: pop.item.id, day: pop.item.day }); }}
        onPlan={() => setForm({ kind: 'event', id: null, day: pop.item.day })} />}
      {form?.kind === 'holiday' && <HolidayForm ctx={ctx} id={form.id} day={form.day} onClose={() => setForm(null)} />}
      {form?.kind === 'event' && <EventForm ctx={ctx} id={form.id} day={form.day} onClose={() => setForm(null)} />}
      {form?.kind === 'vacation' && <VacationForm save={save} ctx={ctx} id={form.id} day={form.day} onClose={() => setForm(null)} />}
    </>
  );

  if (phone) {
    const fromDay = info.track && info.today >= start && info.today <= end ? info.today : start;
    const days: number[] = [];
    for (let d = fromDay; d <= end; d++) if (isToday(d) || items.some((i) => i.day <= d && i.end >= d && (i.kind !== 'vacation' || i.day === d || d === fromDay))) days.push(d);
    return (
      <div className="m-stack">
        <h1 className="m-h1" style={{ paddingTop: 6 }}>Calendar</h1>
        {banner}
        {backChip}
        {filterTag}
        {days.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing this season.</p>}
        {days.map((d) => {
          const date = dateOf(d, info.cal);
          const here = items.filter((i) => i.day <= d && i.end >= d && (i.kind !== 'vacation' || i.day === d || d === fromDay));
          const head = [isToday(d) ? 'Today' : weekday(date).slice(0, 3), `${SEASONS[date.season]} ${date.day}`, info.track && d > info.today ? daysWord(d - info.today) : ''].filter(Boolean).join(' · ');
          return (
            <div key={d} className="stack" style={{ gap: 6 }}>
              <div className="m-label">{head}</div>
              <div className="m-group">
                {here.length === 0 ? <div className="m-row"><span className="s">Nothing today</span></div> : here.map((i) => (
                  <button key={i.key} type="button" className={`m-row cal-mrow k-${i.kind}`} onClick={() => open(i)}>
                    <span className="cal-tile"><KindIcon kind={i.kind} size={18} /></span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="t" style={{ display: 'block' }}>{itemTitle(ctx, i)}</span>
                      <span className="s" style={{ display: 'block' }}>{subLine(ctx, i)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button type="button" className="m-fab" aria-label="Add to the calendar" onClick={() => setAdding(addDay)}><Plus size={26} weight="bold" /></button>
        {dialogs}
      </div>
    );
  }

  const cells: number[] = [];
  for (let d = start; d <= end; d++) cells.push(d);
  const vacs = items.filter((i) => i.kind === 'vacation');
  return (
    <div className="page stack" style={{ gap: 16 }}>
      <div className="page-head">
        <h1>Calendar</h1>
        <button type="button" className="btn primary" onClick={() => setAdding(addDay)}><Plus size={18} weight="bold" /> Add</button>
      </div>
      {banner}
      {backChip}
      {filterTag}
      <div className="cal-legend">
        {(['holiday', 'event', 'birthday', 'vacation'] as Kind[]).filter((k) => !(filterKind && k === 'holiday')).map((k) => <span key={k} className={`k-${k}`}><KindIcon kind={k} />{KIND_LABEL[k]}s</span>)}
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w.slice(0, 3)}</div>)}
        {cells.map((d, idx) => {
          const date = dateOf(d, info.cal);
          const here = items.filter((i) => i.kind !== 'vacation' && i.day === d);
          const weekStart = start + Math.floor(idx / 7) * 7;
          const weekEnd = weekStart + 6;
          return (
            <div key={d} className={`cal-day ${isToday(d) ? 'today' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setAdding(d); }}>
              <button type="button" className="cal-n" aria-label={`Add on ${SEASONS[date.season]} ${date.day}`} onClick={() => setAdding(d)}><b>{date.day}</b></button>
              {vacs.filter((v) => v.day <= weekEnd && v.end >= weekStart).map((v) => {
                if (v.day > d || v.end < d) return <span key={v.key} className="cal-it ghost" aria-hidden="true" />;
                const first = v.day === d || idx % 7 === 0 || d === start;
                const cls = `${v.day === d ? 'st' : ''} ${v.end === d ? 'en' : ''}`;
                return <button key={v.key} type="button" className={`cal-it bar k-vacation ${cls}`} onClick={(e) => open(v, e)} title={v.name}>{first ? <><KindIcon kind="vacation" />{v.name}</> : ' '}</button>;
              })}
              {here.map((i) => <button key={i.key} type="button" className={`cal-it k-${i.kind}`} onClick={(e) => open(i, e)}><KindIcon kind={i.kind} />{itemTitle(ctx, i)}</button>)}
            </div>
          );
        })}
      </div>
      {dialogs}
    </div>
  );
}

function subLine(ctx: CalCtx, i: CalItem) {
  if (i.kind === 'holiday') return 'Holiday';
  if (i.kind === 'birthday') return 'Birthday';
  if (i.kind === 'vacation') return `${i.getaway ? 'Getaway' : 'Vacation'} · ${spanText(ctx, i.day, i.end)}${i.sims.length ? ` · ${i.sims.length} ${i.sims.length === 1 ? 'Sim' : 'Sims'}` : ''}`;
  const going = i.sims.filter((x) => x !== i.host).length;
  return [i.host ? `Hosted by ${ctx.firstOf(i.host)}` : 'Event', going ? `${going} going` : ''].filter(Boolean).join(' · ');
}

// ---------- adding ----------
function AddMenu({ phone, day, ctx, onClose, onPick }: { phone: boolean; day: number; ctx: CalCtx; onClose(): void; onPick(k: 'holiday' | 'event' | 'vacation'): void }) {
  const d = dateOf(day, ctx.info.cal);
  const opts = (
    <div className="cal-add">
      {(['holiday', 'event', 'vacation'] as const).map((k) => (
        <button key={k} type="button" className={`cal-add-opt k-${k}`} onClick={() => onPick(k)}><span className="cal-tile"><KindIcon kind={k} size={18} /></span>{KIND_LABEL[k]}</button>
      ))}
    </div>
  );
  if (phone) return <Sheet title="Add to the calendar" onClose={onClose}>{opts}</Sheet>;
  return <Modal title={`Add on ${SEASONS[d.season]} ${d.day}`} onClose={onClose} autoFocus={false} className="cal-add-modal">{opts}</Modal>;
}

const toDate = (ctx: CalCtx, day: number) => dateOf(day, ctx.info.cal);
const todayOf = (ctx: CalCtx) => (ctx.info.track ? dateOf(ctx.info.today, ctx.info.cal) : null);

function useSimOptions(ctx: CalCtx) {
  return ctx.sims.filter((s) => !s.sim.deceased).map((s) => ({ id: s.id, label: ctx.nameOf(s.id) })).sort((a, b) => a.label.localeCompare(b.label));
}

function FormShell({ title, isNew, dirty, onClose, onSave, onDelete, saveLabel, children }: {
  title: string; isNew: boolean; dirty: boolean; onClose(): void; onSave(): void; onDelete(): void; saveLabel: string; children: React.ReactNode;
}) {
  const [del, setDel] = useState(false);
  return (
    <Modal title={title} onClose={onClose} dirty={dirty} className="pinned"
      footer={(close) => <>{!isNew && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => setDel(true)}><Trash size={16} weight="duotone" /> Delete</button>}<button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={onSave}>{saveLabel}</button></>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); onSave(); }}>{children}</form>
      {del && <Confirm title="Delete it?" text="It goes to Trash for 7 days." onCancel={() => setDel(false)}
        actions={[{ label: 'Keep it', run: () => setDel(false) }, { label: 'Delete', kind: 'danger', run: () => { setDel(false); onDelete(); } }]} />}
    </Modal>
  );
}

export function HolidayForm({ ctx, id, day, onClose }: { ctx: CalCtx; id: string | null; day: number; onClose(): void }) {
  const store = useStore();
  const custom = useCustomTraditions();
  const rec = id ? store.get(id) : undefined;
  const d0 = dateOf(day, ctx.info.cal);
  const [start] = useState(() => (rec ? holidayData(rec) : { name: '', season: d0.season, day: d0.day, banner: DEFAULT_HOLIDAY_BANNER, traditions: [] as string[], notes: '' }));
  const [f, setF] = useState(start);
  const [tried, setTried] = useState(false);
  const [picked, setPicked] = useState(!!id); // once you choose a banner yourself, the name stops choosing for you
  const len = ctx.info.cal.seasonLength;
  const options = [
    ...custom.list.map((t) => ({ id: `${TRADITION_PREFIX}${t.id}`, label: t.name, group: 'Your traditions' })),
    ...ctx.info.avail.traditions.map((t) => ({ id: t.id, label: t.name })),
    ...f.traditions.filter((t) => !t.startsWith(TRADITION_PREFIX) && !ctx.info.avail.traditions.some((x) => x.id === t)).map((t) => ({ id: t, label: `${BY_ID.traditions.get(t)?.name ?? t} (pack is off)` })),
  ];
  const save = () => {
    setTried(true);
    if (!f.name.trim()) return;
    store.put('holiday', { ...f, name: f.name.trim() }, id ?? undefined);
    toast(id ? 'Saved' : `${f.name.trim()} added`);
    onClose();
  };
  return (
    <FormShell title={id ? 'Edit holiday' : 'New holiday'} isNew={!id} dirty={JSON.stringify(f) !== JSON.stringify(start)} onClose={onClose} onSave={save} saveLabel={id ? 'Save' : 'Add holiday'}
      onDelete={() => { onClose(); store.moveToTrash(id!, f.name || 'Holiday'); }}>
      <Field label="Name" hint={tried && !f.name.trim() ? <span className="field-err">Give it a name.</span> : undefined}>
        {(fid) => <TextInput id={fid} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, banner: (!picked && bannerForName(e.target.value, 'holiday')) || f.banner })} maxLength={60} placeholder="Like Spring Fling" />}
      </Field>
      <Field label="Banner">{() => <BannerPicker ids={HOLIDAY_BANNERS} value={f.banner} onChange={(banner) => { setPicked(true); setF({ ...f, banner }); }} label="Banner" />}</Field>
      <Field label="Day" hint="Every year.">
        {() => <DateField label="Day" yearless seasonLength={len} value={{ year: 1, season: f.season, day: Math.min(f.day, len) }} onChange={(d) => setF({ ...f, season: d.season, day: d.day })} />}
      </Field>
      <Field label="Traditions" hint="Pick from the game’s list, or type your own. Yours stay in the list.">
        {(fid) => <Picker id={fid} multiple options={options} value={f.traditions} onChange={(traditions) => setF({ ...f, traditions })} placeholder="Type a tradition" onAdd={(label) => custom.add(label)} />}
      </Field>
      <Field label="Notes">{(fid) => <textarea id={fid} className="textarea" rows={3} value={f.notes} placeholder="Anything worth remembering…" onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
    </FormShell>
  );
}

export function EventForm({ ctx, id, day, name, onClose }: { ctx: CalCtx; id: string | null; day: number; /** New event only: a name to start with. */ name?: string; onClose(): void }) {
  const store = useStore();
  const rec = id ? store.get(id) : undefined;
  const [start] = useState(() => (rec ? eventData(rec) : { name: '', day, banner: DEFAULT_EVENT_BANNER, host: null as string | null, going: [] as string[], notes: '' }));
  const [f, setF] = useState(() => (!id && name ? { ...start, name, banner: bannerForName(name, 'event') || start.banner } : start));
  const [tried, setTried] = useState(false);
  const [picked, setPicked] = useState(!!id);
  const sims = useSimOptions(ctx);
  const save = () => {
    setTried(true);
    if (!f.name.trim()) return;
    store.put('event', { ...f, name: f.name.trim(), going: f.going.filter((g) => g !== f.host) }, id ?? undefined);
    toast(id ? 'Saved' : `${f.name.trim()} added`);
    onClose();
  };
  return (
    <FormShell title={id ? 'Edit event' : 'New event'} isNew={!id} dirty={JSON.stringify(f) !== JSON.stringify(start)} onClose={onClose} onSave={save} saveLabel={id ? 'Save' : 'Add event'}
      onDelete={() => { onClose(); store.moveToTrash(id!, f.name || 'Event'); }}>
      <Field label="Name" hint={tried && !f.name.trim() ? <span className="field-err">Give it a name.</span> : undefined}>
        {(fid) => <TextInput id={fid} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, banner: (!picked && bannerForName(e.target.value, 'event')) || f.banner })} maxLength={60} placeholder="Like Adaeze’s graduation party" />}
      </Field>
      <Field label="Banner">{() => <BannerPicker ids={EVENT_BANNERS} value={f.banner} onChange={(banner) => { setPicked(true); setF({ ...f, banner }); }} label="Banner" />}</Field>
      <Field label="Day">{() => <DateField label="Day" seasonLength={ctx.info.cal.seasonLength} today={todayOf(ctx)} value={toDate(ctx, f.day)} onChange={(d) => setF({ ...f, day: dayOf(d, ctx.info.cal) })} />}</Field>
      <Field label="Host">{(fid) => <Picker id={fid} options={sims} value={f.host ? [f.host] : []} onChange={(v) => setF({ ...f, host: v[0] ?? null })} placeholder="Type a Sim’s name" />}</Field>
      <Field label="Going">{(fid) => <Picker id={fid} multiple options={sims.filter((s) => s.id !== f.host)} value={f.going.filter((g) => g !== f.host)} onChange={(going) => setF({ ...f, going })} placeholder="Type a Sim’s name" />}</Field>
      <Field label="Notes">{(fid) => <textarea id={fid} className="textarea" rows={3} value={f.notes} placeholder="Anything worth remembering…" onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
    </FormShell>
  );
}

const ADVENTURE_AWAITS = 'adventure-awaits';

export function VacationForm({ save: saveRow, ctx, id, day, onClose }: { save: SaveRow; ctx: CalCtx; id: string | null; day: number; onClose(): void }) {
  const store = useStore();
  const lots = useLotsCtx(saveRow);
  const rec = id ? store.get(id) : undefined;
  const [start] = useState(() => (rec ? vacationData(rec) : { name: '', kind: 'vacation' as TripKind, banner: DEFAULT_TRIP_BANNER, from: day, to: day + 2, going: [] as string[], world: null as string | null, stay: null as string | null, notes: '' }));
  const [f, setF] = useState(start);
  const [tried, setTried] = useState(false);
  const [askPack, setAskPack] = useState(false);
  const [asked, setAsked] = useState(false);
  const [picked, setPicked] = useState(!!id);
  const sims = useSimOptions(ctx);
  const getaway = f.kind === 'getaway';
  const stayOptions = stayOptionsFor(lots, f.kind, f.stay);
  const setKind = (kind: TripKind) => {
    // Vacations stay at hotels or rentals only; a getaway can be hosted anywhere.
    const keep = kind === 'getaway' || !f.stay || stayOptionsFor(lots, 'vacation', null).some((o) => o.id === f.stay);
    setF({ ...f, kind, stay: keep ? f.stay : null });
    if (kind === 'getaway' && !asked && !ctx.info.d.packs.includes(ADVENTURE_AWAITS)) { setAsked(true); setAskPack(true); }
  };
  const save = () => {
    setTried(true);
    if (!f.name.trim()) return;
    store.put('vacation', { ...f, name: f.name.trim(), to: Math.max(f.from, f.to) }, id ?? undefined);
    toast(id ? 'Saved' : `${f.name.trim()} added`);
    onClose();
  };
  const noun = getaway ? 'getaway' : 'vacation';
  return (
    <FormShell title={id ? `Edit ${noun}` : `New ${noun}`} isNew={!id} dirty={JSON.stringify(f) !== JSON.stringify(start)} onClose={onClose} onSave={save} saveLabel={id ? 'Save' : `Add ${noun}`}
      onDelete={() => { onClose(); store.moveToTrash(id!, f.name || (getaway ? 'Getaway' : 'Vacation')); }}>
      <Seg<TripKind> label="Trip type" value={f.kind} onChange={setKind} options={[{ v: 'vacation', label: 'Vacation' }, { v: 'getaway', label: 'Getaway' }]} />
      <Field label="Name" hint={tried && !f.name.trim() ? <span className="field-err">Give it a name.</span> : undefined}>
        {(fid) => <TextInput id={fid} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, banner: (!picked && bannerForName(e.target.value, 'trip')) || f.banner })} maxLength={60} placeholder={getaway ? 'Like Cabin weekend' : 'Like Okafors in Selvadorada'} />}
      </Field>
      <Field label="Banner">{() => <BannerPicker ids={TRIP_BANNERS} value={f.banner} onChange={(banner) => { setPicked(true); setF({ ...f, banner }); }} label="Banner" />}</Field>
      <Field label="Dates">
        {() => <RangeField label="Dates" seasonLength={ctx.info.cal.seasonLength} today={todayOf(ctx)} from={toDate(ctx, f.from)} to={toDate(ctx, f.to)}
          onChange={(a, b) => setF({ ...f, from: dayOf(a, ctx.info.cal), to: dayOf(b, ctx.info.cal) })} />}
      </Field>
      <Field label="Who’s going">{(fid) => <Picker id={fid} multiple options={sims} value={f.going} onChange={(going) => setF({ ...f, going })} placeholder="Type a Sim’s name" />}</Field>
      <Field label={getaway ? 'Hosted at (optional)' : 'Staying at (optional)'} hint={getaway ? 'Any lot works.' : 'Hotels and vacation rentals.'}>
        {(fid) => <Picker id={fid} options={stayOptions} value={f.stay ? [f.stay] : []} onChange={(v) => setF({ ...f, stay: v[0] ?? null })} placeholder={stayOptions.length ? 'Type a lot name' : getaway ? 'No lots yet' : 'No hotels or rentals yet'} />}
      </Field>
      <Field label="World (optional)">
        {(fid) => (
          <select id={fid} className="select" value={f.world ?? ''} onChange={(e) => setF({ ...f, world: e.target.value || null })}>
            <option value="">No world</option>
            {lots.worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </Field>
      <Field label="Notes">{(fid) => <textarea id={fid} className="textarea" rows={3} value={f.notes} placeholder="Anything worth remembering…" onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      {askPack && (
        <Confirm title="Getaways come from Adventure Awaits" text="Is that pack in this save? Turning it on adds its stuff to your pickers."
          onCancel={() => setAskPack(false)}
          actions={[
            { label: 'No, keep going', run: () => setAskPack(false) },
            { label: 'Yes, it’s in this save', kind: 'primary', run: () => { store.updateSave(saveRow.id, { packs: [...ctx.info.d.packs, ADVENTURE_AWAITS] }); setAskPack(false); toast('Adventure Awaits added to this save'); } },
          ]} />
      )}
    </FormShell>
  );
}

/** Where a trip can stay: vacations pick hotels and vacation rentals; a getaway can be hosted at any lot (rentals first). */
function stayOptionsFor(lots: LotsCtx, kind: TripKind, chosen: string | null) {
  const rows = lots.rows.filter((r) => r.lot.type !== APARTMENT);
  const rentals = rows.filter((r) => r.lot.type === VACATION_RENTAL);
  const hotels = rows.filter((r) => isHotelType(r.lot.type));
  const mk = (list: typeof rows, group: string) => list.map((r) => ({ id: r.id, label: r.lot.name, group })).sort((a, b) => a.label.localeCompare(b.label));
  let out = kind === 'vacation'
    ? [...mk(hotels, 'Hotels'), ...mk(rentals, 'Vacation rentals')]
    : [...mk(rentals, 'Vacation rentals'), ...mk(rows.filter((r) => r.lot.type !== VACATION_RENTAL), 'Other lots')];
  if (chosen && !out.some((o) => o.id === chosen)) {
    const r = lots.rows.find((x) => x.id === chosen);
    out = [...out, { id: chosen, label: r ? r.lot.name : 'Removed lot', group: 'Current' }];
  }
  return out;
}
