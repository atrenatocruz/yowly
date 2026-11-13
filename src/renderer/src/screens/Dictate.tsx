import { useEffect, useRef, useState } from 'react'
import { estimate, spend, usd } from '../../../core/cost'
import { isCloud, isPaid, PRESET_NAMES, PROVIDERS } from '../../../core/models'
import { AGENT_SYSTEM, agentUser } from '../../../core/settings'
import { ERROR_TEXT, type ErrorCode, type Model, type ModelLabel, type PresetId } from '../../../core/types'
import { Icon, prettyKey, type Ctx } from '../App'
import { api } from '../bridge'
import Mascot from '../Mascot'

const GROUPS: ModelLabel[] = ['Free', 'Local', 'Paid', 'BYO key']
const STATUS: Record<string, string> = {
  idle: 'Ready when you are',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  thinking: 'Thinking…',
  success: 'Done',
  error: 'Something went wrong',
}

export function ModelSelect({ models, value, onChange }: { models: Model[]; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Model">
      {GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {models
            .filter((m) => m.label === g)
            .map((m) => (
              <option key={m.id} value={m.id} disabled={m.unavailable}>
                {m.name} · {PROVIDERS[m.provider].name}
                {m.unavailable ? ' (unavailable)' : ''}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}

interface RunResult {
  text: string
  inTokens: number
  outTokens: number
  cost: number
  modelName: string
  notice?: string
}

export default function Dictate(ctx: Ctx) {
  const { st, set, toast, go, dialog, draft, setDraft, mascot, setMascot } = ctx
  const s = st.settings
  const [busy, setBusy] = useState(false)
  const [prev, setPrev] = useState<string | null>(null)
  const [last, setLast] = useState<RunResult | null>(null)
  const [ask, setAsk] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)

  const model = st.models.find((m) => m.id === s.modelId)
  const est = model && draft ? estimate(model, AGENT_SYSTEM, agentUser('x'.repeat(60), draft)) : null

  useEffect(() => area.current?.focus(), [])

  const run = async (instruction: string, opts: { approved?: boolean; useFallback?: boolean } = {}) => {
    if (!draft.trim()) return toast('Dictate or type some text first.')
    if (!model) return toast('Pick a model first.')
    setBusy(true)
    setMascot('thinking')
    const r = await api.invoke('agent:run', { modelId: model.id, text: draft, instruction, ...opts })
    setBusy(false)
    if (!r.error) {
      setMascot('success')
      setTimeout(() => setMascot('idle'), 1500)
      setPrev(draft)
      setDraft(r.text)
      setLast(r)
      if (r.notice) toast(r.notice)
      return
    }
    setMascot('idle')
    const code = r.error.code as ErrorCode
    if (code === 'consent')
      dialog({
        title: 'Send text to a cloud model?',
        body: (
          <p>
            This sends the text in the editor to <b>{PROVIDERS[model.provider].name}</b> to be processed. Audio is never
            sent. You can turn this off in Settings at any time.
          </p>
        ),
        actions: [{ label: 'Not now' }, { label: 'Allow cloud models', primary: true, run: () => void set({ consentCloudLlm: true }).then(() => run(instruction, opts)) }],
      })
    else if (code === 'approval')
      dialog({
        title: 'Approve this call?',
        body: (
          <p>
            {model.name} will cost about <b>{usd(r.error.est)}</b> for this text, which is above your approval limit of{' '}
            {usd(s.approvalThresholdUsd)}.
          </p>
        ),
        actions: [{ label: 'Cancel' }, { label: `Run for ~${usd(r.error.est)}`, primary: true, run: () => void run(instruction, { ...opts, approved: true }) }],
      })
    else if (code === 'cap')
      dialog({
        title: 'Monthly cap reached',
        body: (
          <p>
            You've set a cap of {usd(s.monthlyCapUsd)} per month, so paid models are paused. Nothing was charged and your
            text is untouched.
          </p>
        ),
        actions: [
          { label: 'Change cap', run: () => go('usage') },
          r.error.fallback
            ? { label: `Use ${r.error.fallback} (free)`, primary: true, run: () => void run(instruction, { ...opts, useFallback: true }) }
            : { label: 'OK', primary: true },
        ],
      })
    else if (code === 'no_key') {
      toast(`Add your ${PROVIDERS[model.provider].name} key to use ${model.name}.`)
      go('models')
    } else {
      setMascot('error')
      setTimeout(() => setMascot('idle'), 2500)
      toast(ERROR_TEXT[code] ?? ERROR_TEXT.unknown)
    }
  }

  const insert = async () => {
    if (!draft.trim()) return
    const how = await api.invoke('output:insert', draft)
    toast(how === 'pasted' ? 'Inserted into the previous app.' : 'Copied to clipboard. Paste with Ctrl+V.')
  }
  const copy = async () => {
    if (!draft.trim()) return
    await api.invoke('output:copy', draft)
    toast('Copied to clipboard.')
  }
  const preset = (p: PresetId) => {
    const id = p === 'private' ? st.models.find((m) => m.provider === 'ollama')?.id : s.presets[p]
    if (!id) return toast('No local model found. Install Ollama and pull a model.')
    void set({ modelId: id })
  }
  const activePreset = (Object.keys(PRESET_NAMES) as PresetId[]).find((p) =>
    p === 'private' ? model?.provider === 'ollama' : s.presets[p] === s.modelId,
  )

  // Last 7 days of dictations, oldest first, for the activity card.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const counts = week.map((d) => st.history.filter((h) => h.ts >= d.getTime() && h.ts < d.getTime() + 864e5).length)
  const top = Math.max(1, ...counts)
  const points = counts.map((c, i) => `${10 + i * 30},${50 - (c / top) * 40}`).join(' ')
  const month = spend(st.usage).month
  const cap = s.monthlyCapUsd
  const pct = cap > 0 ? Math.min(100, (month / cap) * 100) : 0

  return (
    <section
      className="screen dictate"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void insert()
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') void copy()
      }}
    >
      <div className="col">
        <header className="hero">
          <Mascot state={mascot} size={46} />
          <div>
            <h1>{STATUS[mascot]}</h1>
            <p className="muted small">Edit your words, hand them to an agent, then insert.</p>
          </div>
        </header>

        <div className="card editor-card">
          <textarea
            ref={area}
            className="editor"
            value={draft}
            placeholder="Your words land here."
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Transcript"
          />
          <div className="row end">
            {prev !== null && (
              <button
                className="btn ghost"
                onClick={() => {
                  setDraft(prev)
                  setPrev(null)
                }}
              >
                Undo
              </button>
            )}
            <button className="btn" onClick={copy} disabled={!draft.trim()}>
              Copy <kbd>Ctrl ⇧ C</kbd>
            </button>
            <button className="btn primary" onClick={insert} disabled={!draft.trim()}>
              {st.canPaste ? 'Insert' : 'Copy to paste'} <kbd>Ctrl ↵</kbd>
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Transform</h2>
          <div className="row wrap">
            {s.transforms.map((t) => (
              <button key={t.id} className="chip" disabled={busy} onClick={() => void run(t.instruction)}>
                {t.name}
              </button>
            ))}
          </div>
          <form
            className="row askrow"
            onSubmit={(e) => {
              e.preventDefault()
              if (ask.trim()) void run(ask.trim())
            }}
          >
            <input className="grow" placeholder="Or tell the agent what to do with this text…" value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="Custom instruction" />
            <button className="btn" disabled={busy || !ask.trim()}>
              {busy ? 'Working…' : 'Run'}
            </button>
          </form>
        </div>

        <div className="card agentbar">
          <div className="row wrap">
            <h2 className="grow">Agent</h2>
            {model && <span className={`tag t-${model.label.replace(' ', '')}`}>{model.label}</span>}
            <ModelSelect models={st.models} value={s.modelId} onChange={(id) => void set({ modelId: id })} />
          </div>
          <div className="segs">
            {(Object.keys(PRESET_NAMES) as PresetId[]).map((p) => (
              <button key={p} className={activePreset === p ? 'seg on' : 'seg'} onClick={() => preset(p)}>
                {PRESET_NAMES[p]}
              </button>
            ))}
          </div>
          <p className="muted small">
            {!model
              ? 'No model selected.'
              : !isPaid(model)
                ? isCloud(model)
                  ? 'Free model. No charge.'
                  : 'Runs on this device. Nothing leaves your computer.'
                : est
                  ? `Estimate per action: ${usd(est.cost)} (about ${est.inTokens} tokens in, ${est.outTokens} out)`
                  : `${usd(model.inPerM)} in / ${usd(model.outPerM)} out per 1M tokens`}
            {last && (
              <>
                {' · '}Last run: {last.modelName}, {last.inTokens} in / {last.outTokens} out, <b>{usd(last.cost)}</b>
              </>
            )}
          </p>
        </div>
      </div>

      <aside className="rail" aria-label="Dictation">
        <button className="cta" onClick={() => api.invoke('dictation:toggle')}>
          <span className="cta-icon">
            <Icon name="dictate" />
          </span>
          {mascot === 'listening' ? 'Stop dictation' : 'Start dictation'}
        </button>

        <div className="hint">
          <kbd>{prettyKey(s.hotkey, st.platform)}</kbd>
          <span>{s.mode === 'ptt' ? 'Hold anywhere to talk' : 'Press anywhere to start and stop'}</span>
          {!st.hotkeyOk && <span className="warn">This hotkey is taken by another app. Change it in Settings.</span>}
        </div>

        <div className="stat">
          <strong>{counts.reduce((a, b) => a + b, 0)}</strong>
          <span>Dictations this week</span>
          <svg viewBox="0 0 200 58" aria-hidden="true">
            <polyline points={points} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={190} cy={50 - (counts[6] / top) * 40} r="4" fill="#fff" />
          </svg>
          <div className="days">
            {week.map((d) => (
              <span key={d.getTime()}>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            ))}
          </div>
        </div>

        <div className="card spendcard">
          <span className="muted small">Spent this month</span>
          <strong>{usd(month)}</strong>
          {cap > 0 ? (
            <>
              <div className={pct >= 100 ? 'meter full' : pct >= 80 ? 'meter near' : 'meter'}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="muted small">of your {usd(cap)} cap</span>
            </>
          ) : (
            <span className="warn small">No cap set</span>
          )}
          <button className="btn" onClick={() => go('usage')}>
            Usage and limits
          </button>
        </div>
      </aside>
    </section>
  )
}
