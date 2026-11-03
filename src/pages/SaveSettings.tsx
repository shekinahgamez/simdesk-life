import { useMemo, useState } from 'react';
import { CalendarBlank, GearSix, LockKey, Package, PuzzlePiece, Trash } from '@phosphor-icons/react';
import { BackLink, MRow } from '../components/Shell';
import { ObjIcon, type CategoryId } from '../components/categories';
import { DateFields, LifespanEditor, MODULES, NewFromPacks, PackPicker, SeasonLengthPicker, Swatches } from '../components/savebits';
import { DeleteSaveDialog, TrashList } from '../components/sync';
import { Field, Modal, toast, Toggle } from '../components/ui';
import { available, BY_ID, GAME } from '../data/game';
import { go, savePath } from '../lib/router';
import { DEFAULT_NAME, lifespanLabel, ownedOf, saveData, seasonLengthLabel, tableOf, todayOf, type SaveData } from '../lib/saves';
import { useStore, useStoreVersion, useTrash } from '../lib/sync/react';
import type { Rec, SaveRow } from '../lib/sync/types';
import { plural } from '../lib/text';
import { changeSeasonLength, formatDate, rescaleBornDay, stageTable, type Lifespan, type SeasonLength, type SimDate } from '../lib/time';
import { useIsPhone } from '../lib/useIsPhone';

const KIND_CAT: Record<string, CategoryId> = { sim: 'sims', household: 'households', lot: 'worlds', world: 'worlds', holiday: 'calendar', event: 'calendar', club: 'clubs' };
const recName = (r: Rec) => {
  const d = r.data as Record<string, unknown>;
  const n = String(d.name ?? `${d.first ?? ''} ${d.last ?? ''}`).trim();
  return n || 'Untitled';
};

export function SaveSettings({ save }: { save: SaveRow }) {
  const store = useStore();
  useStoreVersion();
  const phone = useIsPhone();
  const d = saveData(save);
  const update = (patch: Partial<SaveData>) => store.updateSave(save.id, patch);
  const trash = useTrash();

  const [nameText, setNameText] = useState<string | null>(null);
  const [setDate, setSetDate] = useState<SimDate | null>(null);
  const [packsBefore, setPacksBefore] = useState<string[] | null>(null);
  const [newPacks, setNewPacks] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [sheet, setSheet] = useState<null | 'season' | 'life' | 'name' | 'trash'>(null);

  const secretOn = useMemo(() => new Set(d.secretLots), [d.secretLots]);
  const secretLots = useMemo(() => available(ownedOf(d)).secretLots
    .map((l) => ({ ...l, worldName: BY_ID.worlds.get(l.world)?.name ?? '' }))
    .sort((a, b) => a.worldName.localeCompare(b.worldName) || a.name.localeCompare(b.name)), [d]);
  const allSecretOn = secretLots.length > 0 && secretLots.every((l) => secretOn.has(l.id));
  const setSecret = (id: string, on: boolean) => {
    const n = new Set(secretOn);
    if (on) n.add(id); else n.delete(id);
    update({ secretLots: [...n] });
  };
  const setAllSecret = (on: boolean) => {
    const ids = new Set(secretLots.map((l) => l.id));
    update({ secretLots: on ? [...new Set([...secretOn, ...ids])] : [...secretOn].filter((id) => !ids.has(id)) });
  };

  // Name: typing never saves a blank name; leaving it blank puts the old one back.
  const nameValue = nameText ?? d.name;
  const onName = (v: string) => { setNameText(v); if (v.trim()) update({ name: v.trim() }); };
  const onNameDone = () => setNameText(null);

  const setLength = (len: SeasonLength) => update({ calendar: changeSeasonLength(d.calendar, d.today, len) });
  const setLifespan = (l: Lifespan) => {
    // Everyone stays in their life stage, the same share of the way through it (like the game).
    const from = tableOf(d);
    const to = stageTable(l);
    store.updateAll('sim', (data) => (typeof data.bornDay === 'number' ? { ...data, bornDay: rescaleBornDay(data.bornDay, d.today, from, to) } : null));
    update({ lifespan: l, ...(l.preset === 'custom' ? { customDays: l.days } : {}) });
  };
  const openPacks = () => setPacksBefore(d.packs);
  const closePacks = () => {
    const before = packsBefore ?? [];
    const added = d.packs.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !d.packs.includes(p));
    setPacksBefore(null);
    if (added.length) setNewPacks(added);
    if (removed.length) toast(`Anything your Sims already have from ${removed.map((p) => BY_ID.packs.get(p)?.name ?? p).join(', ')} stays put.`);
  };
  const confirmSetDate = () => {
    if (!setDate) return;
    // Fixes the date shown for today. Ages don't change (Jump ahead is for moving forward).
    update({ calendar: { seasonLength: d.calendar.seasonLength, anchorDay: d.today, anchorDate: { ...setDate, day: Math.min(setDate.day, d.calendar.seasonLength) } } });
    setSetDate(null);
    toast('Date set');
  };
  const afterDelete = () => {
    const next = store.activeSaves().find((s) => s.id !== save.id);
    go(next ? savePath(next.id) : '#/setup');
  };

  const packNames = GAME.packs.filter((p) => d.packs.includes(p.id)).map((p) => p.name);
  const packSummary = `Base Game + ${plural(d.packs.length, 'pack')}.${packNames.length ? ` ${packNames.slice(0, 6).join(', ')}${packNames.length > 6 ? '…' : ''}` : ''}`;
  const lifeHint = 'Everyone stays in their life stage, the same share of the way through it.';
  const lengthHint = 'Every Sim keeps their age. Only dates move.';
  const secretHelp = 'Hidden spots like Sylvan Glade and Sixam. Turn on the ones your story uses and they’ll show up in their world’s lot list.';
  const describe = (r: Rec) => ({ name: recName(r), icon: <ObjIcon cat={KIND_CAT[r.kind] ?? 'sims'} /> });

  const modals = (
    <>
      {setDate && (
        <Modal title="Set today’s date" onClose={() => setSetDate(null)}
          footer={<><button type="button" className="btn" onClick={() => setSetDate(null)}>Cancel</button><button type="button" className="btn primary" onClick={confirmSetDate}>Set date</button></>}>
          <p className="small muted" style={{ marginTop: 0 }}>For fixing the date. Moving forward? Jump ahead shows you what happened along the way.</p>
          <DateFields value={setDate} onChange={setSetDate} seasonLength={d.calendar.seasonLength} />
          <p className="tiny muted">{formatDate(setDate)}</p>
        </Modal>
      )}
      {packsBefore && (
        <Modal wide title="Your packs" onClose={closePacks} footer={<button type="button" className="btn primary" onClick={closePacks}>Done</button>}>
          <PackPicker value={d.packs} onChange={(packs) => update({ packs })} phone={phone} />
        </Modal>
      )}
      {newPacks.length > 0 && (
        <NewFromPacks saveId={save.id} packIds={newPacks} secretOn={secretOn} onClose={() => setNewPacks([])}
          onTurnOnSecret={(ids) => update({ secretLots: [...new Set([...secretOn, ...ids])] })} />
      )}
      {deleting && <DeleteSaveDialog save={save} onClose={() => setDeleting(false)} onDeleted={afterDelete} />}
    </>
  );

  if (phone) {
    const t = todayOf(d);
    return (
      <div className="m-stack">
        <BackLink href={savePath(save.id, 'more')} label="More" />
        <h1 className="m-h1">Save settings</h1>
        <div className="m-label">Time</div>
        <div className="m-group">
          <MRow title="Track today’s date" chevron={false} right={<Toggle on={d.trackDate} onChange={(trackDate) => update({ trackDate })} label="Track today’s date" />} />
          {d.trackDate && <MRow title="Today" value={`Y${t.year} · ${formatDate(t, 'short')}`} onClick={() => setSetDate(t)} />}
          <MRow title="Season length" value={seasonLengthLabel(d.calendar.seasonLength)} onClick={() => setSheet('season')} />
          <MRow title="Lifespan" value={lifespanLabel(d.lifespan)} onClick={() => setSheet('life')} />
        </div>
        <div className="m-help">{d.trackDate ? 'Powers ages, countdowns, birthdays, holidays, rotation and Jump ahead.' : 'Countdowns and Jump ahead are hidden. Age Sims up by hand from their profile.'}</div>
        <div className="m-label">Modules</div>
        <div className="m-group">
          {MODULES.map((m) => (
            <MRow key={m.id} title={m.label} sub={m.ready ? undefined : m.desc} chevron={false}
              right={m.ready ? <Toggle on={!!d.modules[m.id]} onChange={(on) => update({ modules: { ...d.modules, [m.id]: on } })} label={m.label} /> : <span className="tag outline" style={{ whiteSpace: 'nowrap' }}>Coming soon</span>} />
          ))}
        </div>
        <div className="m-help">Turning one off hides it without deleting anything. The rest are on the way.</div>
        {secretLots.length > 0 && (
          <>
            <div className="m-label">Secret lots</div>
            <div className="m-group">
              <MRow title="All secret lots" chevron={false} right={<Toggle on={allSecretOn} onChange={setAllSecret} label="All secret lots" />} />
              {secretLots.map((l) => <MRow key={l.id} title={l.name} sub={l.worldName} chevron={false} right={<Toggle on={secretOn.has(l.id)} onChange={(on) => setSecret(l.id, on)} label={l.name} />} />)}
            </div>
            <div className="m-help">{secretHelp}</div>
          </>
        )}
        <div className="m-label">Save</div>
        <div className="m-group">
          <MRow title="Name and color" value={d.name} onClick={() => setSheet('name')} />
          <MRow title="Packs" value={d.packs.length} onClick={openPacks} />
          <MRow title="Trash" value={trash.length || undefined} onClick={() => setSheet('trash')} />
          <MRow title="Delete this save" danger chevron={false} onClick={() => setDeleting(true)} />
        </div>
        {sheet === 'season' && (
          <Modal title="Season length" onClose={() => setSheet(null)} footer={<button type="button" className="btn primary" onClick={() => setSheet(null)}>Done</button>}>
            <SeasonLengthPicker value={d.calendar.seasonLength} onChange={setLength} />
            <p className="hint">{lengthHint}</p>
          </Modal>
        )}
        {sheet === 'life' && (
          <Modal title="Lifespan" onClose={() => setSheet(null)} footer={<button type="button" className="btn primary" onClick={() => setSheet(null)}>Done</button>}>
            <LifespanEditor value={d.lifespan} onChange={setLifespan} customDays={d.customDays} />
            <p className="hint">{lifeHint}</p>
          </Modal>
        )}
        {sheet === 'name' && (
          <Modal title="Name and color" onClose={() => { onNameDone(); setSheet(null); }} footer={<button type="button" className="btn primary" onClick={() => { onNameDone(); setSheet(null); }}>Done</button>}>
            <div className="stack" style={{ gap: 16 }}>
              <Field label="Save name">{(id) => <input id={id} className="input" value={nameValue} placeholder={DEFAULT_NAME} maxLength={60} onChange={(e) => onName(e.target.value)} onBlur={onNameDone} />}</Field>
              <div className="field"><span className="label">Save color</span><Swatches value={d.color} onChange={(color) => update({ color })} /></div>
            </div>
          </Modal>
        )}
        {sheet === 'trash' && (
          <Modal title="Trash" onClose={() => setSheet(null)} footer={<button type="button" className="btn primary" onClick={() => setSheet(null)}>Done</button>}>
            <TrashList items={trash} describe={describe} />
          </Modal>
        )}
        {modals}
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head"><div><h1>Save settings</h1><div className="sub">{d.name}</div></div></div>

      <section className="card">
        <div className="card-head"><h2><span className="obj berry"><GearSix size={16} weight="duotone" /></span> The basics</h2></div>
        <div className="stack" style={{ gap: 16 }}>
          <Field label="Save name">{(id) => <input id={id} className="input" value={nameValue} placeholder={DEFAULT_NAME} maxLength={60} onChange={(e) => onName(e.target.value)} onBlur={onNameDone} />}</Field>
          <div className="field"><span className="label">Save color</span><Swatches value={d.color} onChange={(color) => update({ color })} size={36} /></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2><span className="obj calendar"><CalendarBlank size={16} weight="duotone" /></span> Time</h2></div>
        <div className="switch-row">
          <div className="grow"><div className="bold">Track today’s date</div><div className="small muted">Keep SimDesk in step with your game’s calendar. Turn it off if logging the day feels like homework.</div></div>
          <Toggle on={d.trackDate} onChange={(trackDate) => update({ trackDate })} label="Track today’s date" />
        </div>
        {!d.trackDate ? (
          <div className="small" style={{ background: 'var(--field)', borderRadius: 12, padding: '12px 14px', lineHeight: 1.5 }}>
            Countdowns, today markers and Jump ahead are hidden. Age Sims up by hand from their profile, and birthdays and holidays still show on the calendar.
          </div>
        ) : (
          <div className="switch-row" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="grow"><div className="bold">Today in your save</div><div className="small muted">{formatDate(todayOf(d))}</div></div>
            <button type="button" className="btn sm" onClick={() => setSetDate(todayOf(d))}>Set date</button>
          </div>
        )}
        <div className="divider" />
        <div className="field"><span className="label">Season length</span>
          <SeasonLengthPicker value={d.calendar.seasonLength} onChange={setLength} />
          <span className="hint">{lengthHint}</span></div>
        <div className="divider" />
        <div className="field"><span className="label">Lifespan</span>
          <LifespanEditor value={d.lifespan} onChange={setLifespan} customDays={d.customDays} />
          <span className="hint">{lifeHint}</span></div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2><span className="obj households"><Package size={16} weight="duotone" /></span> Packs</h2>
          <button type="button" className="btn sm" onClick={openPacks}>Change packs</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{packSummary}</p>
      </section>

      <section className="card">
        <div className="card-head"><h2><span className="obj storylines"><PuzzlePiece size={16} weight="duotone" /></span> Modules</h2></div>
        <div className="small muted" style={{ marginBottom: 6 }}>Turn on only what you track. Turning one off hides it without deleting anything. The grey ones are on the way.</div>
        {MODULES.map((m) => (
          <div key={m.id} className="switch-row">
            <div className="grow">
              <div style={{ fontWeight: 600, color: m.ready ? undefined : 'var(--muted)' }}>{m.label}</div>
              <div className="small muted" style={{ marginTop: 2 }}>{m.desc}</div>
            </div>
            {m.ready ? <Toggle on={!!d.modules[m.id]} onChange={(on) => update({ modules: { ...d.modules, [m.id]: on } })} label={m.label} /> : <span className="tag outline" style={{ whiteSpace: 'nowrap' }}>Coming soon</span>}
          </div>
        ))}
      </section>

      {secretLots.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2><span className="obj worlds"><LockKey size={16} weight="duotone" /></span> Secret lots</h2>
            <button type="button" className="btn sm" onClick={() => setAllSecret(!allSecretOn)}>{allSecretOn ? 'Turn all off' : 'Turn all on'}</button>
          </div>
          <div className="small muted" style={{ marginBottom: 6 }}>{secretHelp}</div>
          {secretLots.map((l) => (
            <div key={l.id} className="switch-row">
              <div className="grow"><div style={{ fontWeight: 600 }}>{l.name}</div><div className="small muted" style={{ marginTop: 2 }}>{l.worldName}</div></div>
              <Toggle on={secretOn.has(l.id)} onChange={(on) => setSecret(l.id, on)} label={l.name} />
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2><span className="obj berry"><Trash size={16} weight="duotone" /></span> Trash</h2></div>
        <TrashList items={trash} describe={describe} />
      </section>

      <section className="card" style={{ borderColor: 'color-mix(in srgb, var(--danger) 30%, var(--line))' }}>
        <div className="card-head"><h2>Delete this save</h2></div>
        <p className="small muted" style={{ marginTop: 0 }}>Moves {d.name} and everything in it to Trash for 7 days, then it’s gone for good.</p>
        <div><button type="button" className="btn danger" onClick={() => setDeleting(true)}><Trash size={16} /> Delete save</button></div>
      </section>
      {modals}
    </div>
  );
}

