import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Confetti, Ghost, Hourglass, LockKey, MapPin, Package, SmileyWink, Target, type Icon } from '@phosphor-icons/react';
import { GAME, PACK_TYPES } from '../data/game';
import { PACK_ICON } from '../data/packIcons';
import { MODULES, packContents, SAVE_COLORS, seasonLengthLabel, type ModuleDef } from '../lib/saves';
import { savePath } from '../lib/router';
import { matches, plural } from '../lib/text';
import {
  SEASON_LENGTHS, STAGE_IDS, stageName, stageTable, type Lifespan, type SeasonLength, type SimDate, type StageId,
} from '../lib/time';
import { DateField } from './SeasonPicker';
import { Modal, NoMatches, SearchBox, Seg, Stepper } from './ui';

// ---------- save color ----------
export function Swatches({ value, onChange, size = 40 }: { value: string; onChange(hex: string): void; size?: number }) {
  return (
    <div className="swatches" role="group" aria-label="Save color">
      {SAVE_COLORS.map((c) => (
        <button key={c.hex} type="button" className="swatch" aria-pressed={value === c.hex} aria-label={c.label}
          style={{ background: c.hex, width: size, height: size }} onClick={() => onChange(c.hex)} />
      ))}
    </div>
  );
}

// ---------- packs ----------
/** Icon color for each pack type. Uses colors the app already has, so each tab is one color. */
const PACK_INK: Record<string, string> = { expansion: 'var(--sims-ink)', game: 'var(--calendar-ink)', stuff: 'var(--households-ink)', kit: 'var(--storylines-ink)', free: 'var(--worlds-ink)' };
function PackTileIcon({ id, type, size }: { id: string; type: string; size: number }) {
  const I = PACK_ICON[id] ?? Package;
  return <span className="pk-ic" style={{ color: PACK_INK[type] ?? 'var(--muted)' }} aria-hidden="true"><I size={size} weight="duotone" /></span>;
}
const PACK_GROUPS = PACK_TYPES.map((t) => ({ ...t, packs: GAME.packs.filter((p) => p.type === t.type) })).filter((g) => g.packs.length > 0);
const ALL_PACKS = GAME.packs.filter((p) => p.type !== 'base');

/** The one pack picker, used by setup and Save settings. `phone` uses the tall phone tiles. */
export function PackPicker({ value, onChange, phone = false }: { value: string[]; onChange(v: string[]): void; phone?: boolean }) {
  const [tab, setTab] = useState(PACK_GROUPS[0]?.type ?? 'expansion');
  const [q, setQ] = useState('');
  const set = new Set(value);
  const group = PACK_GROUPS.find((g) => g.type === tab) ?? PACK_GROUPS[0];
  const shown = q.trim() ? ALL_PACKS.filter((p) => matches(p.name, q)) : group.packs;
  const allOn = group.packs.every((p) => set.has(p.id));
  const toggle = (id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); onChange([...n]); };
  const selectAll = () => {
    const n = new Set(set);
    for (const p of group.packs) { if (allOn) n.delete(p.id); else n.add(p.id); }
    onChange([...n]);
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <SearchBox value={q} onChange={setQ} placeholder="Search all packs" />
      {!q.trim() && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className={phone ? 'm-chips' : 'seg'} role="group" aria-label="Pack types">
            {PACK_GROUPS.map((g) => (
              <button key={g.type} type="button" aria-pressed={g.type === group.type} onClick={() => setTab(g.type)}
                style={phone && g.type === group.type ? { background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'var(--accent)' } : undefined}>
                {g.label}{phone ? ` ${g.packs.filter((p) => set.has(p.id)).length}/${g.packs.length}` : ''}
              </button>
            ))}
          </div>
          <button type="button" className={phone ? 'btn ghost sm' : 'btn sm'} style={phone ? { color: 'var(--accent)', marginLeft: 'auto' } : undefined} onClick={selectAll}>
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        </div>
      )}
      {shown.length === 0 ? <NoMatches query={q} /> : phone ? (
        <div className="ms-packs" role="group" aria-label="Packs">
          {shown.map((p) => (
            <button key={p.id} type="button" className="ms-pk" aria-pressed={set.has(p.id)} onClick={() => toggle(p.id)}>
              <PackTileIcon id={p.id} type={p.type} size={28} />
              <span className="nm">{p.name}</span>
              <span className="ok" aria-hidden="true"><Check size={13} weight="bold" /></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="packs" role="group" aria-label="Packs">
          {shown.map((p) => (
            <button key={p.id} type="button" className="pk" aria-pressed={set.has(p.id)} onClick={() => toggle(p.id)}>
              <PackTileIcon id={p.id} type={p.type} size={24} />
              <span className="nm">{p.name}</span>
              <span className="badge" aria-hidden="true"><Check size={13} weight="bold" /></span>
            </button>
          ))}
        </div>
      )}
      {!phone && <div className="tiny muted" aria-live="polite">{plural(value.length, 'pack')} selected</div>}
    </div>
  );
}

// ---------- "New from <pack>" ----------
const preview = (names: string[], max = 4) => (names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} +${names.length - max} more`);

function NewItem({ tone, icon: I, title, children }: { tone: string; icon: Icon; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
      <span className={`obj ${tone}`} aria-hidden="true"><I size={16} weight="duotone" /></span>
      <div className="grow" style={{ minWidth: 0, paddingTop: 4 }}>
        <div className={`new-item-title ${tone}`}>{title}</div>
        {children}
      </div>
    </div>
  );
}

/** What just-added packs bring to the save. Shown after the packs pop-up closes. */
export function NewFromPacks({ saveId, packIds, secretOn, onTurnOnSecret, onClose }: {
  saveId: string; packIds: string[]; secretOn: ReadonlySet<string>; onTurnOnSecret(ids: string[]): void; onClose(): void;
}) {
  const list = packIds.map(packContents);
  return (
    <Modal title={list.length === 1 ? `New from ${list[0].name}` : 'New in your save'} onClose={onClose}
      footer={<button type="button" className="btn primary" onClick={onClose}>Got it</button>}>
      <div className="stack" style={{ gap: 22 }}>
        {list.map((s) => {
          const empty = !s.worlds.length && !s.occults.length && !s.traits.length && !s.aspirations.length && !s.traditions.length && !s.secretLots.length;
          return (
            <div key={s.id} className="stack" style={{ gap: 14 }}>
              {list.length > 1 && <div className="bold" style={{ fontFamily: 'var(--font-head)', fontSize: 17 }}>New from {s.name}</div>}
              {empty && <div className="muted">Nothing new to track from this one. It’s marked as owned.</div>}
              {s.worlds.length > 0 && (
                <NewItem tone="worlds" icon={MapPin} title={plural(s.worlds.length, 'world')}>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    {s.worlds.map((w) => (
                      <a key={w.id} className="world-chip" href={savePath(saveId, `worlds/${w.id}`)} onClick={onClose}>
                        <MapPin size={15} weight="duotone" /> {w.name} <ArrowRight size={13} weight="bold" />
                      </a>
                    ))}
                  </div>
                </NewItem>
              )}
              {s.occults.length > 0 && <NewItem tone="storylines" icon={Ghost} title={plural(s.occults.length, 'occult type')}><div className="small muted">{preview(s.occults.map((o) => o.name))}</div></NewItem>}
              {s.traits.length > 0 && <NewItem tone="sims" icon={SmileyWink} title={plural(s.traits.length, 'trait')}><div className="small muted">{preview(s.traits.map((t) => t.name))}</div></NewItem>}
              {s.aspirations.length > 0 && <NewItem tone="households" icon={Target} title={plural(s.aspirations.length, 'aspiration')}><div className="small muted">{preview(s.aspirations.map((a) => a.name))}</div></NewItem>}
              {s.traditions.length > 0 && <NewItem tone="calendar" icon={Confetti} title={plural(s.traditions.length, 'holiday tradition')}><div className="small muted">{preview(s.traditions.map((t) => t.name), 3)}</div></NewItem>}
              {s.secretLots.length > 0 && (
                <NewItem tone="clubs" icon={LockKey} title={`${plural(s.secretLots.length, 'secret lot')} you can turn on`}>
                  <div className="row" style={{ gap: 10, marginTop: 2, flexWrap: 'nowrap', alignItems: 'center' }}>
                    <div className="small muted grow">{preview(s.secretLots.map((l) => l.name))}</div>
                    {s.secretLots.every((l) => secretOn.has(l.id))
                      ? <span className="small bold" style={{ color: 'var(--clubs-ink)' }}>On</span>
                      : <button type="button" className="btn sm" onClick={() => onTurnOnSecret(s.secretLots.map((l) => l.id))}>Turn on</button>}
                  </div>
                </NewItem>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------- modules ----------
/** Setup's module card: grey when off, spins round into its color when on. Not-ready ones shake "nope". */
export function ModuleCard({ m, on, onToggle }: { m: ModuleDef; on: boolean; onToggle(): void }) {
  const [nope, setNope] = useState(false);
  const I = m.icon;
  const body = (tag: ReactNode) => (
    <>
      <span className="mc-ic"><I size={20} weight="duotone" /></span>
      <span className="mc-t">{m.label}</span>
      <span className="mc-d">{m.desc}</span>
      <span className="mc-tag">{tag}</span>
    </>
  );
  return (
    <div className={`flipwrap ${m.ready ? '' : 'soon'}`}>
      <button type="button" className={`flipper ${nope ? 'nope' : ''}`} aria-pressed={m.ready && on} aria-disabled={!m.ready}
        aria-label={`${m.label}: ${m.desc}${m.ready ? '' : '. Coming soon'}`}
        onClick={() => (m.ready ? onToggle() : setNope(true))} onAnimationEnd={() => setNope(false)}>
        <span className="face back">{body(m.ready ? 'Tap to turn on' : <><Hourglass size={12} weight="bold" /> Coming soon</>)}</span>
        <span className="face front" style={{ background: `var(--${m.tint}-tint)`, color: `var(--${m.tint}-ink)` }}>{body(<><Check size={12} weight="bold" /> On</>)}</span>
      </button>
    </div>
  );
}
export { MODULES };

// ---------- time ----------
export function SeasonLengthPicker({ value, onChange }: { value: SeasonLength; onChange(v: SeasonLength): void }) {
  return <Seg<SeasonLength> label="Season length" value={value} onChange={onChange} options={SEASON_LENGTHS.map((l) => ({ v: l, label: seasonLengthLabel(l, true) }))} />;
}

const STAGE_TINTS = ['var(--accent-soft)', 'var(--clubs-tint)', 'var(--sims-tint)', 'var(--households-tint)', 'var(--worlds-tint)', 'var(--calendar-tint)', 'var(--storylines-tint)', 'var(--line)'];

/** Lifespan presets, the stage bar, and (for Custom) a box per stage. */
export function LifespanEditor({ value, onChange, customDays }: {
  value: Lifespan; onChange(v: Lifespan): void; customDays?: Partial<Record<StageId, number>>;
}) {
  const table = useMemo(() => stageTable(value), [value]);
  const days = Object.fromEntries(table.map((r) => [r.id, r.days])) as Record<StageId, number>;
  const pick = (p: Lifespan['preset']) => {
    if (p !== 'custom') return onChange({ preset: p });
    // Custom starts from what's showing now, or the custom numbers saved before.
    onChange({ preset: 'custom', days: { ...days, ...(customDays ?? {}) } });
  };
  const toElder = table.filter((r) => r.id !== 'elder').reduce((a, r) => a + r.days, 0);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Seg<Lifespan['preset']> label="Lifespan" value={value.preset} onChange={pick}
        options={(['short', 'normal', 'long', 'custom'] as const).map((p) => ({ v: p, label: p[0].toUpperCase() + p.slice(1) }))} />
      <div className="timeline" aria-hidden="true">
        {table.map((r, i) => (
          <div key={r.id} style={{ flexGrow: r.days, background: STAGE_TINTS[i] }} title={`${r.name}: ${plural(r.days, 'day')}`}>{r.days >= 6 ? r.name : ''}</div>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="custom-stages">
          {STAGE_IDS.map((id) => (
            <div key={id} className="field">
              <span className="label">{stageName(id)}</span>
              <Stepper label={`${stageName(id)} days`} min={1} max={999} value={days[id]}
                onChange={(n) => onChange({ preset: 'custom', days: { ...days, [id]: n } })} />
            </div>
          ))}
        </div>
      )}
      <span className="hint">{plural(toElder, 'day')} to elder, then at least {days.elder} more.</span>
    </div>
  );
}

/** Season, day and year, picked on the calendar. Used for "Today in your game" (setup), Set date (settings) and when a Sim passed. */
export function DateFields({ value, onChange, seasonLength, label = 'Date', today }: { value: SimDate; onChange(v: SimDate): void; seasonLength: SeasonLength; label?: string; today?: SimDate | null }) {
  return <DateField label={label} value={value} onChange={onChange} seasonLength={seasonLength} today={today} />;
}
