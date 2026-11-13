import type { ReactNode } from 'react'
import { spend, usd } from '../../../core/cost'
import type { Ctx } from '../App'

export function Num({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      aria-label={label}
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const n = Math.max(0, Number(e.target.value) || 0)
        if (n !== value) onChange(n)
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

export default function Usage({ st, set }: Ctx) {
  const s = st.settings
  const sp = spend(st.usage)
  const cap = s.monthlyCapUsd
  const pct = cap > 0 ? Math.min(100, (sp.month / cap) * 100) : 0
  const recent = [...st.usage].reverse().slice(0, 50)

  return (
    <section className="screen">
      <h1>Usage</h1>
      <div className="tiles">
        {(
          [
            ['Today', sp.day],
            ['This week', sp.week],
            ['This month', sp.month],
          ] as const
        ).map(([k, v]) => (
          <div className="tile" key={k}>
            <span className="muted small">{k}</span>
            <strong>{usd(v)}</strong>
          </div>
        ))}
      </div>

      <h2>Monthly cap</h2>
      {cap > 0 ? (
        <>
          <div className={pct >= 100 ? 'meter full' : pct >= 80 ? 'meter near' : 'meter'} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small">
            {usd(sp.month)} of {usd(cap)} used.{' '}
            {pct >= 100 ? 'Paid models are paused until next month or until you raise the cap.' : 'Paid calls stop when this is reached.'}
          </p>
        </>
      ) : (
        <p className="warn small">No cap set. Paid models can spend without limit.</p>
      )}
      <div className="grid2">
        <label className="field">
          <span>Cap in USD per month (0 = no cap)</span>
          <Num label="Monthly cap in USD" value={cap} onChange={(n) => void set({ monthlyCapUsd: n })} />
        </label>
        <label className="field">
          <span>Ask before calls above, USD (0 = never ask)</span>
          <Num label="Approval threshold in USD" value={s.approvalThresholdUsd} onChange={(n) => void set({ approvalThresholdUsd: n })} />
        </label>
      </div>
      <Toggle on={s.autoFallback} onChange={(v) => void set({ autoFallback: v })}>
        When the cap is reached, switch to a free or local model automatically (you'll see a notice)
      </Toggle>

      <h2>Recent activity</h2>
      {!recent.length ? (
        <p className="muted">Nothing yet. Local dictation and cleanup are always free.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Model</th>
              <th className="num">Tokens in</th>
              <th className="num">Tokens out</th>
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((e) => (
              <tr key={e.ts}>
                <td>{new Date(e.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                  {e.name} <span className="muted small">{e.kind === 'stt' ? 'transcription' : e.provider}</span>
                </td>
                <td className="num">{e.kind === 'stt' ? '' : e.inTokens}</td>
                <td className="num">{e.kind === 'stt' ? '' : e.outTokens}</td>
                <td className="num">{e.free ? 'free' : usd(e.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
