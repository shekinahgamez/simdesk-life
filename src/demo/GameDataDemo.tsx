import { useEffect, useMemo, useState } from 'react';
import { Field, Picker, SearchBox, Seg, Toggle } from '../components/ui';
import { available, BY_ID, GAME, optionsWithChosen, ownedFrom, PACK_TYPES, type PackType } from '../data/game';
import { matches, plural } from '../lib/text';

/** Test area for step 6 on the style check page: the built-in game data and the pack filter. */

const KEY = 'sd:demo-packs';
type Saved = { packs: string[]; secret: string[]; traits: string[] };
function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    if (s) return s;
  } catch { /* ignore */ }
  return { packs: ['lovestruck', 'seasons'], secret: [], traits: ['lovebug', 'active'] };
}

type Kind = 'Trait' | 'Aspiration' | 'Occult' | 'Tradition' | 'World' | 'Lot';
const ALL_ITEMS: { kind: Kind; id: string; name: string; pack: string; extra?: string; secret?: boolean }[] = [
  ...GAME.traits.map((x) => ({ kind: 'Trait' as const, id: x.id, name: x.name, pack: x.pack, extra: x.category })),
  ...GAME.aspirations.map((x) => ({ kind: 'Aspiration' as const, id: x.id, name: x.name, pack: x.pack, extra: x.category })),
  ...GAME.occults.map((x) => ({ kind: 'Occult' as const, id: x.id, name: x.name, pack: x.pack })),
  ...GAME.traditions.map((x) => ({ kind: 'Tradition' as const, id: x.id, name: x.name, pack: x.pack })),
  ...GAME.worlds.map((x) => ({ kind: 'World' as const, id: x.id, name: x.name, pack: x.pack, extra: x.type })),
  ...GAME.lots.map((x) => ({
    kind: 'Lot' as const, id: x.id, name: x.name, pack: x.pack, secret: x.secret,
    extra: [BY_ID.worlds.get(x.world)?.name, x.neighborhood, x.size, x.locked ? (x.lotType ? `${x.lotType} (locked)` : 'Locked') : 'No lot type', x.note].filter(Boolean).join(' · '),
  })),
];

export function GameDataDemo() {
  const [s, setS] = useState<Saved>(load);
  const [tab, setTab] = useState<PackType>('expansion');
  const [q, setQ] = useState('');
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);

  const owned = useMemo(() => ownedFrom(s.packs, s.secret), [s.packs, s.secret]);
  const av = useMemo(() => available(owned), [owned]);
  const packsOfTab = GAME.packs.filter((p) => p.type === tab);
  const togglePack = (id: string) => setS((x) => ({ ...x, packs: x.packs.includes(id) ? x.packs.filter((p) => p !== id) : [...x.packs, id] }));
  const toggleSecret = (id: string) => setS((x) => ({ ...x, secret: x.secret.includes(id) ? x.secret.filter((p) => p !== id) : [...x.secret, id] }));
  const traitOptions = useMemo(() => optionsWithChosen(av.traits, BY_ID.traits, s.traits), [av.traits, s.traits]);

  const counts: [string, number, number][] = [
    ['Traits', av.traits.length, GAME.traits.length],
    ['Aspirations', av.aspirations.length, GAME.aspirations.length],
    ['Occults', av.occults.length, GAME.occults.length],
    ['Traditions', av.traditions.length, GAME.traditions.length],
    ['Worlds', av.worlds.length, GAME.worlds.length],
    ['Lots', av.lots.length, GAME.lots.length],
  ];
  const results = useMemo(() => (q.trim() ? ALL_ITEMS.filter((x) => matches(`${x.name} ${x.kind}`, q)).slice(0, 40) : []), [q]);
  const status = (x: (typeof ALL_ITEMS)[number]) => {
    if (!owned.packs.has(x.pack)) return { t: `${BY_ID.packs.get(x.pack)?.name ?? x.pack} is off`, cls: 'off' };
    if (x.secret && !owned.secretLots.has(x.id)) return { t: 'Secret lot, not turned on', cls: 'off' };
    return { t: 'Can be picked', cls: 'on' };
  };

  return (
    <section>
      <h2>Game data test (step 6)</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        The game data is built into the app now. Tick packs on and off and watch what a save can pick. Base Game is always on.
        Imported {new Date(GAME.importedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.
      </p>
      <div className="card stack">
        <div className="gd-counts">
          {counts.map(([label, n, total]) => (
            <div key={label} className="gd-count"><b>{n}</b><span>{label}</span><small>of {total}</small></div>
          ))}
        </div>

        <div className="m-label" style={{ margin: 0 }}>Packs</div>
        <div style={{ overflowX: 'auto' }}>
          <Seg<PackType> label="Pack type" value={tab} onChange={setTab}
            options={PACK_TYPES.filter((t) => GAME.packs.some((p) => p.type === t.type)).map((t) => {
              const all = GAME.packs.filter((p) => p.type === t.type);
              return { v: t.type, label: `${t.label} ${all.filter((p) => s.packs.includes(p.id)).length}/${all.length}` };
            })} />
        </div>
        <div className="row">
          <button type="button" className="btn sm" onClick={() => setS((x) => ({ ...x, packs: [...new Set([...x.packs, ...packsOfTab.map((p) => p.id)])] }))}>Tick all</button>
          <button type="button" className="btn sm" onClick={() => setS((x) => ({ ...x, packs: x.packs.filter((id) => !packsOfTab.some((p) => p.id === id)) }))}>Untick all</button>
        </div>
        <div className="gd-packs">
          {packsOfTab.map((p) => (
            <label key={p.id} className="gd-pack">
              <input type="checkbox" checked={s.packs.includes(p.id)} onChange={() => togglePack(p.id)} />
              <span>{p.name}</span>
            </label>
          ))}
        </div>

        <div className="m-label" style={{ margin: '6px 0 0' }}>Secret lots ({av.secretLots.length} from your packs)</div>
        {av.secretLots.length === 0 ? <p className="muted small" style={{ margin: 0 }}>None from the packs that are on.</p> : (
          <div className="gd-packs">
            {av.secretLots.map((l) => (
              <div key={l.id} className="gd-pack">
                <Toggle on={s.secret.includes(l.id)} onChange={() => toggleSecret(l.id)} label={`Turn on ${l.name}`} />
                <span>{l.name} <small className="muted">{BY_ID.worlds.get(l.world)?.name}</small></span>
              </div>
            ))}
          </div>
        )}

        <div className="m-label" style={{ margin: '6px 0 0' }}>Stays on the profile</div>
        <p className="muted small" style={{ margin: 0 }}>
          This example Sim has Lovebug (Lovestruck). Untick Lovestruck: the trait stays, marked “Lovestruck is off”. Remove it, and it can’t be picked again until Lovestruck is back on.
        </p>
        <Field label="Example Sim’s traits">
          {(id) => <Picker id={id} multiple options={traitOptions} value={s.traits} onChange={(v) => setS((x) => ({ ...x, traits: v }))} placeholder="Search traits" />}
        </Field>

        <div className="m-label" style={{ margin: '6px 0 0' }}>Find anything</div>
        <SearchBox value={q} onChange={setQ} placeholder="Search traits, aspirations, occults, traditions, worlds, lots" />
        {q.trim() && (results.length === 0 ? <p className="muted small" style={{ margin: 0 }}>Nothing matches “{q}”.</p> : (
          <div className="trash-list">
            {results.map((x) => {
              const st = status(x);
              return (
                <div key={x.kind + x.id} className="trash-row">
                  <div className="trash-txt">
                    <b>{x.name}</b>
                    <span>{x.kind} · {BY_ID.packs.get(x.pack)?.name}{x.extra ? ` · ${x.extra}` : ''}</span>
                  </div>
                  <span className={`gd-st ${st.cls}`}>{st.t}</span>
                </div>
              );
            })}
          </div>
        ))}
        <p className="muted small" style={{ margin: 0 }}>{plural(GAME.packs.length, 'pack')} in the data. Ticks here are saved on this device only.</p>
      </div>
    </section>
  );
}
