import type { MascotState } from './bridge'

// Yowly: a compact owl whose crest is a five-bar voice waveform.
// Colors are literal (not CSS variables) so the SVG can be rasterized for the tray icon.
const INK = '#1b1815'
const CREAM = '#fff4e2'
const CREST = [8, 14, 20, 14, 8]

export default function Mascot({ state = 'idle', size = 64 }: { state?: MascotState; size?: number }) {
  const open = state === 'listening' || state === 'thinking' || state === 'transcribing' || state === 'error'
  const [dx, dy] =
    state === 'thinking' ? [3, -3] : state === 'transcribing' ? [0, 2.5] : state === 'error' ? [0, 3] : [0, 0]
  return (
    <svg className={`mascot m-${state}`} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={`Yowly is ${state}`}>
      <defs>
        <linearGradient id="yb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffab3d" />
          <stop offset="1" stopColor="#f2590d" />
        </linearGradient>
      </defs>
      <g className="m-crest">
        {CREST.map((h, i) => (
          <rect key={i} className={`m-bar b${i}`} x={30.5 + i * 7.5} y={24 - h} width="5" height={h} rx="2.5" fill="#ffab3d" />
        ))}
      </g>
      <g className="m-body">
        <path d="M17 38 L15 17 L35 27 Z M79 38 L81 17 L61 27 Z" fill="#f2590d" stroke="#f2590d" strokeWidth="5" strokeLinejoin="round" />
        <rect x="13" y="22" width="70" height="66" rx="31" fill="url(#yb)" />
        <circle cx="34" cy="48" r="17" fill={INK} />
        <circle cx="62" cy="48" r="17" fill={INK} />
        {open ? (
          <>
            <circle cx="34" cy="48" r="11" fill={CREAM} />
            <circle cx="62" cy="48" r="11" fill={CREAM} />
            <circle cx={34 + dx} cy={48 + dy} r={state === 'listening' ? 5.8 : 5} fill={INK} />
            <circle cx={62 + dx} cy={48 + dy} r={state === 'listening' ? 5.8 : 5} fill={INK} />
            {state === 'transcribing' && <path d="M21 36 h26 v8 h-26 Z M49 36 h26 v8 h-26 Z" fill={INK} />}
            {state === 'error' && (
              <path d="M24 37 L41 32 M72 37 L55 32" stroke={CREAM} strokeWidth="3" strokeLinecap="round" />
            )}
          </>
        ) : (
          <path
            d={state === 'success' ? 'M25 50 q9 -11 18 0 M53 50 q9 -11 18 0' : 'M25 48 q9 7 18 0 M53 48 q9 7 18 0'}
            fill="none"
            stroke={CREAM}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}
        <path d="M44 59 h8 l-4 7 Z" fill="#ffd58a" stroke="#ffd58a" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M40 78 v4 M48 75 v10 M56 78 v4" stroke="#b8400a" strokeWidth="3.5" strokeLinecap="round" opacity=".55" />
      </g>
      {state === 'transcribing' && (
        <g className="m-waves" fill="none" stroke="#ffab3d" strokeWidth="3" strokeLinecap="round">
          <path d="M8 46 q-5 8 0 16" />
          <path d="M88 46 q5 8 0 16" />
        </g>
      )}
      {state === 'thinking' && (
        <g className="m-dots" fill="#ffab3d">
          <circle cx="82" cy="18" r="2.5" />
          <circle cx="89" cy="11" r="3" />
        </g>
      )}
      {state === 'idle' && (
        <text x="80" y="18" className="m-zz" fill="#8f877a" fontSize="12" fontWeight="700" fontFamily="system-ui">
          z
        </text>
      )}
    </svg>
  )
}
