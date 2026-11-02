import type { MergedLot, MergedWorld } from '../store/hooks';
import { nowIso } from './ids';
import type { LotRecord, WorldRecord } from './types';

export function lotRec(l: MergedLot): LotRecord {
  return (
    l.rec ?? {
      id: l.id,
      gameId: l.game?.id,
      worldId: l.worldId,
      photos: [],
      lotTraits: [],
      history: [],
      createdAt: nowIso(),
    }
  );
}

export function worldRec(w: MergedWorld): WorldRecord {
  return w.rec ?? { id: w.id, gameId: w.game?.id, createdAt: nowIso() };
}

export type PinKind = 'home' | 'community' | 'empty';
export function pinKind(l: MergedLot, hasResidents: boolean, communityTypes: Set<string>): PinKind {
  if (hasResidents) return 'home';
  const t = (l.gameLotType ?? '').toLowerCase();
  if (t && !t.includes('residential') && (communityTypes.has(t) || communityTypes.has(t.replace(/\s+/g, '-')))) return 'community';
  if (l.lotType && !/home|house|residential|starter|family|empty/i.test(l.lotType)) return 'community';
  return 'empty';
}
export const PIN_COLOR: Record<PinKind, { bg: string; fg: string; label: string }> = {
  home: { bg: 'var(--households-ink)', fg: '#fff', label: 'Home' },
  community: { bg: 'var(--worlds-ink)', fg: '#fff', label: 'Community' },
  empty: { bg: 'var(--surface)', fg: 'var(--text)', label: 'Empty' },
};
