import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarBlank, Camera, CaretLeft, Crown, Check, CaretRight, FunnelSimple, PencilSimple, Plus, TextAlignLeft, Trash, UsersThree, X } from '@phosphor-icons/react';
import { PhotoBox } from '../../components/photo';
import { DateField, RangePanel } from '../../components/SeasonPicker';
import { ObjIcon } from '../../components/categories';
import { Confirm, Field, Modal, SearchBox, Sheet, TextInput, toast } from '../../components/ui';
import { albumFilterOn, filterPhotos, groupPhotos, hasRange, itemKey, rangeText, NO_ALBUM_FILTER, photoDates, photoRows, photosOfClub, photosOfLegacy, photosOfItem, photosOfStory, photosOfSim, sortPhotos, suggest, type AlbumFilter, type Namer, type PhotoData, type PhotoItem, type PhotoRow, type SortMode } from '../../lib/album';
import { clubRows, GET_TOGETHER } from '../../lib/clubs';
import { PhotoError, PHOTO_MESSAGES, preparePhoto, usePhotos, type Prepared } from '../../lib/photos';
import { go, savePath } from '../../lib/router';
import { useRecords, useStore } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { dateOf, dayOf, SEASONS, type SimDate } from '../../lib/time';
import { fullName, simData } from '../../lib/sims';
import { genData, genLabel, genRows, legacyData, legacyRows } from '../../lib/legacy';
import { normalize, plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import { SimAvatar, useSaveInfo } from '../sims/shared';

/** What the Photos pages need to know about a save: its photos, its Sims and whether it tracks the game date. */
export function useAlbum(save: SaveRow) {
  const recs = useRecords('photo');
  const simRecs = useRecords('sim');
  const holidays = useRecords('holiday');
  const events = useRecords('event');
  const trips = useRecords('vacation');
  const clubRecs = useRecords('club');
  const legacyRecs = useRecords('legacy');
  const genRecs = useRecords('generation');
  const info = useSaveInfo(save);
  return useMemo(() => {
    const sims = new Map(simRecs.map((r) => [r.id, simData(r)]));
    const nameOf = (id: string) => (sims.has(id) ? fullName(sims.get(id)!) : 'Removed Sim');
    const lists = { holiday: holidays, event: events, vacation: trips } as const;
    const occasionName = (item: PhotoItem) => (item.kind === 'birthday' ? `${nameOf(item.id)}’s birthday`
      : String((lists[item.kind].find((r) => r.id === item.id)?.data as { name?: string } | undefined)?.name || 'A calendar item'));
    const clubs = clubRows(clubRecs);
    const clubName = (id: string) => clubs.find((c) => c.id === id)?.club.name ?? '';
    const legacyName = (id: string) => legacyData(legacyRecs.find((r) => r.id === id)).name;
    const genName = (id: string) => { const r = genRecs.find((x) => x.id === id); return r ? genLabel(genData(r)) : ''; };
    const clubsOn = info.d.packs.includes(GET_TOGETHER);
    const namer: Namer = { simName: nameOf, occasionName, clubName };
    const rows = sortPhotos(photoRows(recs), info.track);
    const cal = info.track ? info.cal : null;
    /** The small line under an occasion's name: when it is. Empty when the save doesn't track dates (and for birthdays). */
    const occasionWhen = (item: PhotoItem) => {
      if (!cal || item.kind === 'birthday') return '';
      const d = lists[item.kind].find((r) => r.id === item.id)?.data as { day?: number; from?: number; season?: number } | undefined;
      const full = (day: number) => { const x = dateOf(day, cal); return `${SEASONS[x.season]} · Year ${x.year} · Day ${x.day}`; };
      if (item.kind === 'event' && typeof d?.day === 'number') return full(d.day);
      if (item.kind === 'vacation' && typeof d?.from === 'number') return full(d.from);
      if (item.kind === 'holiday' && typeof d?.season === 'number' && typeof d.day === 'number') return `Every ${SEASONS[d.season]} · Day ${d.day}`;
      return '';
    };
    return { rows, sims, nameOf, occasionName, occasionWhen, clubs, clubName, legacyName, genName, clubsOn, namer, info, cal, dates: (p: PhotoData) => photoDates(p, cal) };
  }, [recs, simRecs, holidays, events, trips, clubRecs, info, legacyRecs, genRecs]);
}
type Album = ReturnType<typeof useAlbum>;

// ---------- which photos the viewer steps through ----------
// Opening a photo remembers the list it was opened from (the filtered, sorted grid, a Sim's photos, an occasion's photos),
// so prev/next stay inside that list. Opening a photo link directly falls back to every photo.
let viewList: { saveId: string; ids: string[] } | null = null;
const openFrom = (saveId: string, rows: PhotoRow[]) => { viewList = { saveId, ids: rows.map((r) => r.id) }; };
// The grid's filter and sort, kept while you look at photos so Back returns to the same grid.
const gridState = new Map<string, { f: AlbumFilter; sort: SortMode }>();

// ---------- adding and editing ----------
type Preset = { item?: PhotoItem | null; simIds?: string[]; gameDay?: number | null; clubId?: string | null; storylineId?: string | null; legacyId?: string | null; genId?: string | null };

/** Choose a file, then fill in the details. Photos are saved at their natural shape (no cropping). */
export function usePhotoAdder(save: SaveRow, preset: Preset = {}) {
  const input = useRef<HTMLInputElement>(null);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [working, setWorking] = useState(false);
  const start = () => { if (input.current) { input.current.value = ''; input.current.click(); } };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setWorking(true);
    try { setPrep(await preparePhoto(file)); }
    catch (e) { toast(e instanceof PhotoError ? e.message : PHOTO_MESSAGES.decode); }
    finally { setWorking(false); }
  };
  const ui = (
    <>
      <input ref={input} type="file" accept="image/*,.heic,.heif" hidden aria-label="Choose a photo" onChange={(e) => void onFile(e.target.files?.[0])} />
      {working && <div className="photo-working" role="status">Getting your photo ready…</div>}
      {prep && <PhotoForm save={save} prep={prep} preset={preset} onClose={() => { const u = prep.previewUrl; window.setTimeout(() => URL.revokeObjectURL(u), 2000); setPrep(null); }} />}
    </>
  );
  return { start, ui };
}

function PhotoForm({ save, prep, existing, preset = {}, onClose }: {
  save: SaveRow; prep?: Prepared; existing?: PhotoRow; preset?: Preset; onClose(): void;
}) {
  const store = useStore();
  const svc = usePhotos();
  const album = useAlbum(save);
  const { info } = album;
  const start = existing?.p;
  const [f, setF] = useState(() => ({
    caption: start?.caption ?? '',
    simIds: start?.simIds ?? preset.simIds ?? [],
    gameDay: start ? start.gameDay : preset.gameDay !== undefined ? preset.gameDay : info.track ? info.today : null,
    clubId: start ? start.clubId : preset.clubId ?? null,
    legacyId: start ? start.legacyId : preset.legacyId ?? null,
    genId: start ? start.genId : preset.genId ?? null,
  }));
  const legacies = useRecords('legacy');
  const gens = useRecords('generation');
  const tagOptions = useMemo(() => legacyRows(legacies).flatMap((l) => [
    { legacyId: l.id, genId: null as string | null, label: l.l.name || 'Unnamed legacy' },
    ...genRows(gens).filter((g) => g.g.legacy === l.id).map((g) => ({ legacyId: l.id, genId: g.id as string | null, label: `${l.l.name || 'Legacy'} · ${genLabel(g.g)}${g.g.title ? ` · ${g.g.title}` : ''}` })),
  ]), [legacies, gens]);
  const tagText = (legacyId: string | null, genId: string | null) => {
    const l = legacies.find((r) => r.id === legacyId); const g = gens.find((r) => r.id === genId);
    return `${l ? legacyData(l).name || 'Legacy' : 'Removed legacy'}${genId ? ` · ${g ? genLabel(genData(g)) : 'Removed generation'}` : ''}`;
  };
  const [view, setView] = useState<'form' | 'sims' | 'club' | 'tag'>('form');
  const [lq, setLq] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const item = start ? start.item : preset.item ?? null;
  const dirty = !!prep || f.caption !== (start?.caption ?? '') || f.gameDay !== (start?.gameDay ?? null) || f.simIds.join() !== (start?.simIds ?? []).join() || f.clubId !== (start?.clubId ?? null) || f.legacyId !== (start?.legacyId ?? null) || f.genId !== (start?.genId ?? null);
  const simOptions = useMemo(() => [...album.sims.entries()].map(([id, s]) => ({ id, label: fullName(s) })).sort((a, b) => a.label.localeCompare(b.label)), [album.sims]);
  const cal = info.cal;
  const clamp = (d: number) => Math.max(0, d);

  const save_ = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = { caption: f.caption.trim(), simIds: f.simIds, gameDay: info.track ? f.gameDay : null, item, clubId: f.clubId, storylineId: start ? start.storylineId : preset.storylineId ?? null, legacyId: f.legacyId, genId: f.legacyId ? f.genId : null };
      if (existing) {
        store.put('photo', { ...existing.p, ...data }, existing.id);
        toast('Saved');
      } else if (prep) {
        const id = await svc.upload(prep, save.id);
        store.put('photo', { ...data, photo: { id, w: prep.w, h: prep.h }, added: new Date().toISOString() });
        toast('Photo added');
      }
      onClose();
    } catch (e) {
      setBusy(false);
      toast(e instanceof PhotoError ? e.message : PHOTO_MESSAGES.failed);
    }
  };

  return (
    <Modal title={view === 'form' ? (existing ? 'Edit photo' : 'Add a photo') : (
      <span className="ph-ft">
        <button type="button" className="ph-ft-back" aria-label="Back" onClick={() => { setLq(''); setView('form'); }}><CaretLeft size={22} weight="bold" /></button>
        <span>{view === 'sims' ? 'Sims in this photo' : view === 'tag' ? 'Add tag' : 'Club'}</span>
        {view === 'club' && f.clubId && <button type="button" className="ph-ft-clear" onClick={() => { setF({ ...f, clubId: null }); setView('form'); }}>Clear</button>}
      </span>
    )} onClose={onClose} dirty={dirty} className="pinned ph-modal"
      footer={view === 'tag' ? undefined : view === 'sims' ? <button type="button" className="btn primary" onClick={() => { setLq(''); setView('form'); }}>{f.simIds.length ? `Done · ${f.simIds.length} selected` : 'Done'}</button> : view === 'club' ? undefined : (close) => (
        <>
          {existing && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => setDel(true)}><Trash size={16} weight="duotone" /> Delete</button>}
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void save_()}>{busy ? 'Saving…' : existing ? 'Save' : 'Add photo'}</button>
        </>
      )}>
      {view === 'sims' && (
        <div className="ph-pk">
          <div className="ph-pk-search"><SearchBox value={lq} onChange={setLq} placeholder="Search Sims" /></div>
          <div className="ph-pk-list">
            {(() => {
              const ok = (l: string) => !lq.trim() || normalize(l).includes(normalize(lq));
              const chosen = f.simIds.filter((x) => album.sims.has(x)).map((x) => ({ id: x, label: album.nameOf(x) })).filter((o) => ok(o.label));
              const rest = simOptions.filter((o) => !f.simIds.includes(o.id) && ok(o.label));
              const line = (o: { id: string; label: string }, on: boolean) => (
                <button key={o.id} type="button" role="checkbox" aria-checked={on} aria-label={o.label} className="ph-pk-sim" onClick={() => setF({ ...f, simIds: on ? f.simIds.filter((x) => x !== o.id) : [...f.simIds, o.id] })}>
                  <span className={`ph-cb ${on ? 'on' : ''}`} aria-hidden="true" /><SimAvatar sim={album.sims.get(o.id)!} size={30} /><span className="ph-pk-t">{o.label}</span>
                </button>
              );
              return <>
                {chosen.length > 0 && <div className="ph-lbl">Selected</div>}{chosen.map((o) => line(o, true))}
                {rest.length > 0 && <div className="ph-lbl">Everyone</div>}{rest.map((o) => line(o, false))}
                {chosen.length + rest.length === 0 && <p className="muted ph-pk-none">{simOptions.length ? `No Sim called “${lq.trim()}”.` : 'Add some Sims first.'}</p>}
              </>;
            })()}
          </div>
        </div>
      )}
      {view === 'club' && (
        <div className="ph-pk">
          <div className="ph-pk-search"><SearchBox value={lq} onChange={setLq} placeholder="Search clubs" /></div>
          <div className="ph-pk-list" role="listbox" aria-label="Clubs">
            {album.clubs.filter((c) => !lq.trim() || normalize(c.club.name).includes(normalize(lq))).map((c) => (
              <button key={c.id} type="button" role="option" aria-selected={f.clubId === c.id} className="ph-pk-opt" onClick={() => { setF({ ...f, clubId: c.id }); setLq(''); setView('form'); }}>
                <span className="ph-pk-ot"><span className="ph-pk-t">{c.club.name}</span><span className="ph-pk-sub">{plural(c.club.members.length, 'member')}</span></span>
                <span className="ph-pk-tick" aria-hidden="true">{f.clubId === c.id && <Check size={18} weight="bold" />}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {view === 'tag' && (
        <div className="ph-pk">
          <div className="ph-pk-search"><SearchBox value={lq} onChange={setLq} placeholder="Search legacies and generations" /></div>
          <div className="ph-pk-list" role="listbox" aria-label="Tags">
            {tagOptions.filter((o) => !lq.trim() || normalize(o.label).includes(normalize(lq))).map((o) => (
              <button key={`${o.legacyId}/${o.genId ?? ''}`} type="button" role="option" aria-selected={f.legacyId === o.legacyId && f.genId === o.genId} className="ph-pk-opt" onClick={() => { setF({ ...f, legacyId: o.legacyId, genId: o.genId }); setLq(''); setView('form'); }}>
                <span className="ph-pk-ot"><span className="ph-pk-t">{o.label}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
      <form className="stack" style={{ gap: 16, display: view === 'form' ? undefined : 'none' }} onSubmit={(e) => { e.preventDefault(); void save_(); }}>
        <div className="ph-preview">
          {prep ? <img src={prep.previewUrl} alt="Your new photo" /> : existing && <PhotoBox photo={existing.p.photo} aspect={existing.p.photo.w / existing.p.photo.h} alt={existing.p.caption} />}
        </div>
        <Field label="Caption">{(id) => <TextInput id={id} value={f.caption} maxLength={140} placeholder="Like Adaeze blowing out her candles" onChange={(e) => setF({ ...f, caption: e.target.value })} />}</Field>
        <div className="field">
          <span className="label">Sims in this photo (optional)</span>
          <button type="button" className="ph-fld" aria-label={`Sims in this photo: ${f.simIds.length ? f.simIds.map((x) => album.sims.get(x)?.first || album.nameOf(x)).join(', ') : 'None yet'}. ${f.simIds.length ? 'Change' : 'Add'}`} onClick={() => { setLq(''); setView('sims'); }}>
            <span className={f.simIds.length ? '' : 'ph-fld-empty'}>{f.simIds.length ? (f.simIds.length > 3 ? `${f.simIds.slice(0, 3).map((x) => album.sims.get(x)?.first || album.nameOf(x)).join(', ')} +${f.simIds.length - 3}` : f.simIds.map((x) => album.sims.get(x)?.first || album.nameOf(x)).join(', ')) : 'None yet'}</span><small>{f.simIds.length ? 'Change' : 'Add'}</small>
          </button>
        </div>
        {album.clubsOn && (album.clubs.length > 0 || f.clubId) && (
          <div className="field">
            <span className="label">Club (optional)</span>
            <button type="button" className="ph-fld" aria-label={`Club: ${f.clubId ? album.clubName(f.clubId) || 'A removed club' : 'None'}. ${f.clubId ? 'Change' : 'Choose'}`} onClick={() => { setLq(''); setView('club'); }}>
              <span className={f.clubId ? '' : 'ph-fld-empty'}>{f.clubId ? album.clubName(f.clubId) || 'A removed club' : 'None'}</span><small>{f.clubId ? 'Change' : 'Choose'}</small>
            </button>
          </div>
        )}
        {(f.legacyId || tagOptions.length > 0) && (
          <div className="field">
            <span className="label">Tags</span>
            <div className="ph-tags">
              {f.legacyId && (
                <span className="tag legacy ph-tag">
                  <Crown size={14} weight="duotone" color="var(--accent)" aria-hidden="true" />{tagText(f.legacyId, f.genId)}
                  <button type="button" className="club-x" aria-label={`Remove tag ${tagText(f.legacyId, f.genId)}`} onClick={() => setF({ ...f, legacyId: null, genId: null })}><X size={14} weight="bold" /></button>
                </span>
              )}
              {!f.legacyId && <button type="button" className="btn ph-addtag" onClick={() => { setLq(''); setView('tag'); }}><Plus size={14} weight="bold" /> Add tag</button>}
            </div>
          </div>
        )}
        {info.track && (
          <Field label="Game date" hint="The day it happened in your game. The day you add it is saved too.">
            {() => f.gameDay === null ? (
              <button type="button" className="btn" onClick={() => setF({ ...f, gameDay: info.today })}><Plus size={14} weight="bold" /> Add a game date</button>
            ) : (
              <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                <div className="grow"><DateField label="Game date" seasonLength={cal.seasonLength} today={dateOf(info.today, cal)} value={dateOf(clamp(f.gameDay), cal)} onChange={(d) => setF({ ...f, gameDay: dayOf(d, cal) })} /></div>
                <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, gameDay: null })}>Remove</button>
              </div>
            )}
          </Field>
        )}
      </form>
      {del && existing && (
        <Confirm title="Delete this photo?" text="It goes to Trash for 7 days." onCancel={() => setDel(false)}
          actions={[{ label: 'Keep it', run: () => setDel(false) }, { label: 'Delete', kind: 'danger', run: () => { setDel(false); store.moveToTrash(existing.id, 'Photo'); onClose(); go(savePath(save.id, 'photos')); } }]} />
      )}
    </Modal>
  );
}

// ---------- pieces other pages reuse ----------
/** A small row of photos with their dates. Used on Sim profiles and calendar pages. */
export function PhotoStrip({ save, rows, album, all = rows }: { save: SaveRow; rows: PhotoRow[]; album: Album; all?: PhotoRow[] }) {
  return (
    <div className="ph-strip">
      {rows.map((r) => (
        <a key={r.id} className="ph-mini" href={savePath(save.id, `photos/${r.id}`)} onClick={() => openFrom(save.id, all)} aria-label={r.p.caption || album.dates(r.p).main || 'Photo'}>
          <PhotoBox photo={r.p.photo} aspect={1} size="thumb" />
          <span className="ph-mini-date">{album.dates(r.p).main}</span>
        </a>
      ))}
    </div>
  );
}

/** The Photos card on a calendar item: its photos and an Add photo button. */
export function ItemPhotos({ save, item, gameDay }: { save: SaveRow; item: PhotoItem; gameDay: number | null }) {
  const album = useAlbum(save);
  const adder = usePhotoAdder(save, { item, gameDay });
  const rows = photosOfItem(album.rows, item.kind, item.id, album.info.track);
  return (
    <section className="card">
      <div className="cal-h">Photos{rows.length ? ` · ${rows.length}` : ''}</div>
      {rows.length > 0 && <PhotoStrip save={save} rows={rows} album={album} />}
      {rows.length === 0 && <p className="muted small" style={{ margin: '0 0 10px' }}>No photos yet.</p>}
      <button type="button" className="btn sm" onClick={adder.start}><Camera size={15} weight="duotone" /> Add photo</button>
      {adder.ui}
    </section>
  );
}

/** The Photos card on a club's page: photos tagged with it, and an Add photo button. */
export function ClubPhotos({ save, clubId }: { save: SaveRow; clubId: string }) {
  const album = useAlbum(save);
  const adder = usePhotoAdder(save, { clubId });
  const rows = photosOfClub(album.rows, clubId, album.info.track);
  return (
    <section className="card club-card">
      <div className="card-head"><h2>Photos{rows.length > 0 && <span className="cnt">{rows.length}</span>}</h2></div>
      {rows.length > 0 ? <PhotoStrip save={save} rows={rows} album={album} /> : <p className="muted small" style={{ margin: '0 0 10px' }}>No photos yet.</p>}
      <button type="button" className="btn sm" onClick={adder.start}><Camera size={15} weight="duotone" /> Add photo</button>
      {adder.ui}
    </section>
  );
}

/** The Pictures card on a storyline's page: photos tagged with it, and an Add button. */
export function StoryPhotos({ save, storylineId }: { save: SaveRow; storylineId: string }) {
  const album = useAlbum(save);
  const adder = usePhotoAdder(save, { storylineId });
  const rows = photosOfStory(album.rows, storylineId, album.info.track);
  return (
    <section className="card sl-card">
      <div className="card-head"><h2>Pictures{rows.length > 0 && <span className="cnt">{rows.length}</span>}</h2>
        <button type="button" className="btn sm" onClick={adder.start}><Plus size={15} weight="bold" /> Add</button>
      </div>
      {rows.length > 0 ? <PhotoStrip save={save} rows={rows} album={album} /> : <p className="muted small" style={{ margin: 0 }}>No pictures yet. They also show up in Photos.</p>}
      {adder.ui}
    </section>
  );
}

/** The Photos card on a legacy or generation page: one 72px scrolling strip that ends in an Add tile. New photos are tagged with the page they're added from. */
export function LegacyPhotos({ save, legacyId, genId }: { save: SaveRow; legacyId: string; genId?: string }) {
  const album = useAlbum(save);
  const adder = usePhotoAdder(save, { legacyId, genId: genId ?? null });
  const rows = photosOfLegacy(album.rows, legacyId, album.info.track, genId);
  return (
    <section className="card sl-card lg-photos">
      <div className="card-head"><h2>Photos{rows.length > 0 && <span className="cnt">{rows.length}</span>}</h2></div>
      <div className="lg-strip">
        {rows.map((r) => (
          <a key={r.id} className="lg-ph" href={savePath(save.id, `photos/${r.id}`)} onClick={() => openFrom(save.id, rows)} aria-label={r.p.caption || album.dates(r.p).main || 'Photo'}>
            <PhotoBox photo={r.p.photo} aspect={1} size="thumb" />
          </a>
        ))}
        <button type="button" className="lg-ph add" aria-label="Add photo" onClick={adder.start}><Plus size={20} weight="bold" /></button>
      </div>
      {adder.ui}
    </section>
  );
}

/** Photos a Sim is tagged in, on their profile. */
export function SimPhotos({ save, simId, phone, extra }: { save: SaveRow; simId: string; phone?: boolean; extra?: ReactNode }) {
  const album = useAlbum(save);
  const adder = usePhotoAdder(save, { simIds: [simId] });
  const rows = photosOfSim(album.rows, simId, album.info.track);
  const body = (
    <>
      {rows.length > 0 ? <PhotoStrip save={save} rows={rows.slice(0, 12)} all={rows} album={album} /> : <p className="muted small" style={{ margin: '0 0 10px' }}>No photos of them yet.</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn sm" onClick={adder.start}><Camera size={15} weight="duotone" /> Add photo</button>
        {rows.length > 12 && <a className="btn sm ghost" href={savePath(save.id, 'photos')}>See all {rows.length}</a>}
      </div>
      {extra}
      {adder.ui}
    </>
  );
  if (phone) return <><div className="m-label">Photos{rows.length ? ` · ${rows.length}` : ''}</div><div className="m-group"><div className="m-row col">{body}</div></div></>;
  return <section className="card"><div className="card-head"><h2><span className="obj photos"><Camera size={16} weight="duotone" /></span>Photos</h2></div>{body}</section>;
}

// ---------- the Photos page ----------
export function PhotosPage({ save, rest }: { save: SaveRow; rest: string[] }) {
  return rest[0] ? <PhotoPage key={rest[0]} save={save} photoId={rest[0]} /> : <PhotoGrid save={save} />;
}

function PhotoGrid({ save }: { save: SaveRow }) {
  const album = useAlbum(save);
  const phone = useIsPhone();
  const adder = usePhotoAdder(save);
  const track = !!album.cal;
  const kept = gridState.get(save.id);
  const [f, setF] = useState<AlbumFilter>(kept?.f ?? NO_ALBUM_FILTER);
  const [sort, setSort] = useState<SortMode>(kept?.sort ?? 'game');
  useEffect(() => { gridState.set(save.id, { f: { ...f, q: '' }, sort }); }, [save.id, f, sort]);
  const [sheet, setSheet] = useState(false);
  const [focus, setFocus] = useState(false);
  const mode: SortMode = track ? sort : 'added';
  const sorted = useMemo(() => sortPhotos(album.rows, mode === 'game'), [album.rows, mode]);
  // Sims and occasions that appear in photos, with how many photos each has (most first).
  const simOptions = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of album.rows) for (const id of r.p.simIds) n.set(id, (n.get(id) ?? 0) + 1);
    return [...n.entries()].filter(([id]) => album.sims.has(id)).map(([id, count]) => ({ id, label: album.nameOf(id), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [album]);
  const occasionOptions = useMemo(() => {
    const m = new Map<string, { label: string; when: string; count: number }>();
    for (const r of album.rows) if (r.p.item) {
      const k = itemKey(r.p.item); const o = m.get(k);
      if (o) o.count++; else m.set(k, { label: album.occasionName(r.p.item), when: album.occasionWhen(r.p.item), count: 1 });
    }
    return [...m.entries()].map(([id, o]) => ({ id, ...o })).sort((a, b) => a.label.localeCompare(b.label));
  }, [album]);
  const clubOptions = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of album.rows) if (r.p.clubId) n.set(r.p.clubId, (n.get(r.p.clubId) ?? 0) + 1);
    return album.clubs.filter((c) => n.has(c.id)).map((c) => ({ id: c.id, label: c.club.name, count: n.get(c.id)! }));
  }, [album]);
  // A range only makes sense for a save that tracks the game date.
  const ranged = track && hasRange(f);
  const ff: AlbumFilter = ranged ? f : { ...f, from: null, to: null };
  const shown = useMemo(() => filterPhotos(sorted, ff, album.namer), [sorted, f.simIds, f.occasion, f.club, f.q, ff.from, ff.to, album.namer]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupPhotos(shown, album.cal, mode), [shown, album.cal, mode]);
  const sg = useMemo(() => suggest(sorted, f.q, album.namer), [sorted, f.q, album.namer]);
  const suggesting = focus && f.q.trim() !== '';
  const nf = (f.simIds.length ? 1 : 0) + (ranged ? 1 : 0) + (f.occasion ? 1 : 0) + (f.club ? 1 : 0);
  const add = <button type="button" className="btn primary" onClick={adder.start}><Plus size={16} weight="bold" /> Add photo</button>;
  const blur = () => { setFocus(false); (document.activeElement as HTMLElement | null)?.blur?.(); };
  const pickSim = (id: string) => { setF((x) => ({ ...x, simIds: x.simIds.includes(id) ? x.simIds : [...x.simIds, id], q: '' })); blur(); };
  const pickClub = (cid: string) => { setF((x) => ({ ...x, club: cid, q: '' })); blur(); };
  const pickOccasion = (key: string) => { setF((x) => ({ ...x, occasion: key, q: '' })); blur(); };

  const names = f.simIds.map((id) => album.sims.get(id)?.first || album.nameOf(id));
  const summary = [
    names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '),
    ranged && album.cal ? rangeText(f.from, f.to, album.cal) : '',
    f.occasion ? occasionOptions.find((o) => o.id === f.occasion)?.label ?? '' : '',
    f.club ? album.clubName(f.club) || 'A removed club' : '',
    f.q.trim() ? `“${f.q.trim()}”` : '',
  ].filter(Boolean).join(' · ');

  const clear = () => setF({ ...NO_ALBUM_FILTER });
  const filterUi = sheet && (
    <FilterSheet album={album} f={f} setF={setF} mode={mode} setSort={setSort} track={track} phone={phone} count={shown.length}
      simOptions={simOptions} occasionOptions={occasionOptions} clubOptions={clubOptions} clubsOn={album.clubsOn} onClose={() => setSheet(false)} onClear={clear} />
  );

  const searchPlaceholder = 'Search photos';
  const bar = (
    <div className="row ph-bar2" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <div className={phone ? 'm-search grow' : 'grow'} style={phone ? undefined : { flex: '0 1 380px' }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); blur(); } if (e.key === 'Escape') blur(); }}><SearchBox value={f.q} onChange={(q) => setF({ ...f, q })} placeholder={searchPlaceholder} /></div>
      {phone && focus
        ? <button type="button" className="btn ghost sm ph-cancel" style={{ color: 'var(--accent)' }} onMouseDown={(e) => e.preventDefault()} onClick={() => { setF({ ...f, q: '' }); blur(); }}>Cancel</button>
        : phone
          ? <button type="button" className="btn icon filter-btn" aria-label={nf ? `Filter, ${nf} on` : 'Filter'} onClick={() => setSheet(true)}><FunnelSimple size={20} weight="bold" />{nf > 0 && <span className="count">{nf}</span>}</button>
          : <button type="button" className="btn filter-btn" onClick={() => setSheet(true)}><FunnelSimple size={18} weight="bold" /> Filter{nf > 0 && <span className="count">{nf}</span>}</button>}
    </div>
  );
  const sum = albumFilterOn(ff) && !suggesting && (
    <div className="ph-sum"><span>{summary ? `${summary} · ` : ''}{plural(shown.length, 'photo')}</span><button type="button" onClick={clear}>Clear</button></div>
  );

  const hasSg = sg.sims.some((s) => album.sims.has(s.id)) || sg.occasions.length > 0 || sg.clubs.length > 0 || sg.captions.length > 0;
  const suggestUi = (
    <div className="ph-suggest" role="listbox" aria-label="Suggestions" onMouseDown={(e) => e.preventDefault()}>
      {!hasSg && <p className="muted">Nothing matches “{f.q.trim()}”.</p>}
      {sg.sims.filter((s) => album.sims.has(s.id)).length > 0 && <div className="ph-sg-h">Sims</div>}
      {sg.sims.filter((s) => album.sims.has(s.id)).map((s) => (
        <button key={s.id} type="button" className="ph-sg" onClick={() => pickSim(s.id)}>
          <SimAvatar sim={album.sims.get(s.id)!} size={34} /><span className="ph-sg-t">{s.name}</span><span className="ph-sg-n">{plural(s.count, 'photo')}</span>
        </button>
      ))}
      {sg.occasions.length > 0 && <div className="ph-sg-h">Occasions</div>}
      {sg.occasions.map((o) => (
        <button key={o.key} type="button" className="ph-sg" onClick={() => pickOccasion(o.key)}>
          <span className="ph-sg-i"><CalendarBlank size={18} weight="duotone" /></span><span className="ph-sg-t">{o.name}</span><span className="ph-sg-n">{plural(o.count, 'photo')}</span>
        </button>
      ))}
      {sg.clubs.length > 0 && <div className="ph-sg-h">Clubs</div>}
      {sg.clubs.map((c) => (
        <button key={c.id} type="button" className="ph-sg" onClick={() => pickClub(c.id)}>
          <span className="ph-sg-i"><UsersThree size={18} weight="duotone" /></span><span className="ph-sg-t">{c.name}</span><span className="ph-sg-n">{plural(c.count, 'photo')}</span>
        </button>
      ))}
      {sg.captions.length > 0 && <div className="ph-sg-h">Captions</div>}
      {sg.captions.map((c) => (
        <button key={c.id} type="button" className="ph-sg" onClick={() => { blur(); openFrom(save.id, sorted); go(savePath(save.id, `photos/${c.id}`)); }}>
          <span className="ph-sg-i"><TextAlignLeft size={18} weight="bold" /></span><span className="ph-sg-t">“{c.caption}”</span>
        </button>
      ))}
    </div>
  );

  const body = album.rows.length === 0 ? (
    <div className="empty">
      <ObjIcon cat="photos" size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>No photos yet</h2>
      <p>Add screenshots from your game. Tag the Sims in them and they’ll sort themselves by date.</p>
      {add}
    </div>
  ) : (
    <>
      {bar}
      {sum}
      {suggesting ? suggestUi : shown.length === 0 ? (
        <div className="empty"><h2 style={{ fontSize: 18, margin: 0 }}>No photos match that</h2><button type="button" className="btn" onClick={clear}>Clear</button></div>
      ) : groups.map((g) => {
        const wide = phone && g.rows.length === 1;
        return (
          <section key={g.key} className="ph-group">
            <h2>{g.title}<span>{g.rows.length}</span></h2>
            <div className={`ph-tiles ${phone && g.rows.length <= 2 ? `n${g.rows.length}` : ''}`}>
              {g.rows.map((r) => (
                <a key={r.id} className="ph-tile" href={savePath(save.id, `photos/${r.id}`)} onClick={() => openFrom(save.id, groups.flatMap((x) => x.rows))} aria-label={r.p.caption || album.dates(r.p).main || 'Photo'}>
                  <PhotoBox photo={r.p.photo} aspect={wide ? 16 / 9 : 1} size={wide ? 'full' : 'thumb'} />
                  {r.p.caption && <span className="ph-tile-cap">{r.p.caption}</span>}
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );

  if (phone) {
    return (
      <div className="m-stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="m-h1" style={{ paddingTop: 6 }}>Photos</h1>
          {album.rows.length > 0 && add}
        </div>
        {body}
        {filterUi}
        {adder.ui}
      </div>
    );
  }
  return (
    <div className="page stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 14 }}>
          <ObjIcon cat="photos" size="lg" />
          <div><h1>Photos</h1><div className="sub">{album.rows.length ? plural(album.rows.length, 'photo') : 'Your screenshots, with their Sims and dates'}</div></div>
        </div>
        {album.rows.length > 0 && add}
      </div>
      {body}
      {filterUi}
      {adder.ui}
    </div>
  );
}

// ---------- the filter sheet ----------
type FilterView = 'main' | 'sims' | 'when' | 'occasion' | 'club';
type FilterProps = {
  album: Album; f: AlbumFilter; setF: (f: AlbumFilter) => void; mode: SortMode; setSort: (m: SortMode) => void; track: boolean; phone: boolean; count: number;
  simOptions: { id: string; label: string; count: number }[];
  occasionOptions: { id: string; label: string; when: string; count: number }[];
  clubOptions: { id: string; label: string; count: number }[]; clubsOn: boolean;
  onClose(): void; onClear(): void;
};

/**
 * The Filter sheet (a bottom sheet on phones, a window on desktop). The main screen is plain rows: tap Sims, When or Occasion
 * to swap to its own list (or the calendar for When), and back arrow returns. Sort is a two-way switch.
 */
function FilterSheet({ album, f, setF, mode, setSort, track, phone, count, simOptions, occasionOptions, clubOptions, clubsOn, onClose, onClear }: FilterProps) {
  const [view, setView] = useState<FilterView>('main');
  const [q, setQ] = useState('');
  const cal = album.cal;
  const open = (v: FilterView) => { setQ(''); setView(v); };
  const ranged = track && hasRange(f);
  const simText = f.simIds.map((id) => album.nameOf(id)).join(', ');
  const whenText = ranged && cal ? rangeText(f.from, f.to, cal) : '';
  const occText = f.occasion ? occasionOptions.find((o) => o.id === f.occasion)?.label ?? '' : '';
  const clubText = f.club ? album.clubName(f.club) || 'A removed club' : '';
  const showClub = clubsOn && (clubOptions.length > 0 || !!f.club);
  const today = cal && album.info.today !== null ? dateOf(album.info.today, cal) : null;

  const row = (label: string, text: string, v: FilterView, action?: string) => (
    <div className="ph-fgroup">
      <div className="ph-lbl">{label}</div>
      <button type="button" className="ph-fld" aria-label={`${label}: ${text || 'Any'}. Change`} onClick={() => open(v)}>
        <span className={text ? '' : 'ph-fld-empty'}>{text || 'Any'}</span>{action && <small>{action}</small>}
      </button>
    </div>
  );

  const main = (
    <div className="ph-fs">
      {row('Sims', simText, 'sims', 'Change')}
      {track && row('When', whenText, 'when')}
      {row('Occasion', occText, 'occasion')}
      {showClub && row('Club', clubText, 'club')}
      {track && (
        <div className="ph-fgroup">
          <div className="ph-lbl">Sort by</div>
          <div className="ph-seg" role="group" aria-label="Sort by">
            {([['game', 'Game date'], ['added', 'Date added']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={mode === v} onClick={() => setSort(v)}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const search = (placeholder: string) => (
    <div className="ph-pk-search"><SearchBox value={q} onChange={setQ} placeholder={placeholder} /></div>
  );
  const has = (label: string) => !q.trim() || normalize(label).includes(normalize(q.trim()));

  const simsView = (() => {
    const list = simOptions.filter((o) => has(o.label));
    const chosen = list.filter((o) => f.simIds.includes(o.id));
    const others = list.filter((o) => !f.simIds.includes(o.id));
    const toggle = (id: string) => setF({ ...f, simIds: f.simIds.includes(id) ? f.simIds.filter((x) => x !== id) : [...f.simIds, id] });
    const line = (o: (typeof list)[number]) => {
      const on = f.simIds.includes(o.id);
      return (
        <button key={o.id} type="button" role="checkbox" aria-checked={on} aria-label={o.label} className="ph-pk-sim" onClick={() => toggle(o.id)}>
          <span className={`ph-cb ${on ? 'on' : ''}`} aria-hidden="true" />
          <SimAvatar sim={album.sims.get(o.id)!} size={30} />
          <span className="ph-pk-t">{o.label}</span><span className="ph-pk-n">{o.count}</span>
        </button>
      );
    };
    return (
      <div className="ph-pk">
        {search('Search Sims')}
        <div className="ph-pk-list">
          {chosen.length > 0 && <div className="ph-lbl">Selected</div>}
          {chosen.map(line)}
          {others.length > 0 && <div className="ph-lbl">Everyone</div>}
          {others.map(line)}
          {list.length === 0 && <p className="muted ph-pk-none">{simOptions.length ? `No Sim called “${q.trim()}”.` : 'No Sims are tagged in photos yet.'}</p>}
        </div>
      </div>
    );
  })();

  const occasionView = (() => {
    const list = occasionOptions.filter((o) => has(o.label));
    const line = (id: string | null, label: string, sub: string, n: number | null) => {
      const on = (f.occasion ?? null) === id;
      return (
        <button key={id ?? 'any'} type="button" role="option" aria-selected={on} className="ph-pk-opt" onClick={() => { setF({ ...f, occasion: id }); open('main'); }}>
          <span className="ph-pk-ot"><span className="ph-pk-t">{label}</span>{sub && <span className="ph-pk-sub">{sub}</span>}</span>
          {n !== null && <span className="ph-pk-n">{plural(n, 'photo')}</span>}
          <span className="ph-pk-tick" aria-hidden="true">{on && <Check size={18} weight="bold" />}</span>
        </button>
      );
    };
    return (
      <div className="ph-pk">
        {search('Search occasions')}
        <div className="ph-pk-list" role="listbox" aria-label="Occasion">
          {!q.trim() && line(null, 'Any', '', null)}
          {list.map((o) => line(o.id, o.label, o.when, o.count))}
          {list.length === 0 && <p className="muted ph-pk-none">{occasionOptions.length ? `Nothing called “${q.trim()}”.` : 'No photos belong to an occasion yet.'}</p>}
        </div>
      </div>
    );
  })();

  const whenView = cal ? (
    <div className="ph-pk">
      <RangePanel key="range" from={ranged ? dateOf(f.from!, cal) : null} to={ranged ? dateOf(f.to!, cal) : null} start={today ?? dateOf(0, cal)}
        today={today} seasonLength={cal.seasonLength} hint="Tap the first day, then the last. Same day for one day."
        onPick={(a: SimDate, b: SimDate) => { setF({ ...f, from: dayOf(a, cal), to: dayOf(b, cal) }); open('main'); }} />
    </div>
  ) : null;

  const clubView = (
    <div className="ph-pk">
      {search('Search clubs')}
      <div className="ph-pk-list" role="listbox" aria-label="Club">
        {!q.trim() && (
          <button type="button" role="option" aria-selected={f.club === null} className="ph-pk-opt" onClick={() => { setF({ ...f, club: null }); open('main'); }}>
            <span className="ph-pk-ot"><span className="ph-pk-t">Any</span></span><span className="ph-pk-tick" aria-hidden="true">{f.club === null && <Check size={18} weight="bold" />}</span>
          </button>
        )}
        {clubOptions.filter((c) => has(c.label)).map((c) => (
          <button key={c.id} type="button" role="option" aria-selected={f.club === c.id} className="ph-pk-opt" onClick={() => { setF({ ...f, club: c.id }); open('main'); }}>
            <span className="ph-pk-ot"><span className="ph-pk-t">{c.label}</span></span><span className="ph-pk-n">{plural(c.count, 'photo')}</span>
            <span className="ph-pk-tick" aria-hidden="true">{f.club === c.id && <Check size={18} weight="bold" />}</span>
          </button>
        ))}
        {!clubOptions.some((c) => has(c.label)) && <p className="muted ph-pk-none">{clubOptions.length ? `No club called “${q.trim()}”.` : 'No photos are tagged with a club yet.'}</p>}
      </div>
    </div>
  );

  const subTitle = (text: string, extra?: React.ReactNode) => (
    <span className="ph-ft">
      <button type="button" className="ph-ft-back" aria-label="Back to Filter" onClick={() => open('main')}><CaretLeft size={22} weight="bold" /></button>
      <span>{text}</span>{extra}
    </span>
  );
  const title = view === 'main' ? 'Filter'
    : view === 'sims' ? subTitle('Sims')
      : view === 'occasion' ? subTitle('Occasion')
        : view === 'club' ? subTitle('Club')
        : subTitle('When', ranged ? <button type="button" className="ph-ft-clear" onClick={() => setF({ ...f, from: null, to: null })}>Clear dates</button> : undefined);
  const body = view === 'main' ? main : view === 'sims' ? simsView : view === 'occasion' ? occasionView : view === 'club' ? clubView : whenView;
  const show = `Show ${plural(count, 'photo')}`;

  if (phone) {
    return (
      <Sheet title={title} onClose={onClose}>
        {body}
        <div className="stack" style={{ gap: 4, marginTop: 14 }}>
          <button type="button" className="ph-show" onClick={onClose}>{show}</button>
          {view === 'main' && <button type="button" className="btn ghost" onClick={onClear}>Clear all</button>}
        </div>
      </Sheet>
    );
  }
  return (
    <Modal title={title} onClose={onClose} autoFocus={false} className="ph-modal"
      footer={<><button type="button" className="btn ghost" onClick={onClear}>Clear all</button><span className="grow" /><button type="button" className="btn primary" onClick={onClose}>{show}</button></>}>
      {body}
    </Modal>
  );
}

function PhotoPage({ save, photoId }: { save: SaveRow; photoId: string }) {
  const album = useAlbum(save);
  const holidays = useRecords('holiday');
  const events = useRecords('event');
  const trips = useRecords('vacation');
  const [editing, setEditing] = useState(false);
  const touch = useRef<number | null>(null);
  const back = savePath(save.id, 'photos');
  const list = useMemo(() => {
    if (viewList?.saveId === save.id && viewList.ids.includes(photoId)) {
      const byId = new Map(album.rows.map((r) => [r.id, r]));
      const rows = viewList.ids.map((id) => byId.get(id)).filter((r): r is PhotoRow => !!r);
      if (rows.some((r) => r.id === photoId)) return rows;
    }
    return album.rows;
  }, [album.rows, save.id, photoId]);
  const at = list.findIndex((r) => r.id === photoId);
  const row = list[at];
  const prev = at > 0 ? list[at - 1] : null;
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : null;
  const step = (r: PhotoRow | null) => { if (r) go(savePath(save.id, `photos/${r.id}`), { replace: true }); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (editing || (e.target as HTMLElement)?.closest?.('input, textarea, [role="dialog"], [role="alertdialog"]')) return;
      if (e.key === 'ArrowLeft') step(prev);
      if (e.key === 'ArrowRight') step(next);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  if (!row) return <div className="page"><p>That photo isn’t here anymore.</p><a className="btn" href={back}>Back to Photos</a></div>;
  const { p } = row;
  const d = album.dates(p);
  const item = p.item;
  const itemName = item ? (item.kind === 'birthday' ? `${album.nameOf(item.id)}’s birthday`
    : String((({ holiday: holidays, event: events, vacation: trips })[item.kind].find((r) => r.id === item.id)?.data as { name?: string } | undefined)?.name || 'a calendar item')) : '';
  const ratio = p.photo.w / p.photo.h;
  const sims = p.simIds.filter((id) => album.sims.has(id));

  return (
    <div className="ph-page">
      <div className="ph-bar">
        <a className="ph-back" href={back}><CaretLeft size={18} weight="bold" /> Photos</a>
        <span className="ph-pos">{at + 1} of {list.length}</span>
        <button type="button" className="btn sm" onClick={() => setEditing(true)}><PencilSimple size={15} /> Edit</button>
      </div>
      <div className="ph-stage"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 60) step(dx > 0 ? prev : next); }}>
        <div className="ph-full" style={{ maxWidth: `min(100%, calc(70vh * ${ratio}))` }}>
          <PhotoBox photo={p.photo} aspect={ratio} alt={p.caption || 'Photo'} />
        </div>
        {prev && <button type="button" className="ph-nav prev" aria-label="Previous photo" onClick={() => step(prev)}><CaretLeft size={20} weight="bold" /></button>}
        {next && <button type="button" className="ph-nav next" aria-label="Next photo" onClick={() => step(next)}><CaretRight size={20} weight="bold" /></button>}
      </div>
      <div className="ph-info">
        {p.caption && <h1 className="ph-title">{p.caption}</h1>}
        <div className="ph-when">{p.caption ? <b>{d.main}</b> : <h1 className="ph-title">{d.main}</h1>}{d.sub && <span>{d.sub}</span>}</div>
        {sims.length > 0 && (
          <div className="ph-with">
            {sims.map((id) => (
              <a key={id} className="ph-who" href={savePath(save.id, `sims/${id}`)}><SimAvatar sim={album.sims.get(id)!} size={26} />{album.nameOf(id)}</a>
            ))}
          </div>
        )}
        {item && <a className="ph-from" href={savePath(save.id, `calendar/${item.kind}/${item.id}`)}>From {itemName}</a>}
        {p.legacyId && album.legacyName(p.legacyId) && <a className="ph-from" href={savePath(save.id, `legacy/${p.legacyId}${p.genId ? `/${p.genId}` : ''}`)}>Legacy: {album.legacyName(p.legacyId)}{p.genId && album.genName(p.genId) ? ` · ${album.genName(p.genId)}` : ''}</a>}
        {p.clubId && album.clubName(p.clubId) && <a className="ph-from" href={savePath(save.id, `clubs/${p.clubId}`)}>Club: {album.clubName(p.clubId)}</a>}
      </div>
      {editing && <PhotoForm save={save} existing={row} onClose={() => setEditing(false)} />}
    </div>
  );
}
