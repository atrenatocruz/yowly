import { useEffect, useRef, useState } from 'react'
import { estimate, usd } from '../../../core/cost'
import { isCloud, isPaid, PRESET_NAMES, PROVIDERS } from '../../../core/models'
import { AGENT_SYSTEM, agentUser } from '../../../core/settings'
import { ERROR_TEXT, type ErrorCode, type Model, type ModelLabel, type PresetId } from '../../../core/types'
import { prettyKey, type Ctx } from '../App'
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

  return (
    <section
      className="screen dictate"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void insert()
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') void copy()
      }}
    >
      <header className="hero">
        <Mascot state={mascot} size={72} />
        <div>
          <h1>{STATUS[mascot]}</h1>
          <p className="muted">
            Press <kbd>{prettyKey(s.hotkey, st.platform)}</kbd> {s.mode === 'ptt' ? 'and hold to talk' : 'to start and stop'}
            {!st.hotkeyOk && <span className="warn"> · hotkey is taken by another app, change it in Settings</span>}
          </p>
        </div>
        <button className="btn primary big" onClick={() => api.invoke('dictation:toggle')}>
          {mascot === 'listening' ? 'Stop' : 'Dictate'}
        </button>
      </header>

      <textarea
        ref={area}
        className="editor"
        value={draft}
        placeholder="Your words land here. Edit freely, then insert or hand them to an agent."
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Transcript"
      />

      <div className="row wrap">
        {s.transforms.map((t) => (
          <button key={t.id} className="chip" disabled={busy} onClick={() => void run(t.instruction)}>
            {t.name}
          </button>
        ))}
        {prev !== null && (
          <button
            className="chip ghost"
            onClick={() => {
              setDraft(prev)
              setPrev(null)
            }}
          >
            Undo
          </button>
        )}
      </div>

      <form
        className="row"
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

      <div className="agentbar">
        <div className="row wrap">
          {(Object.keys(PRESET_NAMES) as PresetId[]).map((p) => (
            <button key={p} className={activePreset === p ? 'seg on' : 'seg'} onClick={() => preset(p)}>
              {PRESET_NAMES[p]}
            </button>
          ))}
          <span className="grow" />
          {model && <span className={`tag t-${model.label.replace(' ', '')}`}>{model.label}</span>}
          <ModelSelect models={st.models} value={s.modelId} onChange={(id) => void set({ modelId: id })} />
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

      <footer className="row end">
        <button className="btn" onClick={copy} disabled={!draft.trim()}>
          Copy <kbd>Ctrl ⇧ C</kbd>
        </button>
        <button className="btn primary" onClick={insert} disabled={!draft.trim()}>
          {st.canPaste ? 'Insert' : 'Copy to paste'} <kbd>Ctrl ↵</kbd>
        </button>
      </footer>
    </section>
  )
}
