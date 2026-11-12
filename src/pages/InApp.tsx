import { ArrowsClockwise, Crown, Storefront, GearSix, Path, UserCircle } from '@phosphor-icons/react';
import { BUILT, CATEGORIES, needsPack, ObjIcon, type CategoryId, DECK } from '../components/categories';
import { DesktopDeck, PhoneDeck, type DeckCard } from '../components/Deck';
import { PhotoBox } from '../components/photo';
import { useRecords } from '../lib/sync/react';
import { plural } from '../lib/text';
import { householdData } from '../lib/households';
import { MRow, PhoneTop } from '../components/Shell';
import { go, savePath } from '../lib/router';
import { moduleOn, saveData, todayOf } from '../lib/saves';
import type { SaveRow } from '../lib/sync/types';
import { formatDate } from '../lib/time';

/** The deck's cards for a save. Live numbers get added as each section is built. */
export function deckCards(save: SaveRow, counts: Partial<Record<CategoryId, string>> = {}): DeckCard[] {
  const d = saveData(save);
  return DECK.filter((c) => (!c.module || moduleOn(d, c.module)) && needsPack(c, d.packs)).map((c) => ({ id: c.id, label: c.label, icon: c.icon, text: counts[c.id] && c.after ? c.after : c.nudge, built: BUILT.has(c.id), live: counts[c.id] }));
}
/** Live numbers on the deck cards. */
function useDeckCounts(): Partial<Record<CategoryId, string>> {
  const sims = useRecords('sim').filter((r) => !(r.data as { deceased?: unknown }).deceased);
  const lots = useRecords('lot');
  const households = useRecords('household');
  const holidays = useRecords('holiday');
  const events = useRecords('event');
  const clubs = useRecords('club');
  const homeless = households.filter((r) => !householdData(r).home).length;
  return {
    ...(sims.length ? { sims: plural(sims.length, 'Sim') } : {}),
    ...(households.length ? { households: [plural(households.length, 'household'), homeless ? `${homeless} with no home` : ''].filter(Boolean).join(' · ') } : {}),
    ...(lots.length ? { worlds: plural(lots.length, 'lot') } : {}),
    ...(holidays.length || events.length ? { calendar: [holidays.length ? plural(holidays.length, 'holiday') : '', events.length ? plural(events.length, 'event') : ''].filter(Boolean).join(' · ') } : {}),
    ...(clubs.length ? { clubs: plural(clubs.length, 'club') } : {}),
  };
}
const openSection = (save: SaveRow) => (id: CategoryId) => go(savePath(save.id, CATEGORIES.find((c) => c.id === id)!.path));

/** Desktop home: the fanned-out deck. Click a card to open that section. */
export function HomeDeck({ save }: { save: SaveRow }) {
  const d = saveData(save);
  const counts = useDeckCounts();
  const when = d.trackDate ? formatDate(todayOf(d), 'weekday') + ` · Year ${todayOf(d).year}` : 'Pick a card to jump in.';
  return (
    <div className="stack" style={{ gap: 28, alignItems: 'center', paddingTop: d.cover ? 0 : 24 }}>
      {d.cover ? (
        <PhotoBox photo={d.cover} aspect={4} className="home-cover" alt="">
          <div className="home-cover-text"><h1>{d.name}</h1><div>{when}</div></div>
        </PhotoBox>
      ) : (
        <div className="home-head">
          <h1>{d.name}</h1>
          <div className="muted">{when}</div>
        </div>
      )}
      <DesktopDeck cards={deckCards(save, counts)} mode="home" onPick={openSection(save)} />
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
      <PhoneDeck cards={deckCards(save, useDeckCounts())} onPick={openSection(save)} button={false} />
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
        <MRow href={savePath(save.id, 'photos')} title="Photos" icon={<ObjIcon cat="photos" />} />
        {d.packs.includes('get-together') && <MRow href={savePath(save.id, 'clubs')} title="Clubs" icon={<ObjIcon cat="clubs" />} />}
        {moduleOn(d, 'rotation') && <MRow href={savePath(save.id, 'rotation')} title="Rotation" icon={<span className="obj rotation"><ArrowsClockwise size={16} weight="duotone" /></span>} />}
        {moduleOn(d, 'venues') && <MRow href={savePath(save.id, 'businesses')} title="Businesses" icon={<span className="obj businesses"><Storefront size={16} weight="duotone" /></span>} />}
        {moduleOn(d, 'legacy') && <MRow href={savePath(save.id, 'legacy')} title="Legacy" icon={<span className="obj legacy"><Crown size={16} weight="duotone" /></span>} />}
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
  calendar: 'The calendar is on its way', photos: 'Photos are on their way', clubs: 'Clubs are on their way', storylines: 'Storylines are on their way',
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
