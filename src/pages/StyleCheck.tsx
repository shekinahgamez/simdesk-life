import { useEffect, useState } from 'react';
import {
  ArrowLeft, Bell, CaretRight, Check, FastForward, Gear, House, MagnifyingGlass, Plus, Sparkle as SparkleIcon,
  Trash, User, X,
} from '@phosphor-icons/react';
import { APP } from '../config/app';
import { Sparkle, Wordmark } from '../components/brand';
import { CATEGORIES, ObjIcon } from '../components/categories';
import { effectiveTheme } from '../lib/theme';
import { SharedDemo } from '../demo/SharedDemo';
import { SavingDemo } from '../demo/SavingDemo';
import { startPretend } from './AccountScreens';
import { GameDataDemo } from '../demo/GameDataDemo';
import { TimeDemo } from '../demo/TimeDemo';

/**
 * Style check: one page with every color, font, button, field and icon, for checking the look on
 * iPad and iPhone. It is not part of the app and gets deleted before launch.
 */

const BASE_TOKENS: { name: string; v: string; use: string }[] = [
  { name: 'bg', v: '--bg', use: 'Page background' },
  { name: 'surface', v: '--surface', use: 'Cards, pop-ups' },
  { name: 'sidebar', v: '--sidebar', use: 'Desktop sidebar' },
  { name: 'text', v: '--text', use: 'Main text' },
  { name: 'muted', v: '--muted', use: 'Secondary text' },
  { name: 'line', v: '--line', use: 'Borders, dividers' },
  { name: 'accent (berry)', v: '--accent', use: 'Main buttons, active' },
  { name: 'accent-soft', v: '--accent-soft', use: 'Soft berry backgrounds' },
  { name: 'danger', v: '--danger', use: 'Delete' },
  { name: 'field', v: '--field', use: 'Input backgrounds' },
];

function useCssVar(name: string, theme: string) {
  const [v, setV] = useState('');
  useEffect(() => {
    setV(getComputedStyle(document.documentElement).getPropertyValue(name).trim().toUpperCase());
  }, [name, theme]);
  return v;
}

function Swatch({ name, v, use, theme }: { name: string; v: string; use: string; theme: string }) {
  const hex = useCssVar(v, theme);
  return (
    <div className="sc-sw">
      <div className="chip" style={{ background: `var(${v})` }} />
      <div className="lbl">
        <b>{name}</b>
        <code>{hex}</code>
        <div className="muted tiny">{use}</div>
      </div>
    </div>
  );
}

function SectionCard({ id, label, theme }: { id: (typeof CATEGORIES)[number]['id']; label: string; theme: string }) {
  const tint = useCssVar(`--${id}-tint`, theme);
  const ink = useCssVar(`--${id}-ink`, theme);
  return (
    <div className="sc-sec" style={{ background: `var(--${id}-tint)`, color: `var(--${id}-ink)` }}>
      <div className="nm">
        <ObjIcon cat={id} size="lg" />
        {label}
      </div>
      <code>tint {tint} · ink {ink}</code>
      <div className="tags">
        <span className={`tag ${id}`} style={{ background: 'var(--surface)' }}>Tag on white</span>
      </div>
    </div>
  );
}

export function StyleCheck() {
  // Color codes are read for whichever theme is showing (set on the App settings page).
  const theme = effectiveTheme();
  const [toggle, setToggle] = useState(true);
  const [seg, setSeg] = useState('Normal');
  const [mseg, setMseg] = useState(0);
  const [chip, setChip] = useState('All');

  return (
    <main className="sc">
      <div className="sc-head">
        <div className="stack" style={{ gap: 8 }}>
          <Wordmark size={44} />
          <div className="muted">{APP.tagline}</div>
        </div>
        <div className="row">
          <a className="btn" href="#">Back</a>
          <a className="btn" href="#app-settings"><Gear size={18} weight="duotone" /> App settings</a>
        </div>
      </div>

      <div className="sc-note">
        <b>Style check.</b> This page shows every color, font, button, field and icon so you can check them on iPad and
        iPhone. It isn’t part of the app and goes away before launch. Switch between light and dark on the App settings page.
      </div>

      <section>
        <h2>Try the app (Phase 2)</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Opens the real app with a pretend account kept in this browser: new save setup, the deck, the sidebar and tabs, and Save settings. Leave it from Account.</p>
        <div><button type="button" className="btn primary" onClick={startPretend}>Try the app with a pretend account</button></div>
      </section>

      <TimeDemo />

      <GameDataDemo />

      <SavingDemo />

      <SharedDemo />

      <section>
        <h2>Colors</h2>
        <p className="sc-why">The values shown are read live from the page, so they change when you flip to Dark.</p>
        <div className="sc-swatches">
          {BASE_TOKENS.map((t) => (
            <Swatch key={t.v} {...t} theme={theme} />
          ))}
        </div>
      </section>

      <section>
        <h2>Section colors</h2>
        <p className="sc-why">Each section’s tint (background) and ink (icon and text).</p>
        <div className="sc-sections">
          {CATEGORIES.map((c) => (
            <SectionCard key={c.id} id={c.id} label={c.label} theme={theme} />
          ))}
        </div>
      </section>

      <section>
        <h2>Fonts</h2>
        <p className="sc-why">Gabarito for headings, Rethink Sans for everything else.</p>
        <div className="card stack">
          <div className="m-h1">Phone page title 34</div>
          <h1>Desktop page title 30</h1>
          <h2>Card heading 18</h2>
          <h3>Small heading 15</h3>
          <div style={{ fontSize: 17 }}>Phone body text 17. The quick brown fox jumps over the lazy llama.</div>
          <div>Desktop body text 15. The quick brown fox jumps over the lazy llama.</div>
          <div className="muted">Muted text for secondary details.</div>
          <div className="small muted">Small text 13 · Year 1 · Spring · Day 8</div>
          <div className="m-label">Phone group label</div>
        </div>
      </section>

      <section>
        <h2>Corners and shadows</h2>
        <div className="sc-shapes">
          <div className="sc-shape" style={{ borderRadius: 'var(--r-sm)' }}>Small corners 10</div>
          <div className="sc-shape" style={{ borderRadius: 'var(--r)' }}>Normal corners 14</div>
          <div className="sc-shape" style={{ borderRadius: 'var(--r-lg)' }}>Large corners 18</div>
          <div className="sc-shape" style={{ borderRadius: 'var(--r-xl)' }}>Extra-large 26</div>
          <div className="sc-shape" style={{ borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)' }}>Small shadow</div>
          <div className="sc-shape" style={{ borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow)' }}>Normal shadow</div>
          <div className="sc-shape" style={{ borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)' }}>Large shadow</div>
        </div>
      </section>

      <div className="sc-two">
        <section>
          <h2>Desktop buttons</h2>
          <div className="stack" style={{ marginTop: 12 }}>
            <div className="row">
              <button className="btn primary"><Plus size={16} weight="bold" /> Main button</button>
              <button className="btn">Normal</button>
              <button className="btn ghost">Ghost</button>
            </div>
            <div className="row">
              <button className="btn danger"><Trash size={16} weight="duotone" /> Delete</button>
              <button className="btn" disabled>Disabled</button>
              <button className="btn icon" aria-label="Close"><X size={18} weight="bold" /></button>
            </div>
            <div className="row">
              <button className="btn primary sm">Small</button>
              <button className="btn primary lg">Large</button>
            </div>
          </div>
        </section>

        <section>
          <h2>Phone buttons</h2>
          <div className="sc-phone" style={{ marginTop: 12 }}>
            <button className="m-bigbtn"><FastForward size={20} weight="duotone" /> Big button</button>
            <button className="m-softbtn">Soft button</button>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button className="m-circlebtn" aria-label="Back"><ArrowLeft size={22} weight="bold" /></button>
              <button className="m-pillbtn">Pill button</button>
            </div>
            <div className="row">
              <button className="m-fab sc-fab" aria-label="Add"><Plus size={26} weight="bold" /></button>
              <span className="small muted">Floating + button</span>
            </div>
          </div>
        </section>
      </div>

      <section>
        <h2>Fields</h2>
        <p className="sc-why">
          All text is 16px or bigger so iPhone and iPad don’t zoom in. The name fields have autocorrect off and capitalize
          each word, so try typing a name.
        </p>
        <div className="card">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="sc-first">First name</label>
              <input id="sc-first" className="input" autoCapitalize="words" autoCorrect="off" spellCheck={false} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="sc-last">Last name</label>
              <input id="sc-last" className="input" autoCapitalize="words" autoCorrect="off" spellCheck={false} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="sc-sel">Dropdown</label>
              <select id="sc-sel" className="select" defaultValue="b">
                <option value="a">First choice</option>
                <option value="b">Second choice</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sc-ph">With placeholder</label>
              <input id="sc-ph" className="input" placeholder="Placeholder text" />
              <div className="hint">Hint text under a field.</div>
            </div>
            <div className="field full">
              <label htmlFor="sc-notes">Notes</label>
              <textarea id="sc-notes" className="textarea" />
            </div>
            <div className="field full">
              <label htmlFor="sc-search">Desktop search</label>
              <div className="search" style={{ maxWidth: 'none' }}>
                <MagnifyingGlass size={16} />
                <input id="sc-search" className="input" placeholder="Search" type="search" />
              </div>
            </div>
          </div>
          <div className="divider" />
          <div className="stack">
            <div className="label">Choice buttons</div>
            <div className="seg" role="group" aria-label="Example choice">
              {['Short', 'Normal', 'Long', 'Custom'].map((o) => (
                <button key={o} type="button" aria-pressed={seg === o} onClick={() => setSeg(o)}>{o}</button>
              ))}
            </div>
            <div className="label">Filter chips</div>
            <div className="chip-filter">
              {['All', 'Living', 'Deceased'].map((o) => (
                <button key={o} type="button" aria-pressed={chip === o} onClick={() => setChip(o)}>{o}</button>
              ))}
            </div>
            <div className="label">Tags</div>
            <div className="tags">
              <span className="tag">Plain</span>
              <span className="tag berry">Berry</span>
              <span className="tag outline">Coming soon</span>
              <span className="tag secret">Secret</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Phone list style</h2>
        <p className="sc-why">The big rounded groups used on phones, like iOS Settings.</p>
        <div className="sc-phone">
          <div className="m-search">
            <MagnifyingGlass size={18} />
            <input placeholder="Phone search" type="search" aria-label="Phone search" />
          </div>
          <div className="m-seg" role="tablist" aria-label="Example switch">
            {['First', 'Second'].map((o, i) => (
              <button key={o} role="tab" aria-selected={mseg === i} onClick={() => setMseg(i)}>{o}</button>
            ))}
          </div>
          <div className="m-label">Group label</div>
          <div className="m-group">
            <div className="m-row">
              <span className="t">A switch</span>
              <span style={{ marginLeft: 'auto' }}>
                <button type="button" className="toggle" aria-pressed={toggle} aria-label="A switch" onClick={() => setToggle(!toggle)}>
                  <span />
                </button>
              </span>
            </div>
            <button className="m-row" type="button">
              <span className="t">A row with a value</span>
              <span className="v">Value</span>
              <CaretRight className="chev" size={18} weight="bold" />
            </button>
            <div className="m-row">
              <div>
                <div className="t">Two-line row</div>
                <div className="s">Smaller line underneath</div>
              </div>
              <span className="tag outline" style={{ marginLeft: 'auto' }}>Coming soon</span>
            </div>
            <button className="m-row" type="button" style={{ color: 'var(--danger)' }}>
              <span className="t">Delete row</span>
            </button>
          </div>
          <div className="m-help">Help text under a group.</div>
        </div>
      </section>

      <section>
        <h2>Icons</h2>
        <p className="sc-why">Phosphor icons, duotone.</p>
        <div className="sc-icons">
          {[User, House, FastForward, Bell, Gear, Check, Trash, MagnifyingGlass, SparkleIcon].map((I, i) => (
            <I key={i} size={32} weight="duotone" />
          ))}
          <Sparkle size={32} />
        </div>
      </section>

      <section>
        <h2>Saving dots</h2>
        <div className="row small">
          <span className="sync-dot" /> Saved
          <span className="sync-dot saving" style={{ marginLeft: 12 }} /> Saving…
          <span className="sync-dot error" style={{ marginLeft: 12 }} /> Couldn’t save
        </div>
      </section>
    </main>
  );
}
