import { useEffect, useRef, useState } from 'react';
import { Sparkle, Wordmark } from './brand';
import { DECK } from './categories';
import { APP } from '../config/app';

/**
 * The opening intro, on every screen size. Plays over the app on the first open of each day
 * (per account, per device), then fades away by itself to whatever page is underneath:
 * setup step 1 when there are no saves, or the last save. Tap anywhere to skip.
 *
 * Timing (approved Nov 6, 2026):
 *   0 – 1.3s   icons swirl around each other into the middle (about 1½ turns, no pause)
 *   1.3s       ring + big sparkle pops where they met
 *   1.55s      logo fades up, 1.8s tagline
 *   1.7–2.55s  big sparkle glides down and shrinks onto the "i"
 *   2.95s      everything fades out (.45s), page underneath shows
 */
const SWIRL = 1300;
const GLIDE = 1250;
const FADE_AT = 2950;
const FADE = 450;

const dayKey = (userKey: string) => `sd:introDay:${userKey}`;
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

/** True the first time this is asked on a given day; remembers that it has been seen. */
export function introDue(userKey: string): boolean {
  if ((globalThis as { __SD_NO_INTRO__?: boolean }).__SD_NO_INTRO__) return false; // the global is only for tests
  try {
    if (localStorage.getItem(dayKey(userKey)) === localDay()) return false;
    localStorage.setItem(dayKey(userKey), localDay());
    return true;
  } catch { return false; }
}

export function Intro({ onDone }: { onDone(): void }) {
  const root = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);
  const [landed, setLanded] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const el = root.current!;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    const anims: Animation[] = [];

    // the swirl meets where the logo sits
    const logo = el.querySelector('.intro-mid [role=img]')!.getBoundingClientRect();
    const y = `${logo.top + logo.height / 2}px`;
    el.querySelectorAll<HTMLElement>('.intro-fly, .intro-big, .intro-ring').forEach((n) => { n.style.top = y; });

    if (!still && typeof el.animate === 'function') {
      const icons = [...el.querySelectorAll<HTMLElement>('.intro-fly')];
      const R = Math.max(innerWidth, innerHeight) * 0.62, N = 60;
      icons.forEach((n, i) => {
        const a0 = i * 60 + 15, frames: Keyframe[] = [];
        for (let k = 0; k <= N; k++) {
          const u = k / N;
          // rush in from off screen, circle closer and closer, meet in the middle
          const r = u < .5 ? 60 + (R - 60) * (1 - u / .5) ** 2 : u < .8 ? 60 - 30 * (u - .5) / .3 : 30 * (1 - (u - .8) / .2);
          const ang = a0 + 540 * u ** 1.15;
          const sc = u < .8 ? 1 : 1 - (u - .8) / .2 * .8;
          frames.push({ offset: u, opacity: u < .12 ? u / .12 : u > .9 ? (1 - u) / .1 : 1, transform: `rotate(${ang}deg) translateX(${r}px) rotate(${-ang}deg) scale(${sc})` });
        }
        anims.push(n.animate(frames, { duration: SWIRL, easing: 'linear', fill: 'forwards' }));
      });
      const ring = el.querySelector<HTMLElement>('.intro-ring')!;
      anims.push(ring.animate([{ transform: 'scale(.2)', opacity: .8 }, { transform: 'scale(3.4)', opacity: 0 }], { duration: 1100, delay: SWIRL, easing: 'ease-out', fill: 'forwards' }));
      // the big sparkle: pops where the icons met, then glides down onto the "i" (measured just before)
      later(SWIRL, () => {
        const big = el.querySelector<HTMLElement>('.intro-big')!, dot = el.querySelector('.intro-mid [role=img] svg')!;
        const a = big.getBoundingClientRect(), d = dot.getBoundingClientRect();
        const tx = d.left + d.width / 2 - (a.left + a.width / 2), ty = d.top + d.height / 2 - (a.top + a.height / 2), ts = d.width / a.width;
        anims.push(big.animate([
          { offset: 0, transform: 'translate(0px,0px) scale(0) rotate(-120deg)', opacity: 0 },
          { offset: .22, transform: 'translate(0px,0px) scale(1.2) rotate(10deg)', opacity: 1 },
          { offset: .32, transform: 'translate(0px,0px) scale(1) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.45,.05,.3,1)' },
          { offset: 1, transform: `translate(${tx}px,${ty}px) scale(${ts}) rotate(0deg)`, opacity: 1 },
        ], { duration: GLIDE, easing: 'linear', fill: 'forwards' }));
      });
      later(SWIRL + GLIDE, () => setLanded(true));
      later(FADE_AT, () => setOut(true));
      later(FADE_AT + FADE, () => done.current());
    } else {
      // reduced motion: just the logo and tagline, then fade
      setLanded(true);
      later(1400, () => setOut(true));
      later(1400 + FADE, () => done.current());
    }
    return () => { timers.forEach(clearTimeout); anims.forEach((a) => a.cancel()); };
  }, []);

  const skip = () => {
    if (out) return;
    setOut(true);
    window.setTimeout(() => done.current(), FADE);
  };

  return (
    <div ref={root} className={`intro${out ? ' out' : ''}${landed ? ' landed' : ''}`} onClick={skip} role="presentation">
      {DECK.map((c) => { const I = c.icon; return <div key={c.id} className={`intro-fly obj ${c.id}`} aria-hidden="true"><I size={24} weight="duotone" /></div>; })}
      <span className="intro-ring" aria-hidden="true" />
      <Sparkle size={88} className="intro-big" />
      <div className="intro-mid">
        <div className="fu-in" style={{ animationDelay: '1.55s' }}><Wordmark size={56} /></div>
        <p className="fu-in intro-tag" style={{ animationDelay: '1.8s' }}>{APP.tagline}</p>
      </div>
    </div>
  );
}
