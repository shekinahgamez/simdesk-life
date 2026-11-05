import { useEffect, useState, type ReactNode } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { BANNER_NAMES } from './bannerIds';

type Art = Record<string, string>;
let cache: Art | null = null;
let pending = false;
const subs = new Set<() => void>();
/** The banner art is big, so it loads the first time a banner is shown. */
function useArt(): Art | null {
  const [art, setArt] = useState<Art | null>(cache);
  useEffect(() => {
    if (cache) { setArt(cache); return; }
    const on = () => setArt(cache);
    subs.add(on);
    if (!pending) {
      pending = true;
      import('./bannerData').then((m) => { cache = m.BANNER_SVG; subs.forEach((f) => f()); }).catch(() => { pending = false; });
    }
    return () => { subs.delete(on); };
  }, []);
  return art;
}

/** One banner picture, filling its box. */
export function BannerScene({ id }: { id: string }) {
  const art = useArt();
  return <svg viewBox="-400 0 1200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art?.[id] ?? '' }} />;
}

/** A themed header: the picture, the soft melt, and whatever goes on top (title, buttons). Uses the season banner's look. */
export function ThemedBanner({ art, className = '', children }: { art: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`season-banner themed ${className}`}>
      <BannerScene id={art} />
      <div className="season-banner-in">{children}</div>
    </div>
  );
}

const SHOWN = 8;
/** Pick a banner by looking at it (no names shown; each has a label for screen readers). Shows a few, the rest under More. */
export function BannerPicker({ ids, value, onChange, label }: { ids: readonly string[]; value: string; onChange(id: string): void; label: string }) {
  const [more, setMore] = useState(false);
  const picked = ids.indexOf(value);
  // collapsed: the first few, with the chosen one always showing
  const list = more || ids.length <= SHOWN ? ids : picked >= SHOWN ? [...ids.slice(0, SHOWN - 1), value] : ids.slice(0, SHOWN);
  return (
    <div className="banner-pick" role="radiogroup" aria-label={label}>
      {list.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} aria-label={BANNER_NAMES[id] ?? id} className={`banner-th ${value === id ? 'on' : ''}`} onClick={() => onChange(id)}>
          <BannerScene id={id} />
        </button>
      ))}
      {ids.length > SHOWN && (
        <button type="button" className="banner-more" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? <>Fewer <CaretUp size={12} weight="bold" /></> : <>More banners <CaretDown size={12} weight="bold" /></>}
        </button>
      )}
    </div>
  );
}
