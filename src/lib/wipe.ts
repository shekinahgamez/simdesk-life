/**
 * The deck pick motion: the picked card rises and glides to the middle in one smooth move, then its color
 * ripples out in a circle to fill the screen. The page underneath changes while it's covered, then the color fades away.
 * Owner-approved timing: rise + glide 1s, ripple starts at 0.86s and takes 0.8s, fade 0.38s.
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function wait(a: Animation) {
  return new Promise<void>((resolve) => {
    a.onfinish = () => resolve();
    a.oncancel = () => resolve();
  });
}

/**
 * Runs the motion on `card` (currently drawn with `from` as its transform), then calls `navigate`
 * while the screen is covered, then reveals the new page.
 */
export async function pickCard(card: HTMLElement, from: string, navigate: () => void, opts: { alreadyCentered?: boolean; color?: string } = {}) {
  const color = opts.color ?? getComputedStyle(card).backgroundColor;
  const overlay = document.createElement('div');
  overlay.className = 'deck-wipe';
  overlay.style.background = color;
  overlay.setAttribute('aria-hidden', 'true');

  if (reduced() || typeof card.animate !== 'function') {
    document.body.appendChild(overlay);
    if (typeof overlay.animate === 'function') await wait(overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'forwards' }));
    navigate();
    await reveal(overlay);
    return;
  }

  card.style.zIndex = '60';
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  if (!opts.alreadyCentered) {
    // One smooth motion: rise gently, then glide to the middle, with no stop in between.
    // Where the card's layout box sits without any transform (offsets ignore transforms).
    const parent = (card.offsetParent as HTMLElement | null) ?? document.body;
    const pr = parent.getBoundingClientRect();
    const box = { left: pr.left + card.offsetLeft, top: pr.top + card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
    const dx = window.innerWidth / 2 - (box.left + box.width / 2);
    const dy = window.innerHeight / 2 - (box.top + box.height / 2);
    card.animate([
      { transform: from },
      { transform: `${from} translateY(-12px) scale(1.04)`, boxShadow: '0 22px 50px rgba(36,25,31,.2)', offset: 0.22 },
      { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.1)`, boxShadow: '0 30px 70px rgba(36,25,31,.26)' },
    ], { duration: 1000, easing: 'cubic-bezier(.45, .05, .25, 1)', fill: 'forwards' });
    // The ripple starts just before the card settles, so it flows straight on.
    await sleep(860);
  } else {
    await wait(card.animate([{ transform: from }, { transform: `${from} scale(1.06)`, boxShadow: '0 30px 70px rgba(36,25,31,.26)' }],
      { duration: 360, easing: 'cubic-bezier(.45, .05, .25, 1)', fill: 'forwards' }));
  }

  // Ripple fill: a soft-edged circle grows out of the card until it covers the screen.
  const r = card.getBoundingClientRect();
  const x = opts.alreadyCentered ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = opts.alreadyCentered ? r.top + r.height / 2 : window.innerHeight / 2;
  const R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 60;
  overlay.className = 'deck-ripple';
  Object.assign(overlay.style, { left: `${x}px`, top: `${y}px`, width: `${2 * R}px`, height: `${2 * R}px`, boxShadow: `0 0 60px 30px ${color}` });
  const s0 = (Math.min(r.width, r.height) * 0.45) / R;
  overlay.style.transform = `translate(-50%, -50%) scale(${s0})`;
  document.body.appendChild(overlay);
  await wait(overlay.animate([{ transform: `translate(-50%, -50%) scale(${s0})` }, { transform: 'translate(-50%, -50%) scale(1)' }],
    { duration: 800, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }));
  navigate();
  await reveal(overlay);
}

async function reveal(overlay: HTMLElement) {
  // Give the new page two frames to draw under the color, then fade the color away.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 80));
  if (typeof overlay.animate === 'function') await wait(overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' }));
  overlay.remove();
}
