import { isPaid } from './models'
import type { Model, UsageEntry } from './types'

// ~4 characters per token: good enough for a pre-run estimate.
export const estimateTokens = (text: string) => Math.ceil(text.length / 4)

export const costOf = (model: Model, inTokens: number, outTokens: number) =>
  (inTokens * model.inPerM + outTokens * model.outPerM) / 1e6

export function estimate(model: Model, system: string, text: string) {
  const inTokens = estimateTokens(system) + estimateTokens(text)
  // Rewrites come out roughly as long as the input.
  const outTokens = Math.max(40, estimateTokens(text))
  return { inTokens, outTokens, cost: costOf(model, inTokens, outTokens) }
}

export function spend(entries: UsageEntry[], now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week = new Date(day)
  week.setDate(day.getDate() - ((day.getDay() + 6) % 7)) // Monday
  const month = new Date(now.getFullYear(), now.getMonth(), 1)
  const since = (d: Date) => entries.reduce((s, e) => (e.ts >= d.getTime() ? s + e.cost : s), 0)
  return { day: since(day), week: since(week), month: since(month) }
}

export const freeCallsToday = (entries: UsageEntry[], now = new Date()) => {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return entries.filter((e) => e.free && e.kind === 'llm' && e.ts >= day).length
}

export type Decision = 'ok' | 'cap' | 'approval'

/** Gate for every model call. Free and local models always pass. */
export function decide(a: {
  model: Model
  estCost: number
  monthSpend: number
  capUsd: number
  approvalUsd: number
  approved: boolean
}): Decision {
  if (!isPaid(a.model)) return 'ok'
  if (a.capUsd > 0 && a.monthSpend + a.estCost > a.capUsd) return 'cap'
  if (a.approvalUsd > 0 && a.estCost >= a.approvalUsd && !a.approved) return 'approval'
  return 'ok'
}

export const usd = (n: number) => (n === 0 ? '$0.00' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)
