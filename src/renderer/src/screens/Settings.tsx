import { useEffect, useRef, useState } from 'react'
import { CLOUD_STT } from '../../../core/models'
import { LANGUAGES } from '../../../core/settings'
import type { SttEngine } from '../../../core/types'
import { prettyKey, type Ctx } from '../App'
import { api } from '../bridge'
import { Toggle } from './Usage'

function HotkeyInput({ value, platform, onChange }: { value: string; platform: string; onChange: (accel: string) => void }) {
  const [rec, setRec] = useState(false)
  return (
    <input
      readOnly
      className={rec ? 'recording' : ''}
      aria-label="Dictation hotkey. Focus and press a new shortcut."
      value={rec ? 'Press a shortcut…' : prettyKey(value, platform)}
      onFocus={() => setRec(true)}
      onBlur={() => setRec(false)}
      onKeyDown={(e) => {
        if (e.key === 'Tab' || e.key === 'Escape') return
        e.preventDefault()
        const c = e.code
        const key = c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : /^(F\d{1,2}|Space)$/.test(c) ? c : ''
        const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean)
        if (!key || (!mods.length && !key.startsWith('F'))) return // need a modifier, or a function key
        onChange([...mods, key].join('+'))
        e.currentTarget.blur()
      }}
    />
  )
}

/** Live input level, so the user can see which microphone actually hears them. */
function MicTest({ micId }: { micId: string }) {
  const [on, setOn] = useState(false)
  const [err, setErr] = useState('')
  const fill = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!on) return
    let raf = 0
    let stream: MediaStream | undefined
    const ctx = new AudioContext()
    navigator.mediaDevices
      .getUserMedia({ audio: micId ? { deviceId: { exact: micId } } : true })
      .then((s) => {
        stream = s
        const an = ctx.createAnalyser()
        ctx.createMediaStreamSource(s).connect(an)
        const buf = new Float32Array(an.fftSize)
        const tick = () => {
          an.getFloatTimeDomainData(buf)
          const peak = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
          if (fill.current) fill.current.style.width = `${Math.min(100, peak * 160)}%`
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => {
        setErr('Could not open this microphone. Check Windows privacy settings.')
        setOn(false)
      })
    return () => {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx.close()
    }
  }, [on, micId])
  return (
    <div className="mictest">
      <button className="btn" onClick={() => (setErr(''), setOn(!on))}>
        {on ? 'Stop test' : 'Test microphone'}
      </button>
      {on && (
        <>
          <div className="meter grow" aria-label="Microphone input level">
            <i ref={fill} style={{ width: 0 }} />
          </div>
          <span className="muted small">Speak: the bar should jump past halfway.</span>
        </>
      )}
      {err && <span className="warn small">{err}</span>}
    </div>
  )
}

export default function Settings({ st, set, dialog, toast }: Ctx) {
  const s = st.settings
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [tName, setTName] = useState('')
  const [tInst, setTInst] = useState('')

  useEffect(() => {
    void navigator.mediaDevices.enumerateDevices().then((d) => setMics(d.filter((x) => x.kind === 'audioinput' && x.deviceId !== 'communications')))
  }, [])

  const pickEngine = (e: SttEngine) => {
    if (e === 'local' || s.consentCloudStt) return void set({ sttEngine: e })
    dialog({
      title: 'Send audio to a cloud service?',
      body: (
        <p>
          Cloud transcription uploads each recording to <b>{CLOUD_STT[e].name}</b>. It's faster on slow computers but your
          audio leaves this device. Local transcription stays private and free.
        </p>
      ),
      actions: [{ label: 'Keep local' }, { label: 'Allow cloud transcription', primary: true, run: () => void set({ consentCloudStt: true, sttEngine: e }) }],
    })
  }

  return (
    <section className="screen">
      <h1>Settings</h1>

      <h2>Dictation</h2>
      <div className="grid2">
        <label className="field">
          <span>Microphone</span>
          <select value={s.micId} onChange={(e) => void set({ micId: e.target.value })}>
            <option value="">System default</option>
            {mics.map((m, i) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Hotkey{!st.hotkeyOk && <b className="warn"> (in use by another app)</b>}</span>
          <HotkeyInput value={s.hotkey} platform={st.platform} onChange={(hotkey) => void set({ hotkey })} />
        </label>
        <label className="field">
          <span>Mode</span>
          <select value={s.mode} onChange={(e) => void set({ mode: e.target.value as 'toggle' | 'ptt' })}>
            <option value="toggle">Toggle: press to start, press to stop</option>
            <option value="ptt" disabled={!st.canPaste}>
              Push-to-talk: hold to talk
            </option>
          </select>
        </label>
        <label className="field">
          <span>Language</span>
          <select value={s.language} onChange={(e) => void set({ language: e.target.value })}>
            {Object.entries(LANGUAGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MicTest micId={s.micId} />
      <Toggle on={s.reviewBeforeInsert} onChange={(v) => void set({ reviewBeforeInsert: v })}>
        Review and edit before inserting (off = insert immediately at the cursor)
      </Toggle>
      {!st.canPaste && <p className="warn small">Direct insertion isn't available on this system, so text is copied to the clipboard instead.</p>}

      <h2>Transcription</h2>
      <div className="grid2">
        <label className="field">
          <span>Engine</span>
          <select value={s.sttEngine} onChange={(e) => pickEngine(e.target.value as SttEngine)}>
            <option value="local">On this device (free, private)</option>
            <option value="groq">Groq Whisper (cloud, needs Groq key)</option>
            <option value="openai">OpenAI Whisper (cloud, needs OpenAI key)</option>
          </select>
        </label>
        <div className="field">
          <span>Local speech model</span>
          <button className="btn" onClick={() => api.invoke('stt:preload')}>
            Download / warm up now
          </button>
        </div>
      </div>

      <h2>Text cleanup</h2>
      <p className="muted small">Runs on this device, always free.</p>
      <Toggle on={s.cleanup.fillers} onChange={(v) => void set({ cleanup: { ...s.cleanup, fillers: v } })}>
        Remove filler words (um, uh, er)
      </Toggle>
      <Toggle on={s.cleanup.repeats} onChange={(v) => void set({ cleanup: { ...s.cleanup, repeats: v } })}>
        Remove stutters and repeated words
      </Toggle>
      <Toggle on={s.cleanup.punctuation} onChange={(v) => void set({ cleanup: { ...s.cleanup, punctuation: v } })}>
        Fix capitalization and end punctuation
      </Toggle>

      <h2>Transformations</h2>
      <ul className="list compact">
        {s.transforms.map((t) => (
          <li key={t.id}>
            <div className="item static">
              <span className="item-text">{t.name}</span>
              <span className="muted small">{t.instruction}</span>
            </div>
            <button className="icon" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => void set({ transforms: s.transforms.filter((x) => x.id !== t.id) })}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!tName.trim() || !tInst.trim()) return
          void set({ transforms: [...s.transforms, { id: crypto.randomUUID(), name: tName.trim(), instruction: tInst.trim() }] })
          setTName('')
          setTInst('')
        }}
      >
        <input placeholder="Name" value={tName} onChange={(e) => setTName(e.target.value)} aria-label="New transformation name" />
        <input className="grow" placeholder="Instruction, e.g. Rewrite as a friendly Slack message" value={tInst} onChange={(e) => setTInst(e.target.value)} aria-label="New transformation instruction" />
        <button className="btn" disabled={!tName.trim() || !tInst.trim()}>
          Add
        </button>
      </form>

      <h2>Privacy and data</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Where it lives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Audio</td>
            <td>Never saved. Sent to a cloud service only if you pick a cloud transcription engine.</td>
          </tr>
          <tr>
            <td>Transcripts</td>
            <td>This device only. Sent to a model provider only when you run an agent action on them.</td>
          </tr>
          <tr>
            <td>API keys</td>
            <td>This device, encrypted by the OS keychain.</td>
          </tr>
          <tr>
            <td>Usage and cost log</td>
            <td>This device only.</td>
          </tr>
        </tbody>
      </table>
      <Toggle on={s.consentCloudStt} onChange={(v) => void set(v ? { consentCloudStt: true } : { consentCloudStt: false, sttEngine: 'local' })}>
        Allow cloud transcription (uploads audio)
      </Toggle>
      <Toggle on={s.consentCloudLlm} onChange={(v) => void set({ consentCloudLlm: v })}>
        Allow cloud AI models (uploads the text you choose to process)
      </Toggle>
      <Toggle on={s.analytics} onChange={(v) => void set({ analytics: v })}>
        Share anonymous usage statistics (never audio or transcripts; this prototype sends nothing yet)
      </Toggle>
      <div className="grid2">
        <label className="field">
          <span>Keep transcript history</span>
          <select value={s.retentionDays} onChange={(e) => void set({ retentionDays: Number(e.target.value) })}>
            <option value={0}>Don't keep history</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={-1}>Until I delete it</option>
          </select>
        </label>
        <div className="field">
          <span>Delete data</span>
          <button
            className="btn danger"
            onClick={() =>
              dialog({
                title: 'Delete all history and usage data?',
                body: <p>This removes every saved transcript and the usage log from this device. API keys and settings stay. It can't be undone.</p>,
                actions: [{ label: 'Cancel' }, { label: 'Delete everything', primary: true, run: () => void api.invoke('data:deleteAll').then(() => toast('History and usage data deleted.')) }],
              })
            }
          >
            Delete history and usage…
          </button>
        </div>
      </div>

      <h2>Appearance</h2>
      <div className="grid2">
        <label className="field">
          <span>Theme</span>
          <select value={s.theme} onChange={(e) => void set({ theme: e.target.value as 'dark' | 'light' })}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="field">
          <span>Text size</span>
          <select value={s.textScale} onChange={(e) => void set({ textScale: Number(e.target.value) })}>
            <option value={0.9}>Small</option>
            <option value={1}>Default</option>
            <option value={1.15}>Large</option>
            <option value={1.3}>Extra large</option>
          </select>
        </label>
      </div>
    </section>
  )
}
