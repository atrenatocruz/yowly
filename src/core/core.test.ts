import { describe, expect, it } from 'vitest'
import { cleanup } from './cleanup'
import { costOf, decide, estimate, freeCallsToday, spend } from './cost'
import { CATALOG } from './models'
import type { UsageEntry } from './types'

const all = { fillers: true, repeats: true, punctuation: true }
const paid = CATALOG.find((m) => m.id === 'openrouter:anthropic/claude-sonnet-5.5')!
const free = CATALOG.find((m) => m.label === 'Free')!

describe('cleanup', () => {
  it('removes fillers and fixes caps and punctuation', () => {
    expect(cleanup('um so i think uh we should ship it', all)).toBe('So I think we should ship it.')
  })
  it('collapses stutters', () => {
    expect(cleanup('the the plan is is good. i think i think it works', all)).toBe(
      'The plan is good. I think it works.',
    )
  })
  it('strips whisper artifacts and returns empty for silence', () => {
    expect(cleanup(' [BLANK_AUDIO] ', all)).toBe('')
  })
  it('keeps meaning-bearing words such as "like"', () => {
    expect(cleanup('I like this', all)).toBe('I like this.')
  })
  it('does nothing beyond whitespace when all prefs are off', () => {
    expect(cleanup('um  hello hello', { fillers: false, repeats: false, punctuation: false })).toBe(
      'um hello hello',
    )
  })
})

describe('cost', () => {
  it('prices tokens per million', () => {
    expect(costOf(paid, 1_000_000, 1_000_000)).toBe(12)
    expect(estimate(free, 'sys', 'hello world').cost).toBe(0)
  })
  const base = { estCost: 0.01, monthSpend: 0, capUsd: 5, approvalUsd: 0.05, approved: false }
  it('lets free models through even over the cap', () => {
    expect(decide({ ...base, model: free, monthSpend: 99 })).toBe('ok')
  })
  it('blocks paid calls that would exceed the cap', () => {
    expect(decide({ ...base, model: paid, monthSpend: 4.995 })).toBe('cap')
    expect(decide({ ...base, model: paid, monthSpend: 4.98 })).toBe('ok')
  })
  it('requires approval for expensive calls until approved', () => {
    expect(decide({ ...base, model: paid, estCost: 0.2 })).toBe('approval')
    expect(decide({ ...base, model: paid, estCost: 0.2, approved: true })).toBe('ok')
  })
  it('treats cap 0 as no cap', () => {
    expect(decide({ ...base, model: paid, monthSpend: 1000, capUsd: 0 })).toBe('ok')
  })
  it('sums spend by day, week and month', () => {
    const now = new Date(2026, 10, 13, 12) // Fri 13 Nov 2026
    const e = (d: Date, cost: number, isFree = false): UsageEntry => ({
      ts: d.getTime(), kind: 'llm', name: 'x', provider: 'x', inTokens: 0, outTokens: 0, cost, free: isFree,
    })
    const entries = [
      e(new Date(2026, 10, 13, 9), 1, true),
      e(new Date(2026, 10, 10), 2), // Tuesday, same week
      e(new Date(2026, 10, 2), 4), // earlier this month
      e(new Date(2026, 9, 30), 8), // last month
    ]
    expect(spend(entries, now)).toEqual({ day: 1, week: 3, month: 7 })
    expect(freeCallsToday(entries, now)).toBe(1)
  })
})
