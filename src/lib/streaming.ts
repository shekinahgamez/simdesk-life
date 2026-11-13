import { useAccount } from './sync/react';

type Prefs = { streaming?: boolean };

/**
 * Streaming mode: hides what you wouldn't want on screen while you stream (right now, planned moments).
 * An account setting, so it follows you to every device. Also `/stream` in the command bar.
 * When something new is hidden, add it to STREAM_HIDES.
 */
export const STREAM_HIDES = ['Planned moments'];
export const streamTip = `Streaming mode hides: ${STREAM_HIDES.join(', ')}`;

export function useStreaming(): [boolean, (v: boolean) => void] {
  const acct = useAccount();
  const on = !!(acct.data.prefs as Prefs | undefined)?.streaming;
  return [on, (v) => acct.update((d) => ({ ...d, prefs: { ...((d.prefs as Prefs | undefined) ?? {}), streaming: v } }))];
}
