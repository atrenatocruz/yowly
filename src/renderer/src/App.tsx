import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Settings } from '../../core/types'
import { api, type AppState, type MascotState } from './bridge'
import Mascot from './Mascot'
import Dictate from './screens/Dictate'
import History from './screens/History'
import Models from './screens/Models'
import SettingsScreen from './screens/Settings'
import Usage from './screens/Usage'

const ROUTES = ['dictate', 'history', 'models', 'usage', 'settings'] as const
export type Route = (typeof ROUTES)[number]
const LABEL: Record<Route, string> = { dictate: 'Dictate', history: 'History', models: 'Models', usage: 'Usage', settings: 'Settings' }

export interface DialogSpec {
  title: string
  body: ReactNode
  actions: { label: string; primary?: boolean; run?: () => void }[]
}

export interface Ctx {
  st: AppState
  set: (patch: Partial<Settings>) => Promise<void>
  toast: (text: string) => void
  go: (r: Route) => void
  dialog: (d: DialogSpec | null) => void
  draft: string
  setDraft: (t: string) => void
  mascot: MascotState
  setMascot: (m: MascotState) => void
}

export const prettyKey = (accel: string, platform: string) =>
  accel.replace('Control', platform === 'darwin' ? '⌃' : 'Ctrl').replace('Super', platform === 'darwin' ? '⌘' : 'Win').replaceAll('+', ' + ')

const routeFromHash = (): Route => {
  const r = location.hash.slice(2) as Route
  return ROUTES.includes(r) ? r : 'dictate'
}

export default function App() {
  const [st, setSt] = useState<AppState | null>(null)
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [draft, setDraft] = useState('')
  const [mascot, setMascot] = useState<MascotState>('idle')
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const [dlg, setDlg] = useState<DialogSpec | null>(null)
  const [palette, setPalette] = useState(false)

  const go = useCallback((r: Route) => (location.hash = `#/${r}`), [])
  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  useEffect(() => {
    const refresh = () => api.invoke('state:get').then(setSt)
    void refresh()
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    const offs = [
      api.on('changed', refresh),
      api.on('dictation', setMascot),
      api.on('review:open', (a: { text: string }) => {
        setDraft(a.text)
        go('dictate')
      }),
      api.on('stt:status', toast),
    ]
    return () => {
      window.removeEventListener('hashchange', onHash)
      offs.forEach((off) => off())
    }
  }, [go, toast])

  useEffect(() => {
    if (!st) return
    document.documentElement.dataset.theme = st.settings.theme
    document.documentElement.style.fontSize = `${16 * st.settings.textScale}px`
  }, [st])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (mod && e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        go(ROUTES[Number(e.key) - 1])
      } else if (e.key === 'Escape') {
        setPalette(false)
        setDlg(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (!st) return null
  const set = (patch: Partial<Settings>) => api.invoke('settings:set', patch)
  const ctx: Ctx = { st, set, toast, go, dialog: setDlg, draft, setDraft, mascot, setMascot }
  const s = st.settings

  const commands: { label: string; run: () => void }[] = [
    { label: 'Start / stop dictation', run: () => api.invoke('dictation:toggle') },
    ...ROUTES.map((r) => ({ label: `Go to ${LABEL[r]}`, run: () => go(r) })),
    { label: `Switch to ${s.theme === 'dark' ? 'light' : 'dark'} theme`, run: () => set({ theme: s.theme === 'dark' ? 'light' : 'dark' }) },
    { label: `Review before insert: turn ${s.reviewBeforeInsert ? 'off' : 'on'}`, run: () => set({ reviewBeforeInsert: !s.reviewBeforeInsert }) },
    { label: `Dictation mode: switch to ${s.mode === 'toggle' ? 'push-to-talk' : 'toggle'}`, run: () => set({ mode: s.mode === 'toggle' ? 'ptt' : 'toggle' }) },
    ...st.models.filter((m) => !m.unavailable).map((m) => ({ label: `Use model: ${m.name} (${m.label})`, run: () => set({ modelId: m.id }) })),
  ]

  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">
          <Mascot state={mascot} size={34} />
          <span>Yowly</span>
        </div>
        {ROUTES.map((r, i) => (
          <a key={r} href={`#/${r}`} className={route === r ? 'nav on' : 'nav'} aria-current={route === r ? 'page' : undefined}>
            {LABEL[r]}
            <kbd>{i + 1}</kbd>
          </a>
        ))}
        <button className="nav palette-btn" onClick={() => setPalette(true)}>
          Commands <kbd>Ctrl K</kbd>
        </button>
      </nav>
      <main className="content">
        <div className="drag" />
        {route === 'dictate' && <Dictate {...ctx} />}
        {route === 'history' && <History {...ctx} />}
        {route === 'models' && <Models {...ctx} />}
        {route === 'usage' && <Usage {...ctx} />}
        {route === 'settings' && <SettingsScreen {...ctx} />}
      </main>

      {!s.onboarded && <Welcome ctx={ctx} />}
      {dlg && <Dialog spec={dlg} close={() => setDlg(null)} />}
      {palette && <Palette commands={commands} close={() => setPalette(false)} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

function Dialog({ spec, close }: { spec: DialogSpec; close: () => void }) {
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={spec.title}>
        <h2>{spec.title}</h2>
        <div className="dialog-body">{spec.body}</div>
        <div className="row end">
          {spec.actions.map((a, i) => (
            <button
              key={a.label}
              className={a.primary ? 'btn primary' : 'btn'}
              autoFocus={i === spec.actions.length - 1}
              onClick={() => {
                close()
                a.run?.()
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Welcome({ ctx }: { ctx: Ctx }) {
  const { st, set } = ctx
  return (
    <div className="scrim">
      <div className="dialog welcome" role="dialog" aria-modal="true" aria-label="Welcome to Yowly">
        <Mascot state="success" size={84} />
        <h2>Hi, I'm Yowly.</h2>
        <p>
          Press <kbd>{prettyKey(st.settings.hotkey, st.platform)}</kbd> anywhere, talk, and I'll turn it into clean text.
        </p>
        <ul className="plain">
          <li>
            <b>Private by default.</b> Speech is transcribed on this device. Nothing is sent anywhere.
          </li>
          <li>
            <b>Cloud is opt-in.</b> I ask before any audio or text goes to a cloud provider.
          </li>
          <li>
            <b>No surprise charges.</b> Paid models show cost first and stop at your monthly cap.
          </li>
        </ul>
        <p className="muted">The first dictation downloads a small speech model (about 80 MB).</p>
        <div className="row end">
          <button className="btn primary" autoFocus onClick={() => set({ onboarded: true })}>
            Get started
          </button>
        </div>
      </div>
    </div>
  )
}

function Palette({ commands, close }: { commands: { label: string; run: () => void }[]; close: () => void }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const hits = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return commands.filter((c) => words.every((w) => c.label.toLowerCase().includes(w)))
  }, [q, commands])
  useEffect(() => list.current?.children[idx]?.scrollIntoView({ block: 'nearest' }), [idx])
  const pick = (i: number) => {
    close()
    hits[i]?.run()
  }
  return (
    <div className="scrim top" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          autoFocus
          placeholder="Type a command…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setIdx(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setIdx((i) => Math.min(i + 1, hits.length - 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setIdx((i) => Math.max(i - 1, 0)))
            if (e.key === 'Enter') pick(idx)
          }}
        />
        <div className="palette-list" ref={list} role="listbox">
          {hits.map((c, i) => (
            <div key={c.label} role="option" aria-selected={i === idx} className={i === idx ? 'cmd on' : 'cmd'} onMouseEnter={() => setIdx(i)} onClick={() => pick(i)}>
              {c.label}
            </div>
          ))}
          {!hits.length && <div className="cmd muted">No matches</div>}
        </div>
      </div>
    </div>
  )
}
