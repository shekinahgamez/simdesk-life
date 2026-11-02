export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'sd:theme';

export function getTheme(): ThemePref {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'system';
  } catch {
    return 'system';
  }
}
export function applyTheme(t: ThemePref = getTheme()) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
}
