import { Sparkle } from './brand';

export function Loading({ label = 'Loading your save…' }: { label?: string }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }} role="status">
      <Sparkle size={34} className="spin-sparkle" />
      <span className="muted small">{label}</span>
      <style>{`.spin-sparkle{animation:sdspin 1.4s ease-in-out infinite}@keyframes sdspin{50%{transform:rotate(90deg) scale(.8)}100%{transform:rotate(180deg)}}`}</style>
    </div>
  );
}
