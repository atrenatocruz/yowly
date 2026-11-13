import { useState } from 'react'
import { freeCallsToday, usd } from '../../../core/cost'
import { FREE_DAILY_LIMIT, PRESET_NAMES, PROVIDERS } from '../../../core/models'
import { ERROR_TEXT, type ErrorCode, type PresetId, type ProviderId } from '../../../core/types'
import type { Ctx } from '../App'
import { api } from '../bridge'
import { ModelSelect } from './Dictate'

const CLOUD = (Object.keys(PROVIDERS) as ProviderId[]).filter((p) => p !== 'ollama')

function KeyRow({ provider, has }: { provider: ProviderId; has: boolean }) {
  const [val, setVal] = useState('')
  const p = PROVIDERS[provider]
  return (
    <form
      className="row keyrow"
      onSubmit={(e) => {
        e.preventDefault()
        if (!val.trim()) return
        void api.invoke('keys:set', { provider, key: val })
        setVal('')
      }}
    >
      <div className="keyname">
        <b>{p.name}</b>
        <span className="muted small">{has ? 'Key saved in your OS keychain' : `Get a key at ${p.keyHint}`}</span>
      </div>
      <input className="grow" type="password" autoComplete="off" placeholder={has ? '••••••••  (saved)' : 'Paste API key'} value={val} onChange={(e) => setVal(e.target.value)} aria-label={`${p.name} API key`} />
      <button className="btn" disabled={!val.trim()}>
        Save
      </button>
      {has && (
        <button type="button" className="btn" onClick={() => api.invoke('keys:set', { provider })}>
          Remove
        </button>
      )}
    </form>
  )
}

export default function Models({ st, set, toast }: Ctx) {
  const s = st.settings
  const [busy, setBusy] = useState(false)
  const locals = st.models.filter((m) => m.provider === 'ollama')
  const freeUsed = freeCallsToday(st.usage)

  const refresh = async () => {
    setBusy(true)
    const r = await api.invoke('models:refresh')
    setBusy(false)
    toast(r.ok ? 'Prices and availability updated.' : ERROR_TEXT[r.code as ErrorCode])
  }

  return (
    <section className="screen">
      <header className="row">
        <h1 className="grow">Models</h1>
        <button className="btn" onClick={refresh} disabled={busy}>
          {busy ? 'Refreshing…' : 'Refresh prices'}
        </button>
      </header>

      <div className="card">
      <h2>Default agent</h2>
      <div className="row wrap">
        <ModelSelect models={st.models} value={s.modelId} onChange={(id) => void set({ modelId: id })} />
        <span className="muted small">
          Free calls today: {freeUsed} of about {FREE_DAILY_LIMIT} (OpenRouter's free allowance)
        </span>
      </div>

      </div>
      <div className="card">
      <h2>Presets</h2>
      <div className="grid2">
        {(Object.keys(PRESET_NAMES) as PresetId[]).map((p) => (
          <label key={p} className="field">
            <span>{PRESET_NAMES[p]}</span>
            {p === 'private' ? (
              <span className="muted small">{locals.length ? `Uses ${locals[0].name} via Ollama` : 'Ollama not detected. Install it and pull a model.'}</span>
            ) : (
              <ModelSelect models={st.models} value={s.presets[p]} onChange={(id) => void set({ presets: { ...s.presets, [p]: id } })} />
            )}
          </label>
        ))}
      </div>

      </div>
      <div className="card">
      <h2>API keys</h2>
      <p className="muted small">Keys are encrypted by your operating system and never written to config files or logs. OpenRouter is all you need for the Free and Paid lists.</p>
      {CLOUD.map((p) => (
        <KeyRow key={p} provider={p} has={!!st.keys[p]} />
      ))}

      </div>
      <div className="card">
      <h2>All models</h2>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Provider</th>
            <th>Type</th>
            <th className="num">In / 1M</th>
            <th className="num">Out / 1M</th>
          </tr>
        </thead>
        <tbody>
          {st.models.map((m) => (
            <tr key={m.id} className={m.unavailable ? 'dim' : ''}>
              <td>
                {m.name}
                {m.unavailable && ' (unavailable)'}
              </td>
              <td>{PROVIDERS[m.provider].name}</td>
              <td>
                <span className={`tag t-${m.label.replace(' ', '')}`}>{m.label}</span>
              </td>
              <td className="num">{m.inPerM ? usd(m.inPerM) : 'free'}</td>
              <td className="num">{m.outPerM ? usd(m.outPerM) : 'free'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  )
}
