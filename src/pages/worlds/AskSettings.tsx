import { useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { Toggle } from '../../components/ui';
import { streamTip, useStreaming } from '../../lib/streaming';
import { useAskToPlace } from './shared';

/** Other settings: things SimDesk asks and the streaming switch. All follow the account. */
export function AskSettings({ phone }: { phone: boolean }) {
  const [place, setPlace] = useAskToPlace();
  const [stream, setStream] = useStreaming();
  const [tip, setTip] = useState(false);
  const place1 = (
      <label className="switch-line">
        <span>Ask to place newly created lots</span>
        <Toggle label="Ask to place newly created lots" on={place} onChange={setPlace} />
      </label>
  );
  // The (i) opens a short note under the row (nothing floats, so nothing gets clipped). Edit STREAM_HIDES as more things get hidden.
  const stream1 = (
    <div>
      <div className="switch-line">
        <span className="row" style={{ gap: 6 }}>Streaming mode
          <button type="button" className="tip-btn" aria-label={streamTip} aria-expanded={tip} title={streamTip} onClick={() => setTip(!tip)}><Info size={18} weight="duotone" /></button>
        </span>
        <Toggle label="Streaming mode" on={stream} onChange={setStream} />
      </div>
      {tip && <p className="hint tip-note" role="tooltip">{streamTip}</p>}
    </div>
  );
  const hint = 'Follow your account to every device. Streaming mode is also /stream in the command bar.';
  if (phone) {
    return (
      <>
        <div className="m-label">Other settings</div>
        <div className="m-group"><div className="m-row" style={{ display: 'block' }}><div className="switch-list" style={{ border: 0 }}>{place1}{stream1}</div></div></div>
        <div className="m-help">Follows your account to every device.</div>
      </>
    );
  }
  return (
    <div className="card">
      <div className="card-head"><h2>Other settings</h2></div>
      <div className="switch-list">{place1}{stream1}</div>
      <p className="hint" style={{ margin: '10px 0 0' }}>{hint}</p>
    </div>
  );
}
