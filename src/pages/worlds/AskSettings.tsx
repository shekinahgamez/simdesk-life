import { Toggle } from '../../components/ui';
import { useAskToPlace } from './shared';

/** The questions SimDesk asks, which can be switched off for good. Follows the account. */
export function AskSettings({ phone }: { phone: boolean }) {
  const [place, setPlace] = useAskToPlace();
  const line = (
    <label className="switch-line">
      <span>Ask to place newly created lots</span>
      <Toggle label="Ask to place newly created lots" on={place} onChange={setPlace} />
    </label>
  );
  if (phone) {
    return (
      <>
        <div className="m-label">Questions</div>
        <div className="m-group"><div className="m-row">{line}</div></div>
        <div className="m-help">Follows your account to every device.</div>
      </>
    );
  }
  return (
    <div className="card">
      <div className="card-head"><h2>Questions</h2></div>
      <div className="switch-list">{line}</div>
      <p className="hint" style={{ margin: '10px 0 0' }}>Follows your account to every device.</p>
    </div>
  );
}
