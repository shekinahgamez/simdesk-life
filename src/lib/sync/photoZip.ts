import { APP } from '../../config/app';
import { photoIdsIn, type PhotoService } from '../photos';
import { fullName, simData } from '../sims';
import { stageName, type StageId } from '../time';
import type { SyncStore } from './store';
import type { Rec } from './types';

/** A name for every photo a save uses, like "Jamar Priestley - portrait". Photos with no clear owner get "Photo 3". */
export function photoNames(saveRaw: Record<string, unknown>, recs: Rec[]): Map<string, string> {
  const names = new Map<string, string>();
  const sims = new Map(recs.filter((r) => r.kind === 'sim').map((r) => [r.id, simData(r)]));
  const take = (id: string | undefined, name: string) => { if (id && !names.has(id)) names.set(id, name); };
  for (const r of recs) {
    const d = r.data as Record<string, unknown>;
    if (r.kind === 'sim') {
      const s = simData(r);
      take(s.portrait?.id, `${fullName(s)} - portrait`);
      for (const p of s.stagePhotos) take(p.photo.id, `${fullName(s)} - ${stageName(p.stage as StageId).toLowerCase()}`);
    } else if (r.kind === 'photo') {
      const cap = String(d.caption ?? '').trim();
      const who = (Array.isArray(d.simIds) ? d.simIds : []).map((x) => sims.get(String(x))).filter(Boolean).map((s) => fullName(s!)).slice(0, 3).join(', ');
      take((d.photo as { id?: string })?.id, cap || who || '');
    } else {
      const n = String(d.name ?? '').trim();
      for (const id of photoIdsIn(d)) take(id, n || '');
    }
  }
  for (const id of photoIdsIn(saveRaw)) take(id, 'Save cover');
  // Unnamed ones get numbers; repeated names get (2), (3).
  let n = 0;
  const seen = new Map<string, number>();
  for (const [id, raw] of names) {
    let name = (raw || `Photo ${++n}`).replace(/[\\/:*?"<>|]+/g, '').slice(0, 80).trim() || `Photo ${++n}`;
    const k = name.toLowerCase();
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    if (c > 1) name = `${name} (${c})`;
    names.set(id, name);
  }
  return names;
}

/** Downloads every photo in a save as one .zip of ordinary picture files. Returns how many went in, or -1. */
export async function downloadPhotos(store: SyncStore, saveId: string, photos: PhotoService): Promise<number> {
  const save = store.saves.get(saveId);
  if (!save) return -1;
  const recs = (await store.allRecords(saveId)).filter((r) => !r.deleted_at);
  const files: { name: string; data: Uint8Array }[] = [];
  for (const [id, name] of photoNames(save.data, recs)) {
    try {
      const blob = await toJpeg(await (await fetch(await photos.url(id, 'full'))).blob());
      files.push({ name: `${name}.jpg`, data: new Uint8Array(await blob.arrayBuffer()) });
    } catch { /* one photo that can't be fetched is left out */ }
  }
  if (!files.length) return 0;
  const slug = (save.data.name || 'save').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'save';
  const url = URL.createObjectURL(new Blob([zip(files)], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP.wordmark}-${slug}-photos-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return files.length;
}

/** Turns any picture into a .jpg, the kind every phone and computer opens. */
async function toJpeg(b: Blob): Promise<Blob> {
  if (b.type === 'image/jpeg') return b;
  const img = await createImageBitmap(b);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  return new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error('jpeg'))), 'image/jpeg', 0.92));
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** A plain .zip with no squeezing (pictures are already squeezed). */
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
    head.setUint32(14, crc, true); head.setUint32(18, f.data.length, true); head.setUint32(22, f.data.length, true); head.setUint16(26, name.length, true);
    parts.push(new Uint8Array(head.buffer), name, f.data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, f.data.length, true); cen.setUint32(24, f.data.length, true); cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cenSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(new ArrayBuffer(all.reduce((n, p) => n + p.length, 0)));
  let i = 0;
  for (const p of all) { out.set(p, i); i += p.length; }
  return out;
}
