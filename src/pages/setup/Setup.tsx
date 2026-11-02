import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Sparkle as SparkleIcon } from '@phosphor-icons/react';
import { useGameData, PACK_TYPE_LABEL, type Pack } from '../../data/gameData';
import { useStore } from '../../store/store';
import { uid, nowIso } from '../../lib/ids';
import { SEASONS, SEASON_LENGTHS, STAGES, STAGE_LABEL, stageDays } from '../../lib/time';
import { MODULES, SAVE_COLORS } from '../../lib/modules';
import type { LifeStageId, LifespanPreset, ModuleId, Save, SeasonIndex, SeasonLength } from '../../lib/types';
import { CATEGORIES, type CategoryId } from '../../components/categories';
import { Sparkle, Wordmark } from '../../components/brand';
import { Field, PhotoPicker, Seg, Toggle, toast } from '../../components/ui';
import './setup.css';

type Phase = 'welcome' | 'steps' | 'leaving' | 'burst' | 'summary' | 'deck';

const STAGE_TINTS = ['var(--accent-soft)', 'var(--clubs-tint)', 'var(--sims-tint)', 'var(--households-tint)', 'var(--worlds-tint)', 'var(--calendar-tint)', 'var(--storylines-tint)', 'var(--line)'];
const PACK_TINT: Record<string, string> = { expansion: '#FFE4DC', game: '#DDE9FF', stuff: '#FFF0D1', kit: '#ECE7FF', free: '#D8F3EE' };
const OBJ_COLORS = ['#D6492E', '#A86F00', '#167C6D', '#2F62D6', '#B23A7D', '#5B4BD6', '#FFE4DC', '#FFF0D1', '#D8F3EE', '#DDE9FF', '#FBE0F0', '#ECE7FF'];

export default function Setup() {
  const nav = useNavigate();
  const { createSave, saves } = useStore();
  const game = useGameData((s) => s.data);

  const [phase, setPhase] = useState<Phase>('welcome');
  const [step, setStep] = useState(1);
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [saved, setSaved] = useState<Save | null>(null);

  // form
  const [name, setName] = useState('');
  const [cover, setCover] = useState<string | undefined>();
  const [color, setColor] = useState(SAVE_COLORS[0].hex);
  const [packs, setPacks] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState('expansion');
  const [startSeason, setStartSeason] = useState<SeasonIndex>(0);
  const [len, setLen] = useState<SeasonLength>(7);
  const [preset, setPreset] = useState<LifespanPreset>('normal');
  const [custom, setCustom] = useState<Partial<Record<LifeStageId, number>>>({});
  const [track, setTrack] = useState(true);
  const [mods, setMods] = useState<Set<ModuleId>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setWelcomeReady(true), 2300);
    return () => clearTimeout(t);
  }, []);

  const tabs = useMemo(() => {
    const groups = new Map<string, Pack[]>();
    for (const p of game?.packs ?? []) {
      if (p.type === 'base') continue;
      groups.set(p.type, [...(groups.get(p.type) ?? []), p]);
    }
    return ['expansion', 'game', 'stuff', 'kit', 'free'].filter((k) => groups.has(k)).map((k) => ({ id: k, label: PACK_TYPE_LABEL[k] ?? k, packs: groups.get(k)! }));
  }, [game]);

  const table = game?.stages;
  const lifeRules = { preset, custom: preset === 'custom' ? custom : undefined };
  const days = stageDays(lifeRules, table);

  const finish = async () => {
    const save: Save = {
      id: uid(),
      name: name.trim() || 'My forever save',
      cover,
      color,
      packs: [...packs],
      date: { year: 1, season: startSeason, day: 1 },
      startSeason,
      seasonLength: len,
      lifespan: preset === 'custom' ? { preset, custom: Object.fromEntries(STAGES.map((s) => [s, days[s]])) } : { preset },
      trackDate: track,
      modules: Object.fromEntries([...mods].map((m) => [m, true])),
      createdAt: nowIso(),
    };
    setPhase('leaving');
    try {
      await createSave(save);
      setSaved(save);
    } catch (e) {
      toast(`Couldn’t create that save: ${e instanceof Error ? e.message : 'unknown error'}`);
      setPhase('steps');
      return;
    }
    setTimeout(() => setPhase('burst'), 450);
    setTimeout(() => setPhase('summary'), 2000);
  };

  // ---------------- welcome ----------------
  if (phase === 'welcome') {
    const starts = [
      [-560, -300, 25], [560, -280, -25], [-600, 40, 25], [600, 60, -25], [-420, 320, 25], [440, 330, -25],
    ];
    const gather = [[-56, -30], [0, -56], [56, -30], [-56, 30], [0, 56], [56, 30]];
    return (
      <div className="flow">
        <div className="welcome">
          {CATEGORIES.map((c, i) => {
            const I = c.icon;
            return (
              <div
                key={c.id}
                className={`fly obj ${c.id}`}
                style={{
                  ['--sx' as string]: `${starts[i][0]}px`, ['--sy' as string]: `${starts[i][1]}px`, ['--sr' as string]: `${starts[i][2]}deg`,
                  ['--gx' as string]: `${gather[i][0]}px`, ['--gy' as string]: `${gather[i][1]}px`, animationDelay: `${i * 0.05}s`,
                }}
              >
                <I size={24} weight="duotone" />
              </div>
            );
          })}
          <span className="ring" />
          <Sparkle size={88} className="burst-sparkle" />
          <div style={{ position: 'absolute', top: '54%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '0 16px', textAlign: 'center' }}>
            <div className="fu" style={{ animationDelay: '2.3s' }}>
              <Wordmark size={56} />
            </div>
            <h1 className="fu" style={{ animationDelay: '2.55s', fontSize: 26 }}>Let’s build your save</h1>
            <p className="fu muted" style={{ animationDelay: '2.7s', margin: 0 }}>A few quick questions. You can change all of it later.</p>
            <div className="row fu" style={{ animationDelay: '2.85s', justifyContent: 'center' }}>
              <button className="btn primary lg" onClick={() => setPhase('steps')} disabled={!welcomeReady && false}>
                Start <ArrowRight size={18} weight="bold" />
              </button>
              {saves.length > 0 && (
                <button className="btn ghost lg" onClick={() => nav(-1)}>
                  Not now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- finale ----------------
  if (phase === 'burst' || phase === 'summary' || phase === 'deck') {
    return (
      <div className="flow">
        <div className="flow-center" style={{ flexDirection: 'column', gap: 28 }}>
          {phase === 'burst' && <Burst />}
          {phase === 'summary' && saved && <Summary save={saved} packCount={packs.size} onNext={() => setPhase('deck')} />}
          {phase === 'deck' && saved && <Deck save={saved} />}
        </div>
      </div>
    );
  }

  // ---------------- steps ----------------
  const stepTitles = ['Name your save', 'Which packs do you have?', 'How does time work?', 'Pick your modules'];
  const curTab = tabs.find((t) => t.id === tab) ?? tabs[0];
  const tabAllOn = curTab && curTab.packs.every((p) => packs.has(p.id));

  return (
    <div className="flow">
      <div className="flow-center">
        <div className={`setup-card ${phase === 'leaving' ? 'leaving' : ''}`}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="prog" aria-label={`Step ${step} of 4`}>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} style={{ width: i === step ? 28 : 8, background: i <= step ? 'var(--accent)' : 'var(--line)' }} />
              ))}
            </div>
            <span className="tiny muted bold">Step {step} of 4</span>
          </div>
          <h1 key={`h${step}`} className="stepin">{stepTitles[step - 1]}</h1>

          <div key={step} className="stepin">
            {step === 1 && (
              <div className="stack" style={{ gap: 18 }}>
                <Field label="Save name">
                  {(id) => <input id={id} className="input" placeholder="My forever save" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={{ height: 48, fontSize: 18 }} />}
                </Field>
                <div className="field">
                  <span className="label">Cover photo <span className="muted">(optional)</span></span>
                  <PhotoPicker value={cover} onChange={setCover} height={150} label="Add a cover photo" />
                </div>
                <div className="field">
                  <span className="label">Save color</span>
                  <div className="swatches" role="group" aria-label="Save color">
                    {SAVE_COLORS.map((c) => (
                      <button key={c.hex} type="button" className="swatch" aria-pressed={color === c.hex} aria-label={c.label} style={{ background: c.hex }} onClick={() => setColor(c.hex)} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="stack" style={{ gap: 14 }}>
                <p className="small muted" style={{ margin: 0 }}>We’ll only show traits, worlds and lots from the packs you pick. Base Game is always in.</p>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="seg" role="tablist">
                    {tabs.map((t) => (
                      <button key={t.id} type="button" role="tab" aria-selected={t.id === curTab?.id} aria-pressed={t.id === curTab?.id} onClick={() => setTab(t.id)}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {curTab && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        const n = new Set(packs);
                        for (const p of curTab.packs) tabAllOn ? n.delete(p.id) : n.add(p.id);
                        setPacks(n);
                      }}
                    >
                      {tabAllOn ? 'Clear all' : 'Select all'}
                    </button>
                  )}
                </div>
                <div className="packs" role="group" aria-label={curTab?.label}>
                  {curTab?.packs.map((p) => {
                    const on = packs.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="pk"
                        aria-pressed={on}
                        style={{ background: PACK_TINT[p.type] ?? '#EEE7E3' }}
                        onClick={() => {
                          const n = new Set(packs);
                          on ? n.delete(p.id) : n.add(p.id);
                          setPacks(n);
                        }}
                      >
                        {p.name}
                        <span className="badge" aria-hidden="true"><Check size={13} weight="bold" /></span>
                      </button>
                    );
                  })}
                </div>
                <div className="tiny muted" aria-live="polite">{packs.size} packs selected</div>
              </div>
            )}

            {step === 3 && (
              <div className="stack" style={{ gap: 22 }}>
                <div className="field">
                  <span className="label">Starting season</span>
                  <Seg label="Starting season" value={startSeason} onChange={(v) => setStartSeason(v)} options={SEASONS.map((s, i) => ({ v: i as SeasonIndex, label: s }))} />
                </div>
                <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
                  <div className="field grow" style={{ minWidth: 240 }}>
                    <span className="label">Season length</span>
                    <Seg
                      label="Season length"
                      value={len}
                      onChange={(v) => setLen(v)}
                      options={SEASON_LENGTHS.map((l) => ({ v: l, label: l === 7 ? '1 week' : l === 21 ? '3 weeks (mod)' : `${l / 7} weeks` }))}
                    />
                    <span className="hint">{SEASONS[startSeason]} lasts {len} days, then the next season starts.</span>
                  </div>
                  <div className="mini-cal" key={len} aria-hidden="true" style={{ width: 230 }}>
                    {Array.from({ length: len }, (_, i) => (
                      <span key={i} className={i === 0 ? 'today' : ''} style={{ animationDelay: `${i * 0.012}s` }}>{i + 1}</span>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="label">Lifespan</span>
                  <Seg label="Lifespan" value={preset} onChange={(v) => setPreset(v)} options={(['short', 'normal', 'long', 'custom'] as const).map((p) => ({ v: p, label: p[0].toUpperCase() + p.slice(1) }))} />
                  <div className="timeline" aria-hidden="true" style={{ marginTop: 6 }}>
                    {STAGES.map((s, i) => (
                      <div key={s} style={{ flexGrow: days[s], background: STAGE_TINTS[i] }} title={`${STAGE_LABEL[s]}: ${days[s]} days`}>
                        {days[s] >= 6 ? STAGE_LABEL[s] : ''}
                      </div>
                    ))}
                  </div>
                  {preset === 'custom' && (
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      {STAGES.map((s) => (
                        <label key={s} className="field" style={{ width: 92 }}>
                          <span className="tiny bold">{STAGE_LABEL[s]}</span>
                          <input className="input" type="number" min={1} value={days[s]} onChange={(e) => setCustom({ ...custom, [s]: Math.max(1, Number(e.target.value) || 1) })} />
                        </label>
                      ))}
                    </div>
                  )}
                  <span className="hint">
                    {STAGES.reduce((a, s) => a + (s === 'elder' ? 0 : days[s]), 0)} days to elder, then at least {days.elder} more. You can change this later and every Sim’s age recalculates.
                  </span>
                </div>
                <div className="switch-row" style={{ borderTop: '1px solid var(--line)' }}>
                  <div className="grow">
                    <div className="bold">Track today’s date</div>
                    <div className="small muted">Powers ages, countdowns, upcoming birthdays and Jump ahead. Turn it off if logging the day feels like homework.</div>
                  </div>
                  <Toggle on={track} onChange={setTrack} label="Track today’s date" />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="stack" style={{ gap: 14 }}>
                <p className="small muted" style={{ margin: 0 }}>Flip on what you want to track. Off means hidden, never deleted. More of these unlock as they launch.</p>
                <div className="mods">
                  {MODULES.map((m) => {
                    const on = mods.has(m.id);
                    const I = m.icon;
                    return (
                      <div key={m.id} className="flipwrap">
                        <button
                          type="button"
                          className="flipper"
                          aria-pressed={on}
                          aria-label={`${m.label}: ${m.desc}`}
                          onClick={() => {
                            const n = new Set(mods);
                            on ? n.delete(m.id) : n.add(m.id);
                            setMods(n);
                          }}
                        >
                          <span className="face back">
                            <SparkleIcon size={28} weight="fill" />
                            <span className="lbl">{m.label}</span>
                          </span>
                          <span className="face front">
                            <span className={`obj ${m.tint}`}><I size={16} weight="duotone" /></span>
                            <span className="bold">{m.label}</span>
                            <span className="small muted">{m.desc}</span>
                            <span className="tag berry" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}><Check size={12} weight="bold" /> On</span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            {step > 1 ? (
              <button className="btn ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} weight="bold" /> Back
              </button>
            ) : (
              <span />
            )}
            <button className="btn primary lg" onClick={() => (step < 4 ? setStep(step + 1) : void finish())} disabled={phase === 'leaving'}>
              {step < 4 ? 'Next' : 'Start my save'} <ArrowRight size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Burst() {
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const a = (i / 46) * Math.PI * 2 + Math.random() * 0.4;
        const r = 160 + Math.random() * 260;
        return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, rot: Math.random() * 540 - 270, c: OBJ_COLORS[i % OBJ_COLORS.length], d: Math.random() * 0.25 };
      }),
    [],
  );
  return (
    <>
      <span className="ring" style={{ position: 'fixed', top: '45%' }} />
      <Sparkle size={110} className="burst-sparkle" style={{ position: 'fixed', top: '45%', animationDelay: '0s', margin: '-55px 0 0 -55px' }} />
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti"
          style={{ background: b.c, animationDelay: `${b.d}s`, ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--rot' as string]: `${b.rot}deg` }}
        />
      ))}
    </>
  );
}

function Summary({ save, packCount, onNext }: { save: Save; packCount: number; onNext(): void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 3200);
    return () => clearTimeout(t);
  }, [onNext]);
  const lifeLabel = save.lifespan.preset[0].toUpperCase() + save.lifespan.preset.slice(1);
  return (
    <div className="card rise" style={{ width: '100%', maxWidth: 460, padding: 0, overflow: 'hidden', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ height: 140, background: save.cover ? undefined : save.color, position: 'relative' }}>
        {save.cover && <img src={save.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <Sparkle size={30} color="#fff" style={{ position: 'absolute', right: 18, top: 18 }} />
      </div>
      <div style={{ padding: 24 }} className="stack">
        <h1 style={{ fontSize: 26 }}>{save.name}</h1>
        <dl className="kv">
          <dt>Starts in</dt><dd>{SEASONS[save.startSeason]}, Year 1</dd>
          <dt>Seasons</dt><dd>{save.seasonLength} days each</dd>
          <dt>Lifespan</dt><dd>{lifeLabel}</dd>
          <dt>Packs</dt><dd>Base Game + {packCount}</dd>
        </dl>
        <button className="btn primary" onClick={onNext}>Let’s go</button>
      </div>
    </div>
  );
}

function Deck({ save }: { save: Save }) {
  const nav = useNavigate();
  const [picked, setPicked] = useState<CategoryId | null>(null);
  const cards = CATEGORIES.filter((c) => !c.module || save.modules[c.module]);
  const n = cards.length;
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 761px)').matches;
  const spread = Math.min(200, (Math.min(window.innerWidth, 1100) - 200) / Math.max(1, n - 1));
  return (
    <>
      <h1 className="fu" style={{ animationDelay: '1.6s', textAlign: 'center' }}>Where do you want to start?</h1>
      <div className="deck">
        {cards.map((c, i) => {
          const mid = (n - 1) / 2;
          const off = i - mid;
          const I = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              className={`deck-card ${picked === c.id ? 'grow' : ''}`}
              style={{
                background: `var(--${c.id}-tint)`,
                ['--d' as string]: `${i * 0.04}s`,
                ['--s' as string]: String(off / Math.max(1, mid)),
                ['--fx' as string]: wide ? `${off * spread}px` : '0px',
                ['--fy' as string]: wide ? `${Math.abs(off) * Math.abs(off) * 7}px` : '0px',
                ['--fr' as string]: wide ? `${off * 4}deg` : '0deg',
                zIndex: picked === c.id ? 50 : i,
                color: 'var(--text)',
              }}
              disabled={!!picked}
              onClick={() => {
                setPicked(c.id);
                setTimeout(() => nav(`/s/${save.id}/${c.path}`), 520);
              }}
            >
              <span className="ico" style={{ color: `var(--${c.id}-ink)` }}><I size={26} weight="duotone" /></span>
              <span className="stack" style={{ gap: 6 }}>
                <h3>{c.label}</h3>
                <p>{c.nudge}</p>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
