import type { MascotState } from './bridge'

// Yowly: a compact owl whose crest is a five-bar voice waveform.
// Soft cream face, big glossy eyes and blush cheeks keep it friendly.
// Colors are literal (not CSS variables) so the SVG can be rasterized for the tray icon.
const INK = '#2a211a'
const CREAM = '#fff4e2'
const CREST = [8, 14, 20, 14, 8]

function Eye({ cx, dx, dy, r }: { cx: number; dx: number; dy: number; r: number }) {
  return (
    <>
      <circle cx={cx + dx} cy={50 + dy} r={r} fill={INK} />
      <circle cx={cx + dx - r * 0.35} cy={50 + dy - r * 0.38} r={r * 0.34} fill="#fff" />
      <circle cx={cx + dx + r * 0.38} cy={50 + dy + r * 0.3} r={r * 0.15} fill="#fff" opacity=".8" />
    </>
  )
}

export default function Mascot({ state = 'idle', size = 64 }: { state?: MascotState; size?: number }) {
  const open = state === 'listening' || state === 'thinking' || state === 'transcribing' || state === 'error'
  const [dx, dy] =
    state === 'thinking' ? [2.5, -2.5] : state === 'transcribing' ? [0, 2] : state === 'error' ? [0, 2.5] : [0, 0]
  const r = state === 'listening' ? 8 : state === 'error' ? 6.2 : 7.2
  return (
    <svg className={`mascot m-${state}`} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={`Yowly is ${state}`}>
      <defs>
        <linearGradient id="yb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#f56a14" />
        </linearGradient>
      </defs>
      <g className="m-crest">
        {CREST.map((h, i) => (
          <rect key={i} className={`m-bar b${i}`} x={30.5 + i * 7.5} y={24 - h} width="5" height={h} rx="2.5" fill="#ffab3d" />
        ))}
      </g>
      <g className="m-body">
        <path d="M21 36 L22 23 L34 28 Z M75 36 L74 23 L62 28 Z" fill="#f56a14" stroke="#f56a14" strokeWidth="7" strokeLinejoin="round" />
        <rect x="12" y="22" width="72" height="66" rx="32" fill="url(#yb)" />
        <circle cx="35" cy="50" r="16.5" fill={CREAM} />
        <circle cx="61" cy="50" r="16.5" fill={CREAM} />
        <ellipse cx="24.5" cy="60" rx="4.5" ry="3" fill="#ff8a65" opacity=".55" />
        <ellipse cx="71.5" cy="60" rx="4.5" ry="3" fill="#ff8a65" opacity=".55" />
        {open ? (
          <>
            <Eye cx={36} dx={dx} dy={dy} r={r} />
            <Eye cx={60} dx={dx} dy={dy} r={r} />
            {state === 'transcribing' && (
              <path d="M29 39.5 h13 M54 39.5 h13" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
            )}
            {state === 'error' && (
              <path d="M28 41 L41 37.5 M68 41 L55 37.5" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
            )}
          </>
        ) : (
          <path
            d={state === 'success' ? 'M29 52 q7 -9 14 0 M53 52 q7 -9 14 0' : 'M29 50 q7 6 14 0 M53 50 q7 6 14 0'}
            fill="none"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        <path d="M45 58 h6 l-3 5 Z" fill="#f59a1b" stroke="#f59a1b" strokeWidth="3" strokeLinejoin="round" />
        <path d="M40 79 v3 M48 76.5 v8 M56 79 v3" stroke="#c2500c" strokeWidth="3.5" strokeLinecap="round" opacity=".5" />
      </g>
      {state === 'transcribing' && (
        <g className="m-waves" fill="none" stroke="#ffab3d" strokeWidth="3" strokeLinecap="round">
          <path d="M7 46 q-5 8 0 16" />
          <path d="M89 46 q5 8 0 16" />
        </g>
      )}
      {state === 'thinking' && (
        <g className="m-dots" fill="#ffab3d">
          <circle cx="83" cy="18" r="2.5" />
          <circle cx="90" cy="11" r="3" />
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
