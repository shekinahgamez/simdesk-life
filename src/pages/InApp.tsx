import { GearSix, Path, UserCircle } from '@phosphor-icons/react';
import { BUILT, CATEGORIES, ObjIcon, type CategoryId } from '../components/categories';
import { DesktopDeck, PhoneDeck, type DeckCard } from '../components/Deck';
import { MRow, PhoneTop } from '../components/Shell';
import { go, savePath } from '../lib/router';
import { moduleOn, saveData, todayOf } from '../lib/saves';
import type { SaveRow } from '../lib/sync/types';
import { formatDate } from '../lib/time';

/** The deck's cards for a save. Live numbers get added as each section is built. */
export function deckCards(save: SaveRow): DeckCard[] {
  const d = saveData(save);
  return CATEGORIES.filter((c) => !c.module || moduleOn(d, c.module)).map((c) => ({ id: c.id, label: c.label, icon: c.icon, text: c.nudge, built: BUILT.has(c.id) }));
}
const openSection = (save: SaveRow) => (id: CategoryId) => go(savePath(save.id, CATEGORIES.find((c) => c.id === id)!.path));

/** Desktop home: the fanned-out deck. Click a card to open that section. */
export function HomeDeck({ save }: { save: SaveRow }) {
  const d = saveData(save);
  return (
    <div className="stack" style={{ gap: 28, alignItems: 'center', paddingTop: 24 }}>
      <div className="home-head">
        <h1>{d.name}</h1>
        <div className="muted">{d.trackDate ? formatDate(todayOf(d), 'weekday') + ` · Year ${todayOf(d).year}` : 'Pick a card to jump in.'}</div>
      </div>
      <DesktopDeck cards={deckCards(save)} mode="home" onPick={openSection(save)} />
    </div>
  );
}

/** Phone Today (the full Today page comes in Phase 7). For now: the swipe deck. */
export function PhoneToday({ save }: { save: SaveRow }) {
  return (
    <div className="m-stack">
      <PhoneTop save={save} />
      <h1 className="m-h1" style={{ paddingTop: 4 }}>Where to?</h1>
      <p className="m-sub" style={{ margin: '-8px 0 0' }}>Swipe through the deck, then tap a card. Your Today dashboard is on its way.</p>
      <PhoneDeck cards={deckCards(save)} onPick={openSection(save)} button={false} />
    </div>
  );
}

export function More({ save }: { save: SaveRow }) {
  const d = saveData(save);
  return (
    <div className="m-stack">
      <PhoneTop save={save} />
      <h1 className="m-h1" style={{ paddingTop: 4 }}>More</h1>
      <div className="m-group">
        <MRow href={savePath(save.id, 'households')} title="Households" icon={<ObjIcon cat="households" />} />
        <MRow href={savePath(save.id, 'clubs')} title="Clubs" icon={<ObjIcon cat="clubs" />} />
        {moduleOn(d, 'storylines') && <MRow href={savePath(save.id, 'storylines')} title="Storylines" icon={<span className="obj storylines"><Path size={16} weight="duotone" /></span>} />}
      </div>
      <div className="m-group">
        <MRow href={savePath(save.id, 'settings')} title="Save settings" sub={d.name} icon={<span className="obj berry"><GearSix size={16} weight="duotone" /></span>} />
        <MRow href="#/account" title="Account" sub="Username, app settings, deleted saves" icon={<span className="obj berry"><UserCircle size={16} weight="duotone" /></span>} />
      </div>
    </div>
  );
}

const WAY: Record<CategoryId, string> = {
  sims: 'Sims are on their way', households: 'Households are on their way', worlds: 'Worlds & lots are on their way',
  calendar: 'The calendar is on its way', clubs: 'Clubs are on their way', storylines: 'Storylines are on their way',
};
/** For sections that haven't been built yet. */
export function OnItsWay({ cat }: { cat: CategoryId }) {
  return (
    <div className="on-its-way">
      <ObjIcon cat={cat} size="lg" />
      <h1>{WAY[cat]}</h1>
      <p>This part of SimDesk is being built next. Your save is set up and ready for it.</p>
    </div>
  );
}
