import { useState, type ReactNode } from 'react';
import { CaretLeft, Check, DeviceMobile, Moon, Sun, type Icon } from '@phosphor-icons/react';
import { getTheme, setTheme, type ThemePref } from '../lib/theme';
import { useIsPhone } from '../lib/useIsPhone';

/** Settings for the whole app (not one save): theme, plus account settings when signed in. */

const THEMES: { v: ThemePref; label: string; icon: Icon }[] = [
  { v: 'light', label: 'Light', icon: Sun },
  { v: 'dark', label: 'Dark', icon: Moon },
  { v: 'system', label: 'Match my device', icon: DeviceMobile },
];
const HELP = 'Light is the default. Match my device follows your phone, tablet or computer’s own setting. Saved on this device only.';

function ThemeRows({ value, onPick }: { value: ThemePref; onPick(v: ThemePref): void }) {
  return (
    <div className="m-group" role="radiogroup" aria-label="Theme">
      {THEMES.map(({ v, label, icon: I }) => (
        <button key={v} type="button" className="m-row" role="radio" aria-checked={value === v} onClick={() => onPick(v)}>
          <span className="obj berry"><I size={16} weight="duotone" /></span>
          <span className="t">{label}</span>
          {value === v && <Check className="theme-check" size={20} weight="bold" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

/** `extra`: account settings (only when signed in). `inShell`: drawn inside the app's own layout. */
export function AppSettings({ extra, inShell = false }: { extra?: ReactNode; inShell?: boolean } = {}) {
  const phone = useIsPhone();
  const [theme, setPref] = useState<ThemePref>(getTheme);
  const pick = (v: ThemePref) => {
    setTheme(v);
    setPref(v);
  };

  if (phone) {
    const inner = (
        <div className="m-stack">
          <a className="m-back" href="#/account"><CaretLeft size={20} weight="bold" /> Account</a>
          <h1 className="m-h1">App settings</h1>
          <div className="m-label">Theme</div>
          <ThemeRows value={theme} onPick={pick} />
          <div className="m-help">{HELP}</div>
          {extra}
        </div>
    );
    return inShell ? inner : <main className="m-main">{inner}</main>;
  }

  const page = (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="crumbs"><a href="#/account">Account</a> / App settings</div>
        <div className="page-head">
          <div>
            <h1>App settings</h1>
            <div className="sub">These apply to the whole app, not one save.</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Theme</h2></div>
          <ThemeRows value={theme} onPick={pick} />
          <p className="hint" style={{ margin: '10px 0 0' }}>{HELP}</p>
        </div>
        {extra}
      </div>
  );
  return inShell ? page : <main className="main">{page}</main>;
}
