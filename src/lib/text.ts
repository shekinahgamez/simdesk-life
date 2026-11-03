/** Lowercase and strip accents, so "José" and "jose" match. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Search matching used everywhere: ignores capitals and accents, and matches parts of words.
 * Every word typed must appear somewhere in the text ("fri ani" finds "Friend of the Animals").
 */
export function matches(text: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const t = normalize(text);
  return q.split(/\s+/).every((w) => t.includes(w));
}

/** "1 household", "3 households". Pass the plural for irregular words. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
