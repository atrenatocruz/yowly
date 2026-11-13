import { useEffect, useRef, useState } from 'react'
import { ERROR_TEXT, type ErrorCode, type SttEngine } from '../../core/types'
import { api, type MascotState } from './bridge'
import Mascot from './Mascot'

// The always-on-top recording pill. It owns the microphone and the local
// speech model, so dictation works while the main window is hidden.

let worker: Worker | undefined
let seq = 0
function localTranscribe(pcm: Float32Array | undefined, language: string, onProgress: (t: string) => void) {
  worker ??= new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  const id = ++seq
  const w = worker
  return new Promise<string>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data.type === 'progress') return onProgress(e.data.text)
      if (e.data.id !== id) return
      w.removeEventListener('message', onMsg)
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data.text)
    }
    w.addEventListener('message', onMsg)
    w.postMessage({ id, pcm, language })
  })
}

async function toPcm16k(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 })
  try {
    return (await ctx.decodeAudioData(await blob.arrayBuffer())).getChannelData(0)
  } finally {
    void ctx.close()
  }
}

const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / (a.length || 1))

interface Session {
  stream: MediaStream
  rec: MediaRecorder
  chunks: Blob[]
  audio: AudioContext
  raf: number
  cancelled: boolean
}

export default function Pill() {
  const [state, setState] = useState<MascotState>('idle')
  const [msg, setMsg] = useState('')
  const bars = useRef<HTMLDivElement>(null)
  const ses = useRef<Session | null>(null)
  const cfg = useRef({ language: 'en', engine: 'local' as SttEngine })

  useEffect(() => {
    const fail = (code: ErrorCode) => {
      setState('error')
      setMsg(ERROR_TEXT[code])
      api.send('pill:fail')
    }

    const teardown = () => {
      const s = ses.current
      if (!s) return
      cancelAnimationFrame(s.raf)
      s.stream.getTracks().forEach((t) => t.stop())
      void s.audio.close()
      ses.current = null
    }

    const start = async (c: { micId: string; language: string; engine: SttEngine; notice?: string }) => {
      cfg.current = c
      setState('listening')
      setMsg(c.notice ?? 'Listening…')
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: c.micId ? { deviceId: { exact: c.micId } } : true,
        })
      } catch (e) {
        const name = (e as DOMException).name
        return fail(name === 'NotAllowedError' ? 'mic_denied' : 'no_mic')
      }
      const audio = new AudioContext()
      const analyser = audio.createAnalyser()
      analyser.fftSize = 256
      audio.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const rec = new MediaRecorder(stream)
      const s: Session = { stream, rec, chunks: [], audio, raf: 0, cancelled: false }
      rec.ondataavailable = (e) => s.chunks.push(e.data)
      rec.onstop = () => void finish(s)
      const draw = () => {
        analyser.getByteFrequencyData(buf)
        const els = bars.current?.children
        if (els)
          for (let i = 0; i < els.length; i++) {
            const v = buf[2 + i * 4] / 255
            ;(els[i] as HTMLElement).style.transform = `scaleY(${0.15 + v * 0.85})`
          }
        s.raf = requestAnimationFrame(draw)
      }
      ses.current = s
      rec.start()
      draw()
    }

    const finish = async (s: Session) => {
      teardown()
      if (s.cancelled) return
      setState('transcribing')
      setMsg('Transcribing…')
      try {
        const blob = new Blob(s.chunks, { type: s.rec.mimeType })
        const pcm = await toPcm16k(blob)
        const seconds = pcm.length / 16000
        if (seconds < 0.4) return fail('too_short')
        if (rms(pcm) < 0.004) return fail('silence')
        let text: string
        if (cfg.current.engine === 'local') {
          text = await localTranscribe(pcm, cfg.current.language, setMsg)
        } else {
          const r = await api.invoke('stt:cloud', { audio: await blob.arrayBuffer(), seconds })
          if (r.error) return fail(r.error)
          text = r.text
        }
        api.send('pill:result', { text, seconds })
      } catch (e) {
        console.error(e)
        fail(navigator.onLine ? 'unknown' : 'offline')
      }
    }

    const offs = [
      api.on('pill:start', (c) => void start(c)),
      api.on('pill:stop', () => (ses.current ? ses.current.rec.stop() : fail('too_short'))),
      api.on('pill:cancel', () => {
        if (ses.current) {
          ses.current.cancelled = true
          ses.current.rec.stop()
        }
        setState('idle')
      }),
      api.on('pill:show', (a: { state: MascotState; message: string }) => {
        setState(a.state)
        setMsg(a.message)
      }),
      api.on('pill:preload', (language: string) => {
        api.send('pill:status', 'Loading speech model…')
        localTranscribe(undefined, language, (t) => api.send('pill:status', t)).then(
          () => api.send('pill:status', 'Speech model ready'),
          (e) => api.send('pill:status', `Could not load speech model: ${String(e).slice(0, 120)}`),
        )
      }),
    ]

    // Rasterize the mascot once for the tray and window icon.
    const svg = document.querySelector('#icon-src svg')
    if (svg) {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = 128
        c.getContext('2d')!.drawImage(img, 0, 0, 128, 128)
        api.send('pill:icon', c.toDataURL('image/png'))
      }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
    }
    return () => offs.forEach((off) => off())
  }, [])

  return (
    <div className={`pill pill-${state}`} role="status" aria-live="polite">
      <Mascot state={state} size={52} />
      <div className="pill-main">
        {state === 'listening' ? (
          <div className="bars" ref={bars} aria-hidden>
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        ) : null}
        <div className="pill-msg">{msg}</div>
      </div>
      {state === 'listening' && (
        <>
          <button className="pill-btn" title="Cancel (Esc)" aria-label="Cancel" onClick={() => api.send('pill:cancelClick')}>
            ✕
          </button>
          <button className="pill-btn primary" title="Finish" aria-label="Finish" onClick={() => api.send('pill:stopClick')}>
            ✓
          </button>
        </>
      )}
      {state === 'error' && (
        <button className="pill-btn primary wide" onClick={() => api.send('pill:retry')}>
          Retry
        </button>
      )}
      <div id="icon-src" hidden>
        <Mascot state="listening" size={128} />
      </div>
    </div>
  )
}
