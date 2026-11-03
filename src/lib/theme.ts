/**
 * Theme: Light (the default for everyone), Dark, or Match my device.
 * Saved on this device only. index.html applies it before anything draws, so the app never flashes
 * or comes back in the wrong theme after Safari reloads the page.
 */
export type ThemePref = 'light' | 'dark' | 'system';
export const THEME_KEY = 'sd:theme';
const BG = { light: '#FBF9F7', dark: '#1A1418' };
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

/** Which colors are showing right now. */
export function effectiveTheme(pref: ThemePref = getTheme()): 'light' | 'dark' {
  return pref === 'system' ? (darkQuery().matches ? 'dark' : 'light') : pref;
}

function paint(pref: ThemePref) {
  document.documentElement.setAttribute('data-sd-theme', pref);
  // The browser bar / status bar color follows the page.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[effectiveTheme(pref)]);
}

export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* private mode: still applies for this visit */
  }
  paint(pref);
}

/** Call once at start-up. Keeps the bar color right when the device switches light/dark. */
export function startTheme() {
  paint(getTheme());
  darkQuery().addEventListener('change', () => paint(getTheme()));
}
