import { useEffect, useState } from 'react';

/**
 * Hash addresses (#/s/<save>/sims) so refreshing or sharing a link on GitHub Pages never 404s.
 * #style-guide and #app-settings are the older single-word pages and still work.
 */
export type Route =
  | { page: 'home' }
  | { page: 'setup' }
  | { page: 'account' }
  | { page: 'app-settings' }
  | { page: 'style-guide' }
  | { page: 'save'; saveId: string; section: string; rest: string[] };

export function parse(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === 'style-guide') return { page: 'style-guide' };
  if (h === 'app-settings' || h === '/app-settings') return { page: 'app-settings' };
  const parts = h.replace(/^\//, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'setup') return { page: 'setup' };
  if (parts[0] === 'account') return { page: 'account' };
  if (parts[0] === 's' && parts[1]) return { page: 'save', saveId: parts[1], section: parts[2] ?? '', rest: parts.slice(3) };
  return { page: 'home' };
}

export const savePath = (saveId: string, section = '') => `#/s/${encodeURIComponent(saveId)}${section ? `/${section}` : ''}`;

export function go(path: string, opts: { replace?: boolean } = {}) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (opts.replace) {
    history.replaceState(null, '', `${location.pathname}${location.search}${target}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash !== target) {
    location.hash = target;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => { setRoute(parse(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
