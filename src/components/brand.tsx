import { APP } from '../config/app';

const SPARKLE_PATH = 'M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z';

export function Sparkle({ size = 24, color = 'var(--accent)', className, style }: { size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      <path d={SPARKLE_PATH} fill={color} />
    </svg>
  );
}

/** Lowercase wordmark in Gabarito ExtraBold with a berry four-point sparkle as the dot on the "i". */
export function Wordmark({ size = 22 }: { size?: number }) {
  const word = APP.wordmark;
  const i = word.indexOf('i');
  const sparkle = Math.round(size * 0.29);
  return (
    <span
      role="img"
      aria-label={APP.name}
      style={{
        fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: size, letterSpacing: '-0.035em', lineHeight: 1,
        color: 'var(--text)', whiteSpace: 'nowrap', display: 'inline-block',
      }}
    >
      {i < 0 ? (
        word
      ) : (
        <>
          {word.slice(0, i)}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            ı
            <span style={{ position: 'absolute', lineHeight: 0, left: 'calc(50% + 0.0175em)', top: size * 0.0, transform: 'translateX(-50%)', display: 'inline-flex' }}>
              <Sparkle size={sparkle} />
            </span>
          </span>
          {word.slice(i + 1)}
        </>
      )}
    </span>
  );
}
