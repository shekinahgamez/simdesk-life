import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CalendarBlank, CaretLeft, CaretRight, CaretUpDown, Check, DotsThreeCircle, GearSix, GlobeHemisphereWest, House, Plus, Sparkle as SparkleIcon, User, UserCircle,
  ArrowsClockwise, Crown, Notebook, Storefront,
} from '@phosphor-icons/react';
import { Wordmark } from './brand';
import { needsPack, ObjIcon, SECTIONS } from './categories';
import { SyncCloud, SyncLine } from './sync';
import { Sheet } from './ui';
import { useLayer } from '../lib/layers';
import { go, savePath, type Route } from '../lib/router';
import { moduleOn, saveData, todayOf } from '../lib/saves';
import { DateSheet, NextDayButton } from './DayMove';
import { CommandHost, QuickButton, SideSearch } from './CommandBar';
import { useSaves } from '../lib/sync/react';
import type { SaveRow } from '../lib/sync/types';
import { formatDate, SEASONS } from '../lib/time';
import { useIsPhone } from '../lib/useIsPhone';

/** The frame around every page inside the app: sidebar on desktop, tabs on phones. */
export function Shell({ save, route, children }: { save: SaveRow | null; route: Route; children: ReactNode }) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <>
        <main className="m-main">{children}</main>
        {save && <TabBar saveId={save.id} route={route} />}
        {save && <CommandHost save={save} />}
      </>
    );
  }
  return (
    <div className="app">
      <Sidebar save={save} route={route} />
      <main className="main">{children}</main>
      {save && <CommandHost save={save} />}
    </div>
  );
}

function Sidebar({ save, route }: { save: SaveRow | null; route: Route }) {
  const d = save ? saveData(save) : null;
  const section = route.page === 'save' ? (route.section === 'households' ? 'sims' : route.section) : route.page;
  const cats = d ? SECTIONS.filter((c) => (!c.module || moduleOn(d, c.module)) && needsPack(c, d.packs)) : [];
  return (
    <nav className="sidebar" aria-label="Main">
      <a href="#/" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', textDecoration: 'none' }} aria-label="SimDesk home">
        <Wordmark size={24} />
      </a>
      {save && d && <SaveSwitcher save={save} />}
      {save && d?.trackDate && <NextDayButton save={save} className="btn sm side-nextday" />}
      {save && <SideSearch />}
      {save && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {cats.map((c) => (
            <a key={c.id} href={savePath(save.id, c.path)} className={`nav-link ${section === c.path ? 'active' : ''}`} aria-current={section === c.path ? 'page' : undefined}>
              <ObjIcon cat={c.id} /> {c.label}
            </a>
          ))}
          {d && moduleOn(d, 'rotation') && (
            <a href={savePath(save.id, 'rotation')} className={`nav-link ${section === 'rotation' ? 'active' : ''}`} aria-current={section === 'rotation' ? 'page' : undefined}>
              <span className="obj rotation" aria-hidden="true"><ArrowsClockwise size={16} weight="duotone" /></span> Rotation
            </a>
          )}
          {d && moduleOn(d, 'venues') && (
            <a href={savePath(save.id, 'businesses')} className={`nav-link ${section === 'businesses' ? 'active' : ''}`} aria-current={section === 'businesses' ? 'page' : undefined}>
              <span className="obj businesses" aria-hidden="true"><Storefront size={16} weight="duotone" /></span> Businesses
            </a>
          )}
          {d && moduleOn(d, 'journal') && (
            <a href={savePath(save.id, 'docs')} className={`nav-link ${section === 'docs' ? 'active' : ''}`} aria-current={section === 'docs' ? 'page' : undefined}>
              <span className="obj docs" aria-hidden="true"><Notebook size={16} weight="duotone" /></span> Docs
            </a>
          )}
          {d && moduleOn(d, 'legacy') && (
            <a href={savePath(save.id, 'legacy')} className={`nav-link ${section === 'legacy' ? 'active' : ''}`} aria-current={section === 'legacy' ? 'page' : undefined}>
              <span className="obj legacy" aria-hidden="true"><Crown size={16} weight="duotone" /></span> Legacy
            </a>
          )}
        </div>
      )}
      <span className="grow" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {save && (
          <a href={savePath(save.id, 'settings')} className={`nav-link ${section === 'settings' ? 'active' : ''}`} aria-current={section === 'settings' ? 'page' : undefined}>
            <span className="obj berry" aria-hidden="true"><GearSix size={16} weight="duotone" /></span> Save settings
          </a>
        )}
        <a href="#/account" className={`nav-link ${section === 'account' ? 'active' : ''}`} aria-current={section === 'account' ? 'page' : undefined}>
          <span className="obj berry" aria-hidden="true"><UserCircle size={16} weight="duotone" /></span> Account
        </a>
        <div style={{ padding: '8px 10px' }}><SyncLine /></div>
      </div>
    </nav>
  );
}

/** Desktop save switcher. Closes on a click elsewhere or Escape (v1's didn't). */
function SaveSwitcher({ save }: { save: SaveRow }) {
  const { active } = useSaves();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const d = saveData(save);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="save-switch" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <span className="save-dot" style={{ background: d.color }} aria-hidden="true" />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="save-switch-name">{d.name}</span>
          <span className="save-switch-date">{d.trackDate ? formatDate(todayOf(d)) : 'Date tracking off'}</span>
        </span>
        <CaretUpDown size={16} className="muted" />
      </button>
      {open && <SwitcherMenu current={save.id} saves={active} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SwitcherMenu({ current, saves, onClose }: { current: string; saves: SaveRow[]; onClose(): void }) {
  useLayer(onClose);
  return (
    <div className="combo-list" style={{ position: 'absolute' }} role="menu">
      {saves.map((s) => {
        const d = saveData(s);
        return (
          <button key={s.id} type="button" role="menuitem" onClick={() => { onClose(); go(savePath(s.id)); }}>
            <span className="save-dot" style={{ background: d.color }} aria-hidden="true" />
            <span className="grow">{d.name}</span>
            {s.id === current && <Check size={14} weight="bold" />}
          </button>
        );
      })}
      <button type="button" role="menuitem" onClick={() => { onClose(); go('#/setup'); }}><Plus size={14} weight="bold" /> New save</button>
    </div>
  );
}

// ---------- phone ----------
const TABS = [
  { id: 'today', label: 'Today', icon: House, ink: 'var(--accent)', tint: 'var(--accent-soft)' },
  { id: 'sims', label: 'Sims', icon: User, ink: 'var(--sims-ink)', tint: 'var(--sims-tint)' },
  { id: 'calendar', label: 'Calendar', icon: CalendarBlank, ink: 'var(--calendar-ink)', tint: 'var(--calendar-tint)' },
  { id: 'worlds', label: 'Worlds', icon: GlobeHemisphereWest, ink: 'var(--worlds-ink)', tint: 'var(--worlds-tint)' },
  { id: 'more', label: 'More', icon: DotsThreeCircle, ink: 'var(--muted)', tint: 'color-mix(in srgb, var(--text) 8%, transparent)' },
] as const;

/** Floating foggy tab pill. Each tab wears its section color; the open one gets a filled icon on a soft bubble. Lots count as Worlds, Households as Sims; Clubs, Settings and Account count as More. */
function TabBar({ saveId, route }: { saveId: string; route: Route }) {
  const section = route.page === 'save' ? route.section || 'today' : 'more';
  const tab = section === 'lots' ? 'worlds' : section === 'households' ? 'sims' : ['today', 'sims', 'calendar', 'worlds'].includes(section) ? section : 'more';
  return (
    <nav className="m-tabbar" aria-label="Tabs">
      {TABS.map((t) => (
        <a key={t.id} href={savePath(saveId, t.id)} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined}
          style={{ ['--ink' as string]: t.ink, ['--tint' as string]: t.tint }}>
          <span className="bub"><t.icon size={23} weight={tab === t.id ? 'fill' : 'duotone'} aria-hidden="true" /></span>
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

/** Phone top bar: save chip (opens "Your saves"), today's date, and the sync cloud. */
export function PhoneTop({ save }: { save: SaveRow }) {
  const { active } = useSaves();
  const [open, setOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const d = saveData(save);
  const t = todayOf(d);
  return (
    <>
      {dateOpen && <DateSheet save={save} onClose={() => setDateOpen(false)} />}
      <div className="m-top">
        <button type="button" className="m-savechip" onClick={() => setOpen(true)} aria-label={`${d.name}. Switch save`}>
          <span className="dot" style={{ background: `${d.color}33` }}><SparkleIcon size={16} weight="fill" color={d.color} /></span>
          <span className="nm">{d.name}</span>
          <CaretRight size={14} weight="bold" style={{ transform: 'rotate(90deg)', flexShrink: 0 }} />
        </button>
        <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          <SyncCloud />
          <QuickButton />
          {d.trackDate && <button type="button" className="m-datepill" onClick={() => setDateOpen(true)} aria-label={`Today is ${SEASONS[t.season]} ${t.day}, year ${t.year}. Change`}>{SEASONS[t.season]} {t.day} · Y{t.year}</button>}
        </span>
      </div>
      {open && (
        <Sheet onClose={() => setOpen(false)} title="Your saves">
          <div className="m-group">
            {active.map((s) => {
              const sd = saveData(s);
              return (
                <button key={s.id} type="button" className="m-row" onClick={() => { setOpen(false); go(savePath(s.id, 'today')); }}>
                  <span style={{ width: 14, height: 14, borderRadius: 5, background: sd.color, flexShrink: 0 }} />
                  <span className="t grow">{sd.name}</span>
                  {s.id === save.id && <Check size={18} weight="bold" color="var(--accent)" />}
                </button>
              );
            })}
            <button type="button" className="m-row" onClick={() => { setOpen(false); go('#/setup'); }}>
              <Plus size={18} weight="bold" color="var(--accent)" />
              <span className="t" style={{ color: 'var(--accent)' }}>New save</span>
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return <a href={href} className="m-back"><CaretLeft size={20} weight="bold" /> {label}</a>;
}

export function MRow({ title, sub, value, icon, href, onClick, right, chevron = !!(href || onClick), danger }: {
  title: ReactNode; sub?: ReactNode; value?: ReactNode; icon?: ReactNode; href?: string; onClick?(): void; right?: ReactNode; chevron?: boolean; danger?: boolean;
}) {
  const inner = (
    <>
      {icon}
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="t" style={{ display: 'block', color: danger ? 'var(--danger)' : undefined }}>{title}</span>
        {sub && <span className="s" style={{ display: 'block' }}>{sub}</span>}
      </span>
      {value != null && <span className="v">{value}</span>}
      {right}
      {chevron && <CaretRight size={16} weight="bold" className="chev" />}
    </>
  );
  if (href) return <a href={href} className="m-row">{inner}</a>;
  if (onClick) return <button type="button" className="m-row" onClick={onClick}>{inner}</button>;
  return <div className="m-row">{inner}</div>;
}
