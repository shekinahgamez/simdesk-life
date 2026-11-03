import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { Sparkle, Wordmark } from '../components/brand';
import { BUILT, CATEGORIES, type CategoryId } from '../components/categories';
import { DesktopDeck, PhoneDeck } from '../components/Deck';
import { DateFields, LifespanEditor, ModuleCard, MODULES, PackPicker, SeasonLengthPicker, Swatches } from '../components/savebits';
import { Field, Seg, Toggle } from '../components/ui';
import { APP } from '../config/app';
import { go, savePath } from '../lib/router';
import { lifespanLabel, newSaveData, SAVE_COLORS, saveData, setLastSave, todayOf, type SaveData } from '../lib/saves';
import { useSaves, useStore } from '../lib/sync/react';
import { plural } from '../lib/text';
import { formatDate, SEASONS, type Lifespan, type Season, type SeasonLength, type SimDate } from '../lib/time';
import { useIsPhone } from '../lib/useIsPhone';

type Phase = 'welcome' | 'steps' | 'leaving' | 'burst' | 'summary' | 'deck';
const OBJ_COLORS = ['#D6492E', '#A86F00', '#167C6D', '#2F62D6', '#B23A7D', '#5B4BD6', '#FFE4DC', '#FFF0D1', '#D8F3EE', '#DDE9FF', '#FBE0F0', '#ECE7FF'];

export function Setup({ userKey }: { userKey: string }) {
  const store = useStore();
  const { active } = useSaves();
  const phone = useIsPhone();
  const hasSaves = active.length > 0;
  const [phase, setPhase] = useState<Phase>('welcome');
  const [step, setStep] = useState(1);
  const [skip, setSkip] = useState(false);
  const [made, setMade] = useState<{ id: string; data: SaveData } | null>(null);

  // the form
  const [name, setName] = useState('');
  const [color, setColor] = useState(SAVE_COLORS[0].hex);
  const [packs, setPacks] = useState<string[]>([]);
  const [len, setLen] = useState<SeasonLength>(7);
  const [today, setToday] = useState<SimDate>({ year: 1, season: 0, day: 1 });
  const [lifespan, setLifespan] = useState<Lifespan>({ preset: 'normal' });
  const [track, setTrack] = useState(true);
  const [mods, setMods] = useState<string[]>([]);

  const notNow = () => go('#/');
  const back = () => (step > 1 ? setStep(step - 1) : hasSaves ? notNow() : setPhase('welcome'));
  const next = () => (step < 4 ? setStep(step + 1) : finish());

  const finish = () => {
    const data = newSaveData({ name, color, packs, seasonLength: len, today: track ? today : { year: 1, season: today.season, day: 1 }, lifespan, trackDate: track, modules: mods });
    setPhase('leaving');
    // Saving is local-first, so this works offline too; it syncs in the background.
    const id = store.createSave(data);
    setLastSave(userKey, id);
    void store.openSave(id);
    setMade({ id, data: saveData(store.saves.get(id)) });
    setTimeout(() => setPhase('burst'), 450);
    setTimeout(() => setPhase('summary'), 2000);
  };

  const cards = useMemo(() => CATEGORIES.filter((c) => !c.module || made?.data.modules[c.module])
    .map((c) => ({ id: c.id, label: c.label, icon: c.icon, text: c.nudge, built: BUILT.has(c.id) })), [made]);
  const noneBuilt = cards.every((c) => !c.built);
  const toSettings = () => made && go(savePath(made.id, 'settings'));
  const openSection = (id: CategoryId) => made && go(savePath(made.id, CATEGORIES.find((c) => c.id === id)!.path));

  // ---------- welcome ----------
  if (phase === 'welcome') {
    if (phone) {
      return (
        <div className="ms-flow">
          <div className="ms-welcome">
            <div className="ms-iconrow" aria-hidden="true">
              {CATEGORIES.map((c, i) => {
                const I = c.icon;
                return <span key={c.id} className={`obj ${c.id}`} style={{ animationDelay: `${0.15 + i * 0.09}s`, ['--r' as string]: `${[-6, 4, -3, 5, -4, 3][i]}deg` }}><I size={20} weight="duotone" /></span>;
              })}
            </div>
            <div className="fu" style={{ animationDelay: '0.85s' }}><Wordmark size={60} /></div>
            <p className="fu m-sub" style={{ animationDelay: '1.05s', fontSize: 17 }}>{APP.tagline}</p>
          </div>
          <div className="ms-bar col fu" style={{ animationDelay: '1.3s' }}>
            <button type="button" className="m-pillbtn" onClick={() => setPhase('steps')}>Let’s build your save</button>
            {hasSaves && <button type="button" className="btn ghost" onClick={notNow}>Not now</button>}
          </div>
        </div>
      );
    }
    const starts = [[-560, -300, 25], [560, -280, -25], [-600, 40, 25], [600, 60, -25], [-420, 320, 25], [440, 330, -25]];
    const gather = [[-56, -30], [0, -56], [56, -30], [-56, 30], [0, 56], [56, 30]];
    return (
      // Clicking anywhere during the intro skips straight to the buttons.
      <div className={`flow ${skip ? 'skip-intro' : ''}`} onClick={() => setSkip(true)}>
        <div className="welcome">
          {CATEGORIES.map((c, i) => {
            const I = c.icon;
            return (
              <div key={c.id} className={`fly obj ${c.id}`} aria-hidden="true"
                style={{ ['--sx' as string]: `${starts[i][0]}px`, ['--sy' as string]: `${starts[i][1]}px`, ['--sr' as string]: `${starts[i][2]}deg`, ['--gx' as string]: `${gather[i][0]}px`, ['--gy' as string]: `${gather[i][1]}px`, animationDelay: `${i * 0.05}s` }}>
                <I size={24} weight="duotone" />
              </div>
            );
          })}
          <span className="ring" />
          <Sparkle size={88} className="burst-sparkle" />
          <div style={{ position: 'absolute', top: '54%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '0 16px', textAlign: 'center' }}>
            <div className="fu" style={{ animationDelay: '2.3s' }}><Wordmark size={56} /></div>
            <h1 className="fu" style={{ animationDelay: '2.55s', fontSize: 26 }}>Let’s build your save</h1>
            <p className="fu muted" style={{ animationDelay: '2.7s', margin: 0 }}>A few quick questions. You can change all of it later.</p>
            <div className="row fu" style={{ animationDelay: '2.85s', justifyContent: 'center' }}>
              <button type="button" className="btn primary lg" onClick={() => setPhase('steps')}>Start <ArrowRight size={18} weight="bold" /></button>
              {hasSaves && <button type="button" className="btn ghost lg" onClick={notNow}>Not now</button>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- finale ----------
  if ((phase === 'burst' || phase === 'summary' || phase === 'deck') && made) {
    if (phase === 'deck' && phone) {
      return (
        <div className="ms-flow" style={{ justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', paddingTop: 30 }} className="fu">
            <h1 className="ms-h1">Where do you want to start?</h1>
            <p className="m-sub" style={{ margin: 0 }}>Swipe through the deck, then tap a card.</p>
          </div>
          <PhoneDeck cards={cards} onPick={openSection} button={!noneBuilt} />
          {noneBuilt && (
            <div className="ms-bar">
              <button type="button" className="m-pillbtn" onClick={toSettings}>Go to Save settings</button>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="flow">
        <div className="flow-center" style={{ flexDirection: 'column', gap: 28 }}>
          {phase === 'burst' && <Burst />}
          {phase === 'summary' && <Summary data={made.data} onNext={() => setPhase('deck')} />}
          {phase === 'deck' && (
            <>
              <h1 className="fu" style={{ animationDelay: '1.6s', textAlign: 'center' }}>Where do you want to start?</h1>
              <DesktopDeck cards={cards} mode="setup" onPick={openSection} />
              {noneBuilt && (
                <button type="button" className="btn primary lg fu" style={{ animationDelay: '2.6s' }} onClick={toSettings}>Go to Save settings</button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- steps ----------
  const stepName = (
    <div className="stack" style={{ gap: 18 }}>
      <Field label="Save name">
        {(id) => <input id={id} className="input" placeholder="My forever save" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={{ height: 48, fontSize: 18 }} />}
      </Field>
      <div className="field">
        <span className="label">Save color</span>
        <Swatches value={color} onChange={setColor} />
      </div>
    </div>
  );
  const stepPacks = (
    <div className="stack" style={{ gap: 14 }}>
      {!phone && <p className="small muted" style={{ margin: 0 }}>We’ll only show traits, worlds and lots from the packs you pick. Base Game is always in.</p>}
      <PackPicker value={packs} onChange={setPacks} phone={phone} />
    </div>
  );
  const stepTime = (
    <div className="stack" style={{ gap: 22 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
        <div className="field grow" style={{ minWidth: 240 }}>
          <span className="label">Season length</span>
          <SeasonLengthPicker value={len} onChange={(l) => { setLen(l); setToday((t) => ({ ...t, day: Math.min(t.day, l) })); }} />
          <span className="hint">{SEASONS[today.season]} lasts {len} days, then the next season starts.</span>
        </div>
        <div className="mini-cal" key={len} aria-hidden="true" style={{ width: 230 }}>
          {Array.from({ length: len }, (_, i) => <span key={i} className={i + 1 === (track ? today.day : 1) ? 'today' : ''} style={{ animationDelay: `${i * 0.012}s` }}>{i + 1}</span>)}
        </div>
      </div>
      {track ? (
        <div className="field">
          <span className="label">Today in your game</span>
          <DateFields value={today} onChange={setToday} seasonLength={len} />
          <span className="hint">Starting fresh? Leave it on Day 1. Already playing? Match your game’s calendar.</span>
        </div>
      ) : (
        <div className="field">
          <span className="label">Starting season</span>
          <Seg<Season> label="Starting season" value={today.season} onChange={(season) => setToday({ ...today, season })}
            options={SEASONS.map((x, i) => ({ v: i as Season, label: x }))} />
        </div>
      )}
      <div className="field">
        <span className="label">Lifespan</span>
        <LifespanEditor value={lifespan} onChange={setLifespan} />
      </div>
      <div className="switch-row" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="grow">
          <div className="bold">Track today’s date</div>
          <div className="small muted">Powers ages, countdowns, upcoming birthdays and Jump ahead. Turn it off if logging the day feels like homework.</div>
        </div>
        <Toggle on={track} onChange={setTrack} label="Track today’s date" />
      </div>
    </div>
  );
  const toggleMod = (id: string) => setMods((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const stepMods = (
    <div className={phone ? 'ms-mods' : 'mods'}>
      {MODULES.map((m) => <ModuleCard key={m.id} m={m} on={mods.includes(m.id)} onToggle={() => toggleMod(m.id)} />)}
    </div>
  );
  const body = [stepName, stepPacks, stepTime, stepMods][step - 1];

  if (phone) {
    const titles = ['Name your save', 'Which packs do you own?', 'How does time work?', 'What do you want to track?'];
    return (
      <div className="ms-flow">
        <div className="ms-prog" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((i) => <span key={i} className={`${i <= step ? 'on' : ''} ${i === step ? 'cur' : ''}`} />)}
        </div>
        <div className="ms-body" key={step}>
          <h1 className="ms-h1 stepin">{titles[step - 1]}</h1>
          {step === 4 && <p className="m-sub" style={{ margin: '0 0 16px' }}>Tap a card to add it. The rest are on the way.</p>}
          <div className="stepin" style={{ marginTop: step === 4 ? 0 : 14 }}>{body}</div>
        </div>
        <div className="ms-bar">
          <button type="button" className="m-circlebtn" aria-label={step > 1 ? 'Back' : hasSaves ? 'Cancel' : 'Back to the start'} onClick={back}>
            <ArrowLeft size={20} weight="bold" />
          </button>
          <button type="button" className="m-pillbtn" disabled={phase === 'leaving'} onClick={next}>
            {step === 2 ? `Next · ${plural(packs.length, 'pack')}` : step < 4 ? 'Next' : 'Start my save'}
          </button>
        </div>
      </div>
    );
  }

  const titles = ['Name your save', 'Which packs do you have?', 'How does time work?', 'Pick your modules'];
  return (
    <div className="flow">
      <div className="flow-center">
        <div className={`setup-card ${phase === 'leaving' ? 'leaving' : ''}`}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="prog" aria-label={`Step ${step} of 4`}>
              {[1, 2, 3, 4].map((i) => <span key={i} style={{ width: i === step ? 28 : 8, background: i <= step ? 'var(--accent)' : 'var(--line)' }} />)}
            </div>
            <span className="tiny muted bold">Step {step} of 4</span>
          </div>
          <h1 key={`h${step}`} className="stepin">{titles[step - 1]}</h1>
          {step === 4 && <p className="small muted" style={{ margin: '-8px 0 0' }}>Tap what you want to track. Off means hidden, never deleted. The grey ones are on the way.</p>}
          <div key={step} className="stepin">{body}</div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            {step > 1 ? (
              <button type="button" className="btn ghost" onClick={back}><ArrowLeft size={16} weight="bold" /> Back</button>
            ) : (
              <button type="button" className="btn ghost" onClick={back}>{hasSaves ? 'Cancel' : <><ArrowLeft size={16} weight="bold" /> Back</>}</button>
            )}
            <button type="button" className="btn primary lg" onClick={next} disabled={phase === 'leaving'}>
              {step < 4 ? 'Next' : 'Start my save'} <ArrowRight size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Burst() {
  const bits = useMemo(() => Array.from({ length: 46 }, (_, i) => {
    const a = (i / 46) * Math.PI * 2 + Math.random() * 0.4;
    const r = 160 + Math.random() * 260;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, rot: Math.random() * 540 - 270, c: OBJ_COLORS[i % OBJ_COLORS.length], d: Math.random() * 0.25 };
  }), []);
  return (
    <>
      <span className="ring" style={{ position: 'fixed', top: '45%' }} />
      <Sparkle size={110} className="burst-sparkle" style={{ position: 'fixed', top: '45%', animationDelay: '0s', margin: '-55px 0 0 -55px' }} />
      {bits.map((b, i) => (
        <span key={i} className="confetti" style={{ background: b.c, animationDelay: `${b.d}s`, ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--rot' as string]: `${b.rot}deg` }} />
      ))}
    </>
  );
}

function Summary({ data, onNext }: { data: SaveData; onNext(): void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 3200);
    return () => clearTimeout(t);
  }, [onNext]);
  const d = todayOf(data);
  return (
    <div className="card rise" style={{ width: '100%', maxWidth: 460, padding: 0, overflow: 'hidden', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ height: 140, background: data.color, position: 'relative' }}>
        <Sparkle size={30} color="#fff" style={{ position: 'absolute', right: 18, top: 18 }} />
      </div>
      <div style={{ padding: 24 }} className="stack">
        <h1 style={{ fontSize: 26 }}>{data.name}</h1>
        <dl className="kv">
          {data.trackDate ? <><dt>Today</dt><dd>{formatDate(d)}</dd></> : <><dt>Starts in</dt><dd>{SEASONS[d.season]}</dd></>}
          <dt>Seasons</dt><dd>{data.calendar.seasonLength} days each</dd>
          <dt>Lifespan</dt><dd>{lifespanLabel(data.lifespan)}</dd>
          <dt>Packs</dt><dd>Base Game + {data.packs.length}</dd>
        </dl>
        <button type="button" className="btn primary" onClick={onNext}>Let’s go</button>
      </div>
    </div>
  );
}
