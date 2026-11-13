import type { MascotState } from './bridge'

// The Yowly mark: five voice-wave bars that step down into the letter Y.
// It has no face; motion alone shows the state (see "mark motion" in styles.css).
// Colors are literal (not CSS variables) so the SVG can be rasterized for the tray icon.
const BARS = [
  { x: 11, y: 14, h: 26 },
  { x: 27, y: 26, h: 32 },
  { x: 43, y: 40, h: 46 },
  { x: 59, y: 26, h: 32 },
  { x: 75, y: 14, h: 26 },
]

export default function Mascot({ state = 'idle', size = 64 }: { state?: MascotState; size?: number }) {
  return (
    <svg className={`mascot m-${state}`} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={`Yowly is ${state}`}>
      <defs>
        <linearGradient id="yb" gradientUnits="userSpaceOnUse" x1="8" y1="10" x2="88" y2="90">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#f2590d" />
        </linearGradient>
      </defs>
      <g fill={state === 'error' ? '#a8927f' : 'url(#yb)'}>
        {BARS.map((b, i) => (
          <rect key={i} className={`m-bar b${i}`} x={b.x} y={b.y} width="10" height={b.h} rx="5" />
        ))}
      </g>
    </svg>
  )
}
