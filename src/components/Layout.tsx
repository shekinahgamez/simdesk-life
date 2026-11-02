import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CaretUpDown, Check, FastForward, GearSix, List, Plus, UserCircle } from '@phosphor-icons/react';
import { useSave, useStore } from '../store/store';
import { formatDate } from '../lib/time';
import { AppIcon, Wordmark } from './brand';
import { CATEGORIES, ObjIcon } from './categories';
import { Loading } from './Loading';
import { JumpAheadButton } from './JumpAhead';

export function Layout({ loading }: { loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="app">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <Sidebar open={open} />
      <main className="main">
        <div className="mobile-bar">
          <button type="button" className="btn ghost icon" aria-label="Open menu" onClick={() => setOpen(true)}>
            <List size={22} weight="bold" />
          </button>
          <Wordmark size={20} />
          <span className="grow" />
          <MobileDate />
        </div>
        {loading ? <Loading /> : <Outlet />}
      </main>
    </div>
  );
}

function MobileDate() {
  const save = useSave();
  if (!save) return null;
  return <span className="tiny muted bold">{save.trackDate ? formatDate(save.date) : save.name}</span>;
}

function Sidebar({ open }: { open: boolean }) {
  const save = useSave();
  const { saves, sync, syncError, backend } = useStore();
  const [switcher, setSwitcher] = useState(false);
  const nav = useNavigate();
  const cats = CATEGORIES.filter((c) => !c.module || save?.modules[c.module]);

  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Main">
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', textDecoration: 'none' }}>
        <AppIcon size={30} />
        <Wordmark size={22} />
      </Link>

      {save && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setSwitcher((v) => !v)}
            aria-expanded={switcher}
            style={{
              width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
              padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 4, background: save.color, flexShrink: 0 }} aria-hidden="true" />
            <span className="grow">
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{save.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{save.trackDate ? formatDate(save.date) : 'Date tracking off'}</span>
            </span>
            <CaretUpDown size={16} className="muted" />
          </button>
          {switcher && (
            <div className="combo-list" style={{ position: 'absolute' }} role="menu">
              {saves.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSwitcher(false);
                    nav(`/s/${s.id}`);
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 4, background: s.color }} aria-hidden="true" />
                  <span className="grow">{s.name}</span>
                  {s.id === save.id && <Check size={14} weight="bold" />}
                </button>
              ))}
              <button type="button" role="menuitem" onClick={() => nav('/setup')}>
                <Plus size={14} weight="bold" /> New save
              </button>
            </div>
          )}
          {save.trackDate && (
            <div style={{ marginTop: 8 }}>
              <JumpAheadButton className="btn sm" style={{ width: '100%' }}>
                <FastForward size={14} weight="duotone" /> Jump ahead
              </JumpAheadButton>
            </div>
          )}
        </div>
      )}

      {save && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {cats.map((c) => (
            <NavLink key={c.id} to={`/s/${save.id}/${c.path}`} className="nav-link">
              <ObjIcon cat={c.id} />
              {c.label}
            </NavLink>
          ))}
        </div>
      )}

      <span className="grow" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {save && (
          <NavLink to={`/s/${save.id}/settings`} className="nav-link">
            <span className="obj berry" aria-hidden="true"><GearSix size={16} weight="duotone" /></span>
            Save settings
          </NavLink>
        )}
        <NavLink to="/account" className="nav-link">
          <span className="obj berry" aria-hidden="true"><UserCircle size={16} weight="duotone" /></span>
          {backend?.mode === 'local' ? 'Guest mode' : 'Account'}
        </NavLink>
        <div className="tiny muted" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }} title={syncError ?? undefined}>
          <span className={`sync-dot ${sync === 'saving' ? 'saving' : sync === 'error' ? 'error' : ''}`} aria-hidden="true" />
          {sync === 'saving'
            ? 'Saving…'
            : sync === 'error'
              ? 'Couldn’t save. Retrying…'
              : backend?.mode === 'local'
                ? 'Saved on this device'
                : 'All changes synced'}
        </div>
      </div>
      <style>{`
        .nav-link{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;color:var(--text)}
        .nav-link:hover{background:color-mix(in srgb,var(--text) 5%,transparent)}
        .nav-link.active{background:var(--surface);box-shadow:var(--shadow-sm)}
      `}</style>
    </nav>
  );
}
