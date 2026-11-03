import { useEffect, useRef } from 'react';

/**
 * Keeps track of open pop-ups and sheets, top one last.
 * - Escape only reaches the top one.
 * - The page behind stays locked from scrolling until the last one closes.
 */
type Layer = { id: number; onEscape: () => void };
const stack: Layer[] = [];
let nextId = 1;
let savedScrollY = 0;

function lockScroll() {
  // iOS Safari ignores overflow:hidden on body, so pin the body in place instead.
  savedScrollY = window.scrollY;
  const b = document.body.style;
  b.position = 'fixed';
  b.top = `-${savedScrollY}px`;
  b.left = '0';
  b.right = '0';
  b.overflow = 'hidden';
}
function unlockScroll() {
  const b = document.body.style;
  b.position = '';
  b.top = '';
  b.left = '';
  b.right = '';
  b.overflow = '';
  window.scrollTo(0, savedScrollY);
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  e.preventDefault();
  stack[stack.length - 1].onEscape();
}

/** Registers a layer while the component is open. `onEscape` can change freely without re-running anything. */
export function useLayer(onEscape: () => void): { isTop: () => boolean } {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  const idRef = useRef(0);
  useEffect(() => {
    const id = nextId++;
    idRef.current = id;
    if (stack.length === 0) {
      lockScroll();
      document.addEventListener('keydown', onKey);
    }
    stack.push({ id, onEscape: () => ref.current() });
    return () => {
      const i = stack.findIndex((l) => l.id === id);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) {
        unlockScroll();
        document.removeEventListener('keydown', onKey);
      }
    };
  }, []);
  return { isTop: () => stack.length > 0 && stack[stack.length - 1].id === idRef.current };
}
