import { useRef, type ReactNode } from 'react';

/** The pinned slim top bar on phones: title, optional back, and icon actions. */
export function PhoneBar({ title, left, right }: { title: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="m-bar">
      {left}
      <h1 className="ttl">{title}</h1>
      <span className="m-bar-r">{right}</span>
    </div>
  );
}

/** First letter of a name for the A–Z headers ("The 4Ever House" files under 4, which is "#"). */
export function letterOf(name: string): string {
  const c = name.replace(/^(the|a|an)\s+/i, '').trim()[0]?.toUpperCase() ?? '#';
  return /[A-Z]/.test(c) ? c : '#';
}
/** Sort key that ignores a leading "The" and puts digits first. */
export function azKey(name: string): string {
  const k = name.replace(/^(the|a|an)\s+/i, '').trim().toLowerCase();
  return (/^[a-z]/.test(k) ? '1' : '0') + k;
}
const idOf = (l: string) => `az-${l === '#' ? 'num' : l}`;

export function AzHeader({ letter }: { letter: string }) {
  return <div className="az-h" id={idOf(letter)} role="presentation">{letter}</div>;
}

/** The A–Z strip on the right edge: tap or drag a thumb along it to jump to a letter. */
export function AzRail({ letters }: { letters: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef('');
  if (letters.length < 2) return null;
  const jump = (y: number) => {
    const box = ref.current!.getBoundingClientRect();
    const i = Math.min(letters.length - 1, Math.max(0, Math.floor(((y - box.top) / box.height) * letters.length)));
    const l = letters[i];
    if (l === last.current) return;
    last.current = l;
    document.getElementById(idOf(l))?.scrollIntoView({ block: 'start' });
  };
  return (
    <div ref={ref} className="az-rail" role="group" aria-label="Jump to letter"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = ''; jump(e.clientY); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') jump(e.clientY); }}>
      {letters.map((l) => <span key={l} aria-hidden="true">{l}</span>)}
    </div>
  );
}
