import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { kvDel, kvGet, kvSet } from './sync/kv';

/**
 * Photos. Each photo is shrunk on the device before it uploads (a full copy plus a small one for lists),
 * kept private, and shown with short-lived links. Where the player positioned it is saved as numbers
 * (`crop`), not as a cut-down copy, so it can be repositioned later without uploading again.
 */
export type Crop = { cx: number; cy: number; zoom: number };
export type PhotoRef = { id: string; w: number; h: number; crop?: Crop };

export const DEFAULT_CROP: Crop = { cx: 0.5, cy: 0.5, zoom: 1 };
export const MAX_ZOOM = 3;
const FULL_SIDE = 1600;
const THUMB_SIDE = 720;

export class PhotoError extends Error {}
export const PHOTO_MESSAGES = {
  decode: 'That photo couldn’t be opened. Try a JPG or PNG, or take a screenshot of it and upload that.',
  offline: 'Photos need the internet to upload. Try again when you’re back online.',
  limit: 'You’ve reached your photo limit. Remove a photo you don’t need to add another.',
  failed: 'That photo didn’t upload. Try again.',
};

// ---------- shrinking ----------
async function decode(file: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; done(): void }> {
  // createImageBitmap handles most files (and iPhone HEIC photos in Safari). Fall back to an <img>.
  try {
    const bmp = await createImageBitmap(file);
    return { img: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new PhotoError(PHOTO_MESSAGES.decode);
    }
  }
}

/** True when any pixel is see-through (like a Create a Sim render with no background). */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 16) if (data[i] < 250) return true; // every 4th pixel is plenty
  return false;
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * WebP when the browser can make it (it keeps see-through parts). Safari can't, so there:
 * see-through photos stay PNG (JPEG would turn those parts black), everything else becomes JPEG.
 */
async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await encode(canvas, 'image/webp', 0.9);
  if (webp && webp.type === 'image/webp') return webp;
  const out = hasTransparency(canvas) ? await encode(canvas, 'image/png') : await encode(canvas, 'image/jpeg', 0.84);
  if (!out) throw new PhotoError(PHOTO_MESSAGES.decode);
  return out;
}

function draw(src: CanvasImageSource, w: number, h: number, maxSide: number): HTMLCanvasElement {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export type Prepared = { full: Blob; thumb: Blob; w: number; h: number; previewUrl: string };

/** Shrinks a picked file. The preview link is for the "Position your photo" step. */
export async function preparePhoto(file: Blob): Promise<Prepared> {
  const d = await decode(file);
  try {
    const big = draw(d.img, d.w, d.h, FULL_SIDE);
    const full = await toBlob(big);
    const thumb = await toBlob(draw(big, big.width, big.height, THUMB_SIDE));
    return { full, thumb, w: big.width, h: big.height, previewUrl: URL.createObjectURL(full) };
  } finally {
    d.done();
  }
}

// ---------- where photos are kept ----------
export type PhotoSize = 'full' | 'thumb';
/** How many pixels of the small copy fall across a box, when the photo is drawn at `widthPct` % of the box width. */
export function thumbPixelsAcross(w: number, h: number, widthPct: number): number {
  // Older photos were saved with 360px small copies; assume the smaller size so they upgrade when needed.
  const tw = w * Math.min(1, 360 / Math.max(w, h));
  return tw * (100 / widthPct);
}
export interface PhotoService {
  upload(p: Prepared, saveId: string | null): Promise<string>;
  url(id: string, size: PhotoSize): Promise<string>;
  remove(ids: string[]): Promise<void>;
  /** Everything uploaded for a save (when it's deleted for good). */
  removeForSave(saveId: string): Promise<void>;
  usage(): Promise<{ used: number; limit: number }>;
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
const ext = (b: Blob) => (b.type === 'image/webp' ? 'webp' : b.type === 'image/png' ? 'png' : 'jpg');
const NET = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;

/** The real thing: Supabase storage (private bucket "photos") plus a row per photo for the limit. */
export function supabasePhotos(userId: string): PhotoService {
  const links = new Map<string, { url: string; until: number }>();
  const paths = new Map<string, string>();
  const pathOf = (id: string, size: PhotoSize, type = 'webp') => `${userId}/${id}${size === 'thumb' ? '_t' : ''}.${type}`;
  const fail = (e: { message?: string } | null): never => {
    const m = e?.message ?? '';
    if (/photo_limit/.test(m)) throw new PhotoError(PHOTO_MESSAGES.limit);
    if (!navigator.onLine || NET.test(m)) throw new PhotoError(PHOTO_MESSAGES.offline);
    throw new PhotoError(PHOTO_MESSAGES.failed);
  };
  async function find(id: string, size: PhotoSize): Promise<string> {
    const key = `${id}:${size}`;
    const known = paths.get(key);
    if (known) return known;
    const { data } = await supabase.storage.from('photos').list(userId, { search: id, limit: 4 });
    for (const f of data ?? []) {
      const thumb = f.name.includes('_t.');
      paths.set(`${id}:${thumb ? 'thumb' : 'full'}`, `${userId}/${f.name}`);
    }
    return paths.get(key) ?? pathOf(id, size);
  }
  return {
    async upload(p, saveId) {
      if (!navigator.onLine) throw new PhotoError(PHOTO_MESSAGES.offline);
      const id = newId();
      // The row first: it's what checks the photo limit.
      const row = await supabase.from('photos').insert({ id, save_id: saveId, bytes: p.full.size + p.thumb.size });
      if (row.error) fail(row.error);
      const fullPath = pathOf(id, 'full', ext(p.full));
      const thumbPath = pathOf(id, 'thumb', ext(p.thumb));
      const a = await supabase.storage.from('photos').upload(fullPath, p.full, { contentType: p.full.type, cacheControl: '31536000' });
      const b = a.error ? a : await supabase.storage.from('photos').upload(thumbPath, p.thumb, { contentType: p.thumb.type, cacheControl: '31536000' });
      if (a.error || b.error) {
        await supabase.storage.from('photos').remove([fullPath, thumbPath]);
        await supabase.from('photos').delete().eq('id', id);
        fail(a.error ?? b.error);
      }
      paths.set(`${id}:full`, fullPath);
      paths.set(`${id}:thumb`, thumbPath);
      return id;
    },
    async url(id, size) {
      const key = `${id}:${size}`;
      const hit = links.get(key);
      if (hit && hit.until > Date.now()) return hit.url;
      const path = await find(id, size);
      const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 3600);
      if (error || !data) fail(error);
      links.set(key, { url: data!.signedUrl, until: Date.now() + 50 * 60_000 });
      return data!.signedUrl;
    },
    async remove(ids) {
      if (!ids.length) return;
      const all: string[] = [];
      for (const id of ids) all.push(await find(id, 'full'), await find(id, 'thumb'));
      await supabase.storage.from('photos').remove(all);
      await supabase.from('photos').delete().in('id', ids);
      for (const id of ids) { links.delete(`${id}:full`); links.delete(`${id}:thumb`); }
    },
    async removeForSave(saveId) {
      const { data } = await supabase.from('photos').select('id').eq('save_id', saveId);
      await this.remove((data ?? []).map((r) => r.id as string));
    },
    async usage() {
      const { data, error } = await supabase.rpc('photo_usage');
      if (error) fail(error);
      return data as { used: number; limit: number };
    },
  };
}

/** The pretend account keeps photos in this browser. Same limit as a free account. */
export function localPhotos(key: string): PhotoService {
  const urls = new Map<string, string>();
  const listKey = `${key}:photo-list`;
  const list = async () => (await kvGet<{ id: string; saveId: string | null }[]>(listKey)) ?? [];
  return {
    async upload(p, saveId) {
      const all = await list();
      if (all.length >= 100) throw new PhotoError(PHOTO_MESSAGES.limit);
      const id = newId();
      await kvSet(`${key}:photo:${id}:full`, p.full);
      await kvSet(`${key}:photo:${id}:thumb`, p.thumb);
      await kvSet(listKey, [...all, { id, saveId }]);
      return id;
    },
    async url(id, size) {
      const k = `${id}:${size}`;
      const hit = urls.get(k);
      if (hit) return hit;
      const b = await kvGet<Blob>(`${key}:photo:${id}:${size}`);
      if (!b) throw new PhotoError(PHOTO_MESSAGES.failed);
      const u = URL.createObjectURL(b);
      urls.set(k, u);
      return u;
    },
    async remove(ids) {
      for (const id of ids) {
        await kvDel(`${key}:photo:${id}:full`);
        await kvDel(`${key}:photo:${id}:thumb`);
      }
      await kvSet(listKey, (await list()).filter((x) => !ids.includes(x.id)));
    },
    async removeForSave(saveId) {
      await this.remove((await list()).filter((x) => x.saveId === saveId).map((x) => x.id));
    },
    async usage() {
      return { used: (await list()).length, limit: 100 };
    },
  };
}

// ---------- for React ----------
export const PhotoCtx = createContext<PhotoService | null>(null);
export function usePhotos(): PhotoService {
  const p = useContext(PhotoCtx);
  if (!p) throw new Error('usePhotos needs a PhotoCtx');
  return p;
}

/** A photo's link (null while loading or if it can't be loaded). */
export function usePhotoUrl(id: string | null | undefined, size: PhotoSize): string | null {
  const svc = useContext(PhotoCtx);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!id || !svc) return;
    let live = true;
    svc.url(id, size).then((u) => live && setUrl(u)).catch(() => live && setUrl(null));
    return () => { live = false; };
  }, [id, size, svc]);
  return url;
}

// ---------- positioning ----------
/**
 * Where to draw a photo inside a frame of a given shape (width ÷ height), as percentages of the frame.
 * `cx`/`cy` is the point of the photo that sits in the middle of the frame; `zoom` 1 = just covers it.
 */
export function placement(w: number, h: number, frameAspect: number, crop: Crop = DEFAULT_CROP) {
  const r = w / h;
  const z = Math.max(1, Math.min(MAX_ZOOM, crop.zoom));
  const width = (r > frameAspect ? z * r / frameAspect : z) * 100;
  const height = (r > frameAspect ? z : z * frameAspect / r) * 100;
  const left = Math.min(0, Math.max(100 - width, 50 - crop.cx * width));
  const top = Math.min(0, Math.max(100 - height, 50 - crop.cy * height));
  return { width, height, left, top };
}

/** Keeps a crop inside the photo (no empty edges), after dragging or zooming. */
export function clampCrop(w: number, h: number, frameAspect: number, crop: Crop): Crop {
  const zoom = Math.max(1, Math.min(MAX_ZOOM, crop.zoom));
  const p = placement(w, h, frameAspect, { ...crop, zoom });
  return { zoom, cx: (50 - p.left) / p.width, cy: (50 - p.top) / p.height };
}

/** Every photo id inside a record's data (portrait, stage photos, cover). */
export function photoIdsIn(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  const out: string[] = [];
  const add = (v: unknown) => {
    if (v && typeof v === 'object' && typeof (v as PhotoRef).id === 'string' && typeof (v as PhotoRef).w === 'number') out.push((v as PhotoRef).id);
  };
  add(data.portrait);
  add(data.cover);
  add(data.photo);
  if (Array.isArray(data.stagePhotos)) for (const s of data.stagePhotos) add((s as { photo?: unknown }).photo);
  return out;
}
