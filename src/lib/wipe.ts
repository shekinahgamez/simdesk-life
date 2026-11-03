/**
 * The deck pick motion: the picked card lifts, glides to the middle of the screen, then its color
 * fills the whole screen. The page underneath changes while it's covered, then the color fades away.
 * Owner-approved timing: lift ~0.2s, glide ~0.4s, fill ~0.45s, smooth ease-in/out.
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.45, 0, .2, 1)';

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

  const lifted = `${from} translateY(-16px) scale(1.06)`;
  card.style.zIndex = '60';
  await wait(card.animate([{ transform: from }, { transform: lifted, boxShadow: '0 24px 60px rgba(36,25,31,.28)' }],
    { duration: 200, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' }));

  let centered = lifted;
  if (!opts.alreadyCentered) {
    // Where the card's layout box sits without any transform (offsets ignore transforms).
    const parent = (card.offsetParent as HTMLElement | null) ?? document.body;
    const pr = parent.getBoundingClientRect();
    const box = { left: pr.left + card.offsetLeft, top: pr.top + card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
    const dx = window.innerWidth / 2 - (box.left + box.width / 2);
    const dy = window.innerHeight / 2 - (box.top + box.height / 2);
    centered = `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.12)`;
    await wait(card.animate([{ transform: lifted }, { transform: centered, boxShadow: '0 30px 70px rgba(36,25,31,.3)' }],
      { duration: 420, easing: EASE, fill: 'forwards' }));
  }

  // Color fill: grows from the card's exact edges to the whole screen.
  const r = card.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 22;
  const inset = (t: number, rt: number, b: number, l: number, rad: number) => `inset(${t}px ${rt}px ${b}px ${l}px round ${rad}px)`;
  const start = inset(r.top, window.innerWidth - r.right, window.innerHeight - r.bottom, r.left, radius * 1.12);
  overlay.style.clipPath = start;
  document.body.appendChild(overlay);
  await wait(overlay.animate([{ clipPath: start }, { clipPath: inset(0, 0, 0, 0, 0) }], { duration: 460, easing: 'cubic-bezier(.7, 0, .3, 1)', fill: 'forwards' }));
  overlay.style.clipPath = 'none';
  navigate();
  await reveal(overlay);
}

async function reveal(overlay: HTMLElement) {
  // Give the new page two frames to draw under the color, then fade the color away.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 80));
  if (typeof overlay.animate === 'function') await wait(overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' }));
  overlay.remove();
}
