import { useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../bridge'
import Mascot from '../Mascot'

const when = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function History({ st, go, setDraft, dialog }: Ctx) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const items = needle ? st.history.filter((h) => h.text.toLowerCase().includes(needle)) : st.history

  return (
    <section className="screen">
      <header className="row">
        <h1 className="grow">History</h1>
        <input autoFocus type="search" placeholder="Search transcripts…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search history" />
        <button
          className="btn"
          disabled={!st.history.length}
          onClick={() =>
            dialog({
              title: 'Delete all history and usage data?',
              body: <p>This removes every saved transcript and the usage log from this device. It can't be undone.</p>,
              actions: [{ label: 'Cancel' }, { label: 'Delete everything', primary: true, run: () => api.invoke('data:deleteAll') }],
            })
          }
        >
          Clear all
        </button>
      </header>
      <p className="muted small">
        Stored only on this device
        {st.settings.retentionDays > 0 ? `, kept for ${st.settings.retentionDays} days` : st.settings.retentionDays === 0 ? '. History is off' : ', kept until you delete it'}.
      </p>

      {!items.length ? (
        <div className="empty">
          <Mascot state="idle" size={96} />
          <p>{needle ? 'Nothing matches that search.' : 'No transcripts yet. Your dictations will appear here.'}</p>
        </div>
      ) : (
        <ul className="list">
          {items.map((h) => (
            <li key={h.id}>
              <button
                className="item"
                onClick={() => {
                  setDraft(h.text)
                  go('dictate')
                }}
              >
                <span className="item-text">{h.text}</span>
                <span className="muted small">
                  {when(h.ts)} · {Math.round(h.seconds)}s · {h.engine === 'local' ? 'local' : `${h.engine} cloud`}
                </span>
              </button>
              <button className="icon" aria-label="Delete transcript" title="Delete" onClick={() => api.invoke('history:delete', h.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
