/**
 * Tap ripple (owner-approved): pressing anything tappable grows a soft circle from your finger that
 * fades away, kept inside the thing's rounded shape. Replaces the phone's gray tap rectangle.
 * One listener for the whole app; the list below says what gets it.
 */
const TAPPABLE = [
  '.btn', '.m-row', '.m-pillbtn', '.m-fab', '.fchip', '.place-pill', '.seg button', '.m-seg button', '.tabs button',
  '.world-tile', '.place-world', '.spot-row', '.sim-card', '.deck-card', '.ms-dcard', '.pk', '.ms-pk',
  '.lot-photo', '.sim-hero-photo', '.photo-drop', '.m-savechip', '.nav-link',
].join(',');

export function startRipples() {
  if (typeof document === 'undefined') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = (e.target as Element | null)?.closest?.(TAPPABLE) as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('soon')) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const d = 2 * Math.max(Math.hypot(x, y), Math.hypot(r.width - x, y), Math.hypot(x, r.height - y), Math.hypot(r.width - x, r.height - y));
    // A clipping layer that takes the thing's rounded corners, so the circle never spills out.
    const clip = document.createElement('span');
    clip.className = 'rip-clip';
    clip.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('span');
    dot.className = reduced.matches ? 'rip still' : 'rip';
    Object.assign(dot.style, { left: `${x}px`, top: `${y}px`, width: `${d}px`, height: `${d}px` });
    clip.appendChild(dot);
    el.appendChild(clip);
    const done = () => {
      window.removeEventListener('pointerup', done);
      window.removeEventListener('pointercancel', done);
      dot.classList.add('out');
      window.setTimeout(() => clip.remove(), 650);
    };
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  }, { passive: true });
}

