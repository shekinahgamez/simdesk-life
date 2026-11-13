import { useState, type ReactNode } from 'react';

export type BoardColumn = { id: string; chip: ReactNode; count?: number };

/**
 * THE board (Kanban). Columns sit on a soft panel with a status chip and count on top, white cards,
 * a dashed drop spot when empty, drag a card to another column to move it. Phone pages show the List instead.
 */
export function Board<Item extends { id: string }>({ columns, items, columnOf, renderCard, onMove, emptyText = 'Drop an item here', min = 3 }: {
  columns: BoardColumn[]; items: Item[]; columnOf(item: Item): string; renderCard(item: Item): ReactNode;
  onMove?(id: string, columnId: string): void; emptyText?: string; min?: number;
}) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="p-board" style={{ gridTemplateColumns: `repeat(${Math.max(min, columns.length)}, minmax(0, 1fr))` }}>
      {columns.map((c) => {
        const list = items.filter((i) => columnOf(i) === c.id);
        return (
          <div key={c.id} className={`p-col ${over === c.id ? 'over' : ''}`}
            onDragOver={onMove ? (e) => { e.preventDefault(); setOver(c.id); } : undefined}
            onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
            onDrop={onMove ? (e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) onMove(id, c.id); } : undefined}>
            <div className="row" style={{ gap: 8, padding: '2px 4px 8px' }}>{c.chip}<span className="muted small">{c.count ?? list.length}</span></div>
            {list.map((i) => (
              <div key={i.id} className="p-kcard" draggable={!!onMove} onDragStart={(e) => { e.dataTransfer.setData('text/plain', i.id); e.dataTransfer.effectAllowed = 'move'; }}>{renderCard(i)}</div>
            ))}
            {list.length === 0 && <div className="p-colempty">{emptyText}</div>}
          </div>
        );
      })}
    </div>
  );
}
