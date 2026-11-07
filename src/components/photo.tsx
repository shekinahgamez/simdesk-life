import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Camera } from '@phosphor-icons/react';
import { Modal, toast } from './ui';
import {
  clampCrop, DEFAULT_CROP, MAX_ZOOM, PhotoError, thumbPixelsAcross, PHOTO_MESSAGES, placement, preparePhoto, usePhotos, usePhotoUrl,
  type Crop, type PhotoRef, type PhotoSize, type Prepared,
} from '../lib/photos';

/** A photo inside a frame of a fixed shape, placed where the player positioned it. */
export function PhotoBox({ photo, aspect, size = 'full', className = '', style, children, alt = '', fill = false }: {
  photo: PhotoRef; aspect: number; size?: PhotoSize; className?: string; style?: CSSProperties; children?: ReactNode; alt?: string;
  /** The box takes whatever size its container gives it: measure it so the photo never stretches. */
  fill?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    if (!box.current) return;
    const el = box.current;
    const read = () => { setBoxW(el.clientWidth); if (fill && el.clientWidth && el.clientHeight) setMeasured(el.clientWidth / el.clientHeight); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const p = placement(photo.w, photo.h, fill ? measured ?? aspect : aspect, photo.crop);
  // The small copy is only used when it's sharp at this size (zoomed-in crops and big tiles get the full photo).
  const sharpEnough = boxW > 0 && thumbPixelsAcross(photo.w, photo.h, p.width) >= boxW * (window.devicePixelRatio || 1) * 0.9;
  const url = usePhotoUrl(photo.id, size === 'thumb' && !sharpEnough ? 'full' : size);
  return (
    <div ref={box} className={`photo-box ${className}`} style={{ ...(fill ? { height: '100%' } : { aspectRatio: String(aspect) }), ...style }}>
      {url && (
        <img src={url} alt={alt} draggable={false}
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }} />
      )}
      {children}
    </div>
  );
}

/**
 * "Position your photo": drag to move, pinch (phones and iPads), the mouse wheel or the slider to zoom.
 * The clear area is exactly the shape the photo shows in.
 */
export function CropEditor({ src, w, h, aspect, initial, title, label, busy, onDone, onCancel }: {
  src: string; w: number; h: number; aspect: number; initial?: Crop; title: string; label: string; busy?: boolean;
  onDone(c: Crop): void; onCancel(): void;
}) {
  const [crop, setCrop] = useState<Crop>(() => clampCrop(w, h, aspect, initial ?? DEFAULT_CROP));
  const frame = useRef<HTMLDivElement>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const pinch = useRef<{ d: number; zoom: number } | null>(null);
  const cur = useRef(crop);
  cur.current = crop;
  const set = (c: Crop) => setCrop(clampCrop(w, h, aspect, c));
  const p = placement(w, h, aspect, crop);

  const two = () => {
    const v = [...pts.current.values()];
    return v.length >= 2 ? Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) : null;
  };
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = two();
    if (d) { pinch.current = { d, zoom: cur.current.zoom }; drag.current = null; }
    else drag.current = { x: e.clientX, y: e.clientY, crop: cur.current };
  };
  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = two();
    if (d && pinch.current) return set({ ...cur.current, zoom: pinch.current.zoom * (d / pinch.current.d) });
    const s = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!s || !box) return;
    // Moving the finger right moves the photo right, so the middle point moves left on the photo.
    const pw = (p.width / 100) * box.width;
    const ph = (p.height / 100) * box.height;
    set({ ...s.crop, cx: s.crop.cx - (e.clientX - s.x) / pw, cy: s.crop.cy - (e.clientY - s.y) / ph });
  };
  const up = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    pinch.current = null;
    const left = [...pts.current.values()][0];
    drag.current = left ? { x: left.x, y: left.y, crop: cur.current } : null;
  };
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); set({ ...cur.current, zoom: cur.current.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06) }); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title={title} onClose={onCancel}
      footer={(close) => (
        <>
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => onDone(crop)}>{busy ? 'Uploading…' : 'Use photo'}</button>
        </>
      )}>
      <div className="crop-wrap">
        <div className="crop-stage">
          <div ref={frame} className="crop-frame" style={{ aspectRatio: String(aspect) }} role="img" aria-label={label}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <img src={src} alt="" draggable={false}
              style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }} />
          </div>
        </div>
        <label className="crop-zoom">
          <span className="sr-only">Zoom</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} onChange={(e) => set({ ...crop, zoom: Number(e.target.value) })} />
        </label>
        <p className="hint" style={{ margin: 0 }}>Drag to move it. Pinch, scroll or use the slider to zoom.</p>
      </div>
    </Modal>
  );
}

/**
 * Picking a photo: choose a file, position it, upload. Returns the photo (or null if cancelled).
 * Also handles "Reposition" for a photo that's already uploaded.
 */
export function usePhotoPicker({ aspect, saveId, title = 'Position your photo', label = 'Photo' }: {
  aspect: number; saveId: string | null; title?: string; label?: string;
}) {
  const svc = usePhotos();
  const input = useRef<HTMLInputElement>(null);
  const resolver = useRef<((p: PhotoRef | null) => void) | null>(null);
  const [step, setStep] = useState<null | { kind: 'new'; prep: Prepared } | { kind: 'reposition'; photo: PhotoRef; src: string }>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);

  const finish = (p: PhotoRef | null) => {
    if (step?.kind === 'new') { const u = step.prep.previewUrl; window.setTimeout(() => URL.revokeObjectURL(u), 2000); }
    setStep(null);
    setBusy(false);
    resolver.current?.(p);
    resolver.current = null;
  };

  const pick = () => new Promise<PhotoRef | null>((resolve) => {
    resolver.current = resolve;
    if (input.current) { input.current.value = ''; input.current.click(); }
  });
  const reposition = async (photo: PhotoRef) => {
    const src = await svc.url(photo.id, 'full').catch(() => null);
    if (!src) { toast(PHOTO_MESSAGES.failed); return null; }
    return new Promise<PhotoRef | null>((resolve) => { resolver.current = resolve; setStep({ kind: 'reposition', photo, src }); });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) { resolver.current?.(null); resolver.current = null; return; }
    setWorking(true);
    try {
      setStep({ kind: 'new', prep: await preparePhoto(file) });
    } catch (e) {
      toast(e instanceof PhotoError ? e.message : PHOTO_MESSAGES.decode);
      resolver.current?.(null);
      resolver.current = null;
    } finally {
      setWorking(false);
    }
  };

  const ui = (
    <>
      <input ref={input} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      {working && <div className="photo-working" role="status">Getting your photo ready…</div>}
      {step?.kind === 'new' && (
        <CropEditor src={step.prep.previewUrl} w={step.prep.w} h={step.prep.h} aspect={aspect} title={title} label={label} busy={busy}
          onCancel={() => finish(null)}
          onDone={async (crop) => {
            setBusy(true);
            try {
              const id = await svc.upload(step.prep, saveId);
              finish({ id, w: step.prep.w, h: step.prep.h, crop });
            } catch (e) {
              setBusy(false);
              toast(e instanceof PhotoError ? e.message : PHOTO_MESSAGES.failed);
            }
          }} />
      )}
      {step?.kind === 'reposition' && (
        <CropEditor src={step.src} w={step.photo.w} h={step.photo.h} aspect={aspect} initial={step.photo.crop} title="Reposition photo" label={label}
          onCancel={() => finish(null)} onDone={(crop) => finish({ ...step.photo, crop })} />
      )}
    </>
  );
  return { pick, reposition, ui };
}

/** The dashed "add a photo" box, or the photo with Reposition and Remove. */
export function PhotoField({ value, onChange, aspect, saveId, label, width, emptyText = label }: {
  value: PhotoRef | null; onChange(p: PhotoRef | null): void; aspect: number; saveId: string | null; label: string; width?: number | string; emptyText?: string;
}) {
  const picker = usePhotoPicker({ aspect, saveId, label });
  const choose = async () => { const p = await picker.pick(); if (p) onChange(p); };
  return (
    <div className="photo-field" style={{ width }}>
      {value ? (
        <>
          <PhotoBox photo={value} aspect={aspect} className="photo-field-box" alt={label} />
          <div className="photo-field-actions">
            <button type="button" className="btn sm" onClick={async () => { const p = await picker.reposition(value); if (p) onChange(p); }}>Reposition</button>
            <button type="button" className="btn sm" onClick={choose}>Change</button>
            <button type="button" className="btn sm ghost" onClick={() => onChange(null)}>Remove</button>
          </div>
        </>
      ) : (
        <button type="button" className="photo-drop" style={{ aspectRatio: String(aspect) }} onClick={choose}>
          <Camera size={18} /> {emptyText}
        </button>
      )}
      {picker.ui}
    </div>
  );
}
