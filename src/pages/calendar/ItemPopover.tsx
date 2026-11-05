import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import type { CalItem } from '../../lib/calendar';
import { go, savePath } from '../../lib/router';
import type { SaveRow } from '../../lib/sync/types';
import { dateOf, formatDate, weekday } from '../../lib/time';
import { SimAvatar } from '../sims/shared';
import type { LotsCtx } from '../worlds/shared';
import { itemTitle, KIND_LABEL, KindIcon, spanText, useTraditionName, whenText, type CalCtx } from './shared';

const W = 340;

function place(rect: DOMRect, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let side: 'right' | 'left' | 'below' = 'right';
  let left: number;
  if (vw - rect.right >= W + 24) left = rect.right + 12;
  else if (rect.left >= W + 24) { side = 'left'; left = rect.left - W - 12; }
  else { side = 'below'; left = Math.min(Math.max(12, rect.left), vw - W - 12); }
  let top = side === 'below' ? rect.bottom + 8 : rect.top - 22;
  top = Math.min(Math.max(12, top), Math.max(12, vh - h - 12));
  return { left, top, side, ay: Math.min(Math.max(16, rect.top + rect.height / 2 - top - 7), Math.max(16, h - 30)) };
}

/** The small card that opens beside an item on the desktop calendar. Phones go straight to the item's page. */
export function ItemPopover({ save, ctx, lots, item, rect, onClose, onEdit, onPlan }: {
  save: SaveRow; ctx: CalCtx; lots: LotsCtx; item: CalItem; rect: DOMRect; onClose(): void; onEdit(): void; onPlan(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ReturnType<typeof place> | null>(null);
  const trad = useTraditionName();
  useLayoutEffect(() => { setPos(place(rect, ref.current?.offsetHeight ?? 260)); }, [rect, item.key]);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest('.cal-it')) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const away = () => onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away); };
  }, [onClose]);

  const date = dateOf(item.day, ctx.info.cal);
  const when = whenText(ctx, item);
  const sub = [
    item.getaway ? 'Getaway' : KIND_LABEL[item.kind],
    item.kind === 'vacation' ? spanText(ctx, item.day, item.end) : item.kind === 'holiday' ? formatDate(date, 'short') : `${weekday(date).slice(0, 3)}, ${formatDate(date, 'short')}`,
    when,
  ].filter(Boolean).join(' · ');
  const href = (p: string) => savePath(save.id, p);
  const page = item.kind === 'birthday' ? `calendar/birthday/${item.id}/${item.day}` : `calendar/${item.kind}/${item.id}`;
  const open = () => { onClose(); go(href(page)); };
  const viewSim = () => { onClose(); go(href(`sims/${item.id}`)); };
  const simOf = (id: string) => ctx.simById.get(id);
  const faces = (ids: string[]) => (
    <span className="hh-faces" style={{ ['--f' as string]: '26px' }}>
      {ids.slice(0, 5).map((id) => simOf(id) && <span key={id} className="hh-face"><SimAvatar sim={simOf(id)!} size={26} /></span>)}
    </span>
  );

  const ev = ctx.state.events.find((e) => e.id === item.id)?.data;
  const hol = ctx.state.holidays.find((h) => h.id === item.id)?.data;
  const vac = ctx.state.vacations.find((v) => v.id === item.id)?.data;
  const notes = (ev ?? hol ?? vac)?.notes.trim();
  const going = item.kind === 'event' ? item.sims.filter((x) => x !== item.host) : item.sims;

  return (
    <div ref={ref} className={`cal-pop k-${item.kind} side-${pos?.side ?? 'right'}`} role="dialog" aria-label={itemTitle(ctx, item)}
      style={{ left: pos?.left ?? -999, top: pos?.top ?? 0, ['--ay' as string]: `${pos?.ay ?? 30}px`, visibility: pos ? 'visible' : 'hidden' }}>
      <div className="cal-pop-top">
        <span className="cal-tile lg"><KindIcon kind={item.kind} size={22} /></span>
        <div className="grow"><h3>{item.kind === 'birthday' ? <a className="cal-pop-link" href={href(page)} onClick={(e) => { e.preventDefault(); open(); }}>{itemTitle(ctx, item)}</a> : itemTitle(ctx, item)}</h3><div className="s">{sub}</div></div>
        <button type="button" className="cal-pop-x" aria-label="Close" onClick={onClose}><X size={16} weight="bold" /></button>
      </div>
      {item.kind === 'event' && (
        <>
          {item.host && <div className="cal-pop-row"><span className="l">Host</span>{simOf(item.host) && <SimAvatar sim={simOf(item.host)!} size={26} />}<span>{ctx.nameOf(item.host)}</span></div>}
          {going.length > 0 && <div className="cal-pop-row"><span className="l">Going</span>{faces(going)}<span className="muted">{going.length} going</span></div>}
        </>
      )}
      {item.kind === 'holiday' && hol && hol.traditions.length > 0 && (
        <div className="cal-pop-chips">
          {hol.traditions.slice(0, 4).map((t) => <span key={t} className="chip">{trad(t)}</span>)}
          {hol.traditions.length > 4 && <span className="chip">+{hol.traditions.length - 4}</span>}
        </div>
      )}
      {item.kind === 'vacation' && (
        <>
          {item.sims.length > 0 && <div className="cal-pop-row"><span className="l">Going</span>{faces(item.sims)}<span className="muted">{item.sims.length} {item.sims.length === 1 ? 'Sim' : 'Sims'}</span></div>}
          {vac?.world && <div className="cal-pop-row"><span className="l">World</span><span>{lots.worldName(vac.world)}</span></div>}
        </>
      )}
      {item.kind === 'birthday' && simOf(item.id) && (
        <div className="cal-pop-row"><SimAvatar sim={simOf(item.id)!} size={26} /><span>{ctx.nameOf(item.id)}</span>{ctx.hhOf(item.id) && <span className="muted">· {ctx.hhOf(item.id)}</span>}</div>
      )}
      {notes && <div className="cal-pop-notes">{notes}</div>}
      <div className="cal-pop-btns">
        {(item.kind === 'holiday' || item.kind === 'birthday') && <button type="button" className="btn sm ghost" style={{ color: 'var(--accent)', marginRight: 'auto' }} onClick={() => { onClose(); onPlan(); }}>Plan an event</button>}
        {item.kind === 'birthday'
          ? <button type="button" className="btn sm primary" onClick={viewSim}>View Sim</button>
          : <><button type="button" className="btn sm" onClick={() => { onClose(); onEdit(); }}>Edit</button><button type="button" className="btn sm primary" onClick={open}>Open</button></>}
      </div>
    </div>
  );
}
