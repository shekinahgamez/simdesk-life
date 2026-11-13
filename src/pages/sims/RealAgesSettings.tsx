import { Stepper } from '../../components/ui';
import { DEFAULT_REAL_AGES, rangeText } from '../../lib/realAges';
import { STAGE_IDS, stageName } from '../../lib/time';
import { useRealAgeRanges } from './shared';

/**
 * App settings: which ages each life stage covers when a save shows real-life ages. Most people won't change these,
 * so they stay account-wide; each save only chooses whether to use them (Save settings → Time).
 */
export function RealAgesSettings({ phone }: { phone: boolean }) {
  const { ranges, set, isDefault } = useRealAgeRanges();
  const rows = STAGE_IDS.map((id, i) => {
    const start = ranges.starts[i];
    if (i === 0) return { id, i, control: <span className="muted small">From birth</span> };
    const next = i + 1 < ranges.starts.length ? ranges.starts[i + 1] : ranges.end;
    const months = i === 1;
    const prev = ranges.starts[i - 1];
    const control = months
      ? <Stepper label={`${stageName(id)} starts at (months)`} unit="months" min={1} max={11} value={Math.round(start * 12)}
          onChange={(m) => set({ ...ranges, starts: ranges.starts.map((x, k) => (k === i ? m / 12 : x)) })} />
      : <Stepper label={`${stageName(id)} starts at (years)`} unit="years" min={Math.floor(prev) + 1} max={Math.ceil(next) - 1} value={Math.round(start)}
          onChange={(y) => set({ ...ranges, starts: ranges.starts.map((x, k) => (k === i ? y : x)) })} />;
    return { id, i, control };
  });
  const body = (
    <div className={`ra-list${phone ? ' ra-phone' : ''}`}>
      {rows.map((r) => (
        <div key={r.id} className="ra-row">
          <div className="grow"><b>{stageName(r.id)}</b><span className="muted small"><span className="ra-dot"> · </span>{rangeText(r.id, ranges)}</span></div>
          {r.control}
        </div>
      ))}
      <div className="ra-row">
        <div className="grow"><b>Oldest an elder gets</b><span className="muted small"> · when their age bar is full</span></div>
        <Stepper label="Oldest age (years)" unit="years" min={Math.round(ranges.starts[7]) + 1} max={150} value={Math.round(ranges.end)} onChange={(end) => set({ ...ranges, end })} />
      </div>
      {!isDefault && <div><button type="button" className="btn sm" onClick={() => set(DEFAULT_REAL_AGES)}>Back to the usual ages</button></div>}
    </div>
  );
  const help = 'A Sim halfway through their life stage shows as halfway through these ages. Each save chooses whether to show them (Save settings → Time). Follows your account to every device.';
  if (phone) {
    return (
      <>
        <div className="m-label">Real-life ages</div>
        <div className="m-group"><div className="m-row" style={{ display: 'block' }}>{body}</div></div>
        <div className="m-help">{help}</div>
      </>
    );
  }
  return (
    <div className="card">
      <div className="card-head"><h2>Real-life ages</h2></div>
      {body}
      <p className="hint" style={{ margin: '10px 0 0' }}>{help}</p>
    </div>
  );
}
