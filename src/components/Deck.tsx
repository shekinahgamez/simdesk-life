import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { CaretLeft, CaretRight, type Icon } from '@phosphor-icons/react';
import { pickCard } from '../lib/wipe';
import type { CategoryId } from './categories';

/** `built: false` grays the card out with "Coming soon" and it can't be picked. */
export type DeckCard = { id: CategoryId; label: string; icon: Icon; text: string; live?: string; built?: boolean };

const SOON = 'Coming soon';

/**
 * Desktop deck: cards fanned out in an arc. `setup` shuffles first (the end of new save setup);
 * `home` fans in quickly (the desktop home page). Picking a card lifts it, glides it to the middle,
 * fills the screen with its color, then opens that section.
 */
export function DesktopDeck({ cards, mode, onPick }: { cards: DeckCard[]; mode: 'setup' | 'home'; onPick(id: CategoryId): void }) {
  const [picked, setPicked] = useState<CategoryId | null>(null);
  const n = cards.length;
  const mid = (n - 1) / 2;
  const spread = Math.min(200, (Math.min(window.innerWidth - (mode === 'home' ? 380 : 120), 1100) - 200) / Math.max(1, n - 1));
  const fan = (i: number) => {
    const off = i - mid;
    return { fx: off * spread, fy: Math.abs(off) * Math.abs(off) * 9, fr: off * 4, off };
  };
  return (
    <div className={`deck ${mode === 'home' ? 'home' : ''} ${picked ? 'picking' : ''}`}>
      {cards.map((c, i) => {
        const f = fan(i);
        const I = c.icon;
        return (
          <button key={c.id} type="button" className={`deck-card ${picked === c.id ? 'picked' : ''} ${c.built === false ? 'soon' : ''}`} disabled={!!picked}
            aria-disabled={c.built === false || undefined} aria-label={c.built === false ? `${c.label}. ${SOON}` : undefined}
            style={{
              background: `var(--${c.id}-tint)`, color: 'var(--text)', zIndex: i,
              ['--d' as string]: `${i * 0.05}s`, ['--s' as string]: String(f.off / Math.max(1, mid)),
              ['--fx' as string]: `${f.fx}px`, ['--fy' as string]: `${f.fy}px`, ['--fr' as string]: `${f.fr}deg`,
            }}
            onClick={(e) => {
              if (c.built === false) return;
              const el = e.currentTarget;
              setPicked(c.id);
              void pickCard(el, `translate(${f.fx}px, ${f.fy}px) rotate(${f.fr}deg)`, () => onPick(c.id));
            }}>
            <span className="ico" style={{ color: `var(--${c.id}-ink)` }}><I size={26} weight="duotone" /></span>
            <span className="stack" style={{ gap: 6 }}>
              <h3>{c.label}</h3>
              {c.live && <span className="live" style={{ color: `var(--${c.id}-ink)` }}>{c.live}</span>}
              <p>{c.text}</p>
            </span>
            {c.built === false && <span className="soon-tag">{SOON}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Phone deck: a stack of cards you flip through like a real deck. Swipe left and the top card flies
 * off the screen; swipe right and the last card you threw away comes back from the left. It loops.
 * Tap the top card (or the button) to open it. Cards that aren't built yet are gray and can't be opened.
 */
export function PhoneDeck({ cards, onPick, button = true }: { cards: DeckCard[]; onPick(id: CategoryId): void; button?: boolean }) {
  const n = cards.length;
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState<{ i: number; stage: 'out' | 'tuck' | 'in' | 'land' | 'retreat' } | null>(null);
  const [picked, setPicked] = useState<CategoryId | null>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const touch = useRef<{ x: number; y: number; t: number; axis?: 'x' | 'y' } | null>(null);
  const timers = useRef<number[]>([]);
  const dragged = useRef(false); // any drag cancels the tap that follows it
  useEffect(() => { setOrder(cards.map((_, i) => i)); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const top = order[0] ?? 0;
  const cur = cards[top];
  const busy = !!moving || !!picked;

  // Swipe left: the top card flies off the screen, then slips to the bottom of the pile out of sight.
  const next = () => {
    if (busy || n < 2) return;
    const i = order[0];
    if (reduced) { setOrder((o) => [...o.slice(1), o[0]]); return; }
    setMoving({ i, stage: 'out' });
    later(() => { setOrder((o) => [...o.slice(1), o[0]]); setMoving({ i, stage: 'tuck' }); }, 260);
    later(() => setMoving(null), 320);
  };
  // Swipe right: the card you last threw away comes back from the left, where it went, and lands on
  // top. It's the fly-out played backwards. Nothing underneath moves.
  const prev = (fromDrag = false) => {
    if (busy || n < 2) return;
    const i = order[n - 1];
    if (reduced) { setOrder((o) => [o[n - 1], ...o.slice(0, n - 1)]); return; }
    if (fromDrag) setMoving({ i, stage: 'land' });
    else {
      setMoving({ i, stage: 'in' });
      requestAnimationFrame(() => requestAnimationFrame(() => setMoving({ i, stage: 'land' })));
    }
    later(() => { setOrder((o) => [o[n - 1], ...o.slice(0, n - 1)]); setMoving(null); }, 440);
  };
  // A right drag that wasn't far enough: the card goes back off to the left.
  const retreat = () => {
    const i = order[n - 1];
    setMoving({ i, stage: 'retreat' });
    later(() => setMoving(null), 280);
  };
  const open = (c: DeckCard) => {
    const el = refs.current[c.id];
    if (!el || busy || c.built === false) return;
    setPicked(c.id);
    const art = el.querySelector('.art');
    const color = art ? getComputedStyle(art).backgroundColor : undefined;
    void pickCard(el, 'translate(0px, 0px)', () => onPick(c.id), { alreadyCentered: true, color });
  };

  const down = (e: RPointerEvent) => {
    if (busy) return;
    dragged.current = false;
    touch.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const move = (e: RPointerEvent) => {
    const s = touch.current;
    if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.axis && Math.hypot(mx, my) > 8) {
      s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      dragged.current = true;
      if (s.axis === 'x') { setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }
    }
    if (s.axis === 'x') setDx(mx);
  };
  const up = (e: RPointerEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    if (s.axis !== 'x') { setDragging(false); setDx(0); return; }
    const mx = e.clientX - s.x;
    const v = mx / Math.max(1, performance.now() - s.t);
    setDragging(false);
    setDx(0);
    if (mx < -70 || v < -0.45) next();
    else if (mx > 70 || v > 0.45) prev(true);
    else if (mx > 0 && n > 1 && !reduced) retreat();
  };

  // Every card sits in the same spot; only the top two are drawn. The edges peeking out below are fixed.
  const OFF = 'translateX(-120vw) rotate(-14deg)';
  const fly = 'transform .26s cubic-bezier(.4,0,.9,.6)'; // leaving: speeds up as it goes
  const land = 'transform .42s cubic-bezier(.2,.6,.35,1)'; // coming back: a touch slower, so it feels the same speed as leaving
  const back = order[n - 1];
  const styleFor = (i: number): CSSProperties => {
    const depth = order.indexOf(i);
    const base: CSSProperties = { zIndex: n - depth + 2, opacity: depth > 1 ? 0 : 1, transform: 'none', transition: 'transform .3s cubic-bezier(.3,.8,.3,1)' };
    const on = (stage: string) => moving?.i === i && moving.stage === stage;
    if (on('out')) return { ...base, zIndex: n + 3, opacity: 1, transform: OFF, transition: fly };
    if (on('tuck')) return { ...base, transition: 'none' };
    if (on('in')) return { ...base, zIndex: n + 3, opacity: 1, transform: OFF, transition: 'none' };
    if (on('land')) return { ...base, zIndex: n + 3, opacity: 1, transform: 'none', transition: land };
    if (on('retreat')) return { ...base, zIndex: n + 3, opacity: 1, transform: OFF, transition: fly };
    if (dragging && dx > 0 && i === back && n > 1) {
      // Dragging right pulls the thrown-away card back in from the left with your finger.
      const w = typeof window !== 'undefined' ? window.innerWidth : 400;
      const p = Math.min(1, (dx * 2) / (w * 1.2));
      return { ...base, zIndex: n + 3, opacity: 1, transform: `translateX(${-(1 - p) * 120}vw) rotate(${-(1 - p) * 14}deg)`, transition: 'none' };
    }
    if (depth === 0 && dragging && dx < 0) return { ...base, transform: `translateX(${dx}px) rotate(${dx / 22}deg)`, transition: 'none' };
    return base;
  };

  return (
    <div className="stack" style={{ gap: 0 }}>
      <div className="ms-stack" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="group" aria-roledescription="deck" aria-label={`Card ${order.indexOf(top) + 1}: ${cur?.label ?? ''}`}>
        <span className="ms-peek two" aria-hidden="true" />
        <span className="ms-peek one" aria-hidden="true" />
        {cards.map((c, i) => {
          const I = c.icon;
          const isTop = order[0] === i;
          const soon = c.built === false;
          return (
            <button key={c.id} type="button" ref={(el) => { refs.current[c.id] = el; }} className={`ms-dcard ${soon ? 'soon' : ''}`} style={styleFor(i)}
              tabIndex={isTop ? 0 : -1} aria-hidden={!isTop} aria-disabled={soon || undefined}
              onClick={() => { if (isTop && !dragged.current) open(c); }} aria-label={soon ? `${c.label}. ${SOON}` : `${c.label}. ${c.live ?? c.text}`}>
              <span className="art" style={soon ? undefined : { background: `var(--${c.id}-tint)`, color: `var(--${c.id}-ink)` }}><I size={64} weight="duotone" /></span>
              <h3>{c.label}</h3>
              {soon ? <span className="soon-tag">{SOON}</span> : c.live && <span className="small bold" style={{ color: `var(--${c.id}-ink)` }}>{c.live}</span>}
              <span className="small muted">{c.text}</span>
            </button>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 14, flexWrap: 'nowrap' }}>
        <button type="button" className="ms-flip" onClick={() => prev()} disabled={busy || n < 2} aria-label="Previous card"><CaretLeft size={18} weight="bold" /></button>
        <div className="m-dots dark" aria-hidden="true">{order.map((_, k) => <span key={k} className={k === top ? 'on' : ''} />)}</div>
        <button type="button" className="ms-flip" onClick={next} disabled={busy || n < 2} aria-label="Next card"><CaretRight size={18} weight="bold" /></button>
      </div>
      {button && cur && (
        <div className="ms-bar">
          {cur.built === false
            ? <button type="button" className="m-pillbtn soon" disabled>{SOON}</button>
            : <button type="button" className="m-pillbtn" onClick={() => open(cur)} disabled={busy}>Start with {cur.label}</button>}
        </div>
      )}
    </div>
  );
}
