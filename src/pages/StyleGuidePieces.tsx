import { useState } from 'react';
import { Kanban, Rows, SquaresFour, VideoCamera } from '@phosphor-icons/react';
import {
  AddButton, Board, CheckList, Dropdown, EmptyState, FilterBar, FilterButton, ListRow, MoreMenu, PageHeader, ProgressBar, SectionHeader, SelectBar, StatusChip, ViewSwitch, type Tone,
} from '../components/pieces';

export function PiecesIntro() {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <h1 style={{ margin: 0 }}>Style guide</h1>
      <p className="muted" style={{ margin: 0 }}>How Simdesk looks and the shared pieces every page builds from. Only you can open this page. A page never makes its own version of a piece.</p>
    </div>
  );
}

const Piece = ({ name, rule, dont, children }: { name: string; rule: string; dont?: string; children: React.ReactNode }) => (
  <section>
    <h2>{name}</h2>
    <p className="sc-why">{rule}</p>
    <div className="card stack" style={{ gap: 12, alignItems: 'flex-start' }}>{children}</div>
    {dont && <p className="muted small" style={{ margin: '6px 0 0' }}>Don’t: {dont}</p>}
  </section>
);

type Card = { id: string; title: string; col: string };
const COLS = [{ id: 'idea', label: 'Idea', tone: 'neutral' }, { id: 'out', label: 'Outlined', tone: 'info' }, { id: 'filmed', label: 'Filmed', tone: 'warm' }, { id: 'posted', label: 'Posted', tone: 'done' }] as const;

export function Pieces() {
  const [status, setStatus] = useState<string[]>(['idea']);
  const [group, setGroup] = useState<string[]>(['status']);
  const [view, setView] = useState<'list' | 'cards' | 'board'>('board');
  const [q, setQ] = useState('');
  const [cards, setCards] = useState<Card[]>([
    { id: '1', title: 'Setup day', col: 'idea' }, { id: '2', title: 'Gossip episode', col: 'idea' }, { id: '3', title: 'Build tour', col: 'out' }, { id: '4', title: 'First video', col: 'posted' },
  ]);
  const [pick, setPick] = useState<string[]>(['a']);
  const [picked, setPicked] = useState(false);
  const [dd, setDd] = useState('barber');
  return (
    <>
      <h1 style={{ margin: '40px 0 0' }}>Shared pieces</h1>
      <Piece name="Filters" rule="One filter button per thing. Plain when off, tinted with a count when on, a Clear link, and a popover (bottom sheet on phone) with a checkbox list, a count per row, and search when the list can grow." dont="use pills for names that can grow, or write a filter that only one page has.">
        <FilterBar search={q} onSearch={setQ} searchLabel="Search" active={status.length > 0 || !!q} onClear={() => { setStatus([]); setQ(''); }}
          right={<ViewSwitch<"list" | "cards" | "board"> label="View" value={view} onChange={setView} options={[{ v: 'list', label: 'List', icon: Rows }, { v: 'cards', label: 'Cards', icon: SquaresFour }, { v: 'board', label: 'Board', icon: Kanban }]} />}>
          <FilterButton label="Status" count={status.length}>{() => <CheckList options={COLS.map((c) => ({ id: c.id, label: c.label, n: cards.filter((x) => x.col === c.id).length }))} value={status} onChange={setStatus} />}</FilterButton>
          <FilterButton label="Series" count={0}>{() => <CheckList search options={['Forever save', 'Simdesk updates'].map((x) => ({ id: x, label: x }))} value={[]} onChange={() => {}} />}</FilterButton>
        </FilterBar>
      </Piece>
      <Piece name="View switch and tabs" rule="One segmented control for layout views, sort, and any 2 to 5 fixed choices. Icons only on phone." dont="build a second switch style.">
        <ViewSwitch<"list" | "cards" | "board"> label="Example" value={view} onChange={setView} options={[{ v: 'list', label: 'List', icon: Rows }, { v: 'cards', label: 'Cards', icon: SquaresFour }, { v: 'board', label: 'Board', icon: Kanban }]} />
        <ViewSwitch size="sm" label="Small" value="a" onChange={() => {}} options={[{ v: 'a', label: 'In 3 days' }, { v: 'b', label: 'Date' }]} />
      </Piece>
      <Piece name="Group by" rule="A separate button next to Filter, never mixed into it. Pick one. Only on List and Cards; a Board always groups by status.">
        <FilterButton label={`Group by: ${group[0] === 'none' ? 'None' : group[0]}`} count={0}>{(close) => <CheckList single options={['none', 'status', 'household'].map((x) => ({ id: x, label: x[0].toUpperCase() + x.slice(1) }))} value={group} onChange={(v) => { setGroup(v); close(); }} />}</FilterButton>
      </Piece>
      <Piece name="Status chip" rule="One chip, one word, one of eight tones. Pages pick a tone and never write their own colors.">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {(['neutral', 'info', 'warm', 'hot', 'done', 'accent', 'planned', 'due'] as Tone[]).map((t) => <StatusChip key={t} tone={t}>{t}</StatusChip>)}
        </div>
      </Piece>
      <Piece name="Board" rule="Columns on a soft panel with a status chip and count on top, white cards, a dashed drop spot when empty, drag a card to move it. Phone shows the list instead.">
        <Board items={cards} columns={COLS.map((c) => ({ id: c.id, chip: <StatusChip tone={c.tone}>{c.label}</StatusChip> }))} columnOf={(c) => c.col}
          onMove={(id, col) => setCards((l) => l.map((c) => (c.id === id ? { ...c, col } : c)))} renderCard={(c) => <b>{c.title}</b>} />
      </Piece>
      <Piece name="List row" rule="One row shape. Only the left part changes: a face for Sims, a section icon for content, a small picture for lots, nothing for plain items.">
        <ListRow lead={<span className="p-face">JP</span>} title="Jamar Priestley" sub="Priestley household" chip={<StatusChip tone="accent">Playing</StatusChip>} value="Spring 3" />
        <ListRow lead={<VideoCamera size={22} weight="duotone" />} title="Ep 3 · Setup day" sub="Series: Forever save" chip={<StatusChip tone="warm">Filmed</StatusChip>} value="Nov 9" />
        <ListRow title="Paycheck" sub="Friday pay" value="+$900" />
      </Piece>
      <Piece name="Select mode" rule="Tick rows, then one bar with the actions that fit the page. Delete goes last, red, and asks first with the count.">
        <ListRow title="Tap to pick" sub="Sim row" picked={picked} onClick={() => setPicked((p) => !p)} />
        {picked && <SelectBar count={1} noun="Sims" onCancel={() => setPicked(false)} actions={<button type="button" className="btn primary sm">Move to household</button>} />}
      </Piece>
      <Piece name="More menu" rule="Rare and risky actions live here. Delete is last and red.">
        <div><MoreMenu items={[{ label: 'Rename', run: () => {} }, { label: 'Duplicate', run: () => {} }, { label: 'Delete', run: () => {}, danger: true }]} /></div>
      </Piece>
      <Piece name="Dropdown picker" rule="Every dropdown is the app’s picker, with search. Never a plain browser dropdown.">
        <Dropdown value={dd} onChange={setDd} none="None yet" options={[{ id: 'barber', label: 'Barbershop' }, { id: 'bar', label: 'Bar' }, { id: 'gym', label: 'Gym' }]} />
      </Piece>
      <Piece name="Section header, page header, add button" rule="A section header is a title, a count and an action. A page header is a back link, a title and actions. Add buttons are small and quiet, in the same place on every card.">
        <SectionHeader title="Open" count={4} action={<AddButton onClick={() => {}}>Add storyline</AddButton>} />
        <PageHeader title="Page title" back={{ label: 'Storylines', href: '#style-guide' }} actions={<MoreMenu items={[{ label: 'Delete', run: () => {}, danger: true }]} />} />
      </Piece>
      <Piece name="Empty state and progress bar" rule="An empty state is one line of what goes here and one button. One progress bar everywhere.">
        <EmptyState text="No storylines yet" action={<button type="button" className="btn primary"><span>New storyline</span></button>} />
        <ProgressBar pct={60} label="Example" />
      </Piece>
      <Piece name="Choice (checkbox list)" rule="Used inside every filter popover.">
        <CheckList options={[{ id: 'a', label: 'First', n: 4 }, { id: 'b', label: 'Second', n: 2 }]} value={pick} onChange={setPick} />
      </Piece>
    </>
  );
}
