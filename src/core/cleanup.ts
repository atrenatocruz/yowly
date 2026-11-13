import type { CleanupPrefs } from './types'

// Free, offline, rule-based cleanup. Deliberately conservative: it only removes
// things that never carry meaning, so the user's wording is preserved.
const FILLERS = /(^|[\s,])(?:um+|uh+|erm+|er|ah+|hmm+|mm+)(?=[\s,.!?]|$)[,]?/gi
const ARTIFACTS = /\[(?:BLANK_AUDIO|MUSIC|NOISE|SILENCE)[^\]]*\]|\((?:silence|music|noise)[^)]*\)/gi

export function cleanup(raw: string, prefs: CleanupPrefs): string {
  let t = raw.replace(ARTIFACTS, ' ')
  if (prefs.fillers) t = t.replace(FILLERS, '$1')
  if (prefs.repeats) {
    // "the the" -> "the", "I think I think" -> "I think" (1-3 word stutters)
    for (let i = 0; i < 2; i++) t = t.replace(/\b(\w+(?:\s+\w+){0,2})([\s,]+\1\b)+/gi, '$1')
  }
  t = t
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/^[\s,]+/, '')
    .trim()
  if (prefs.punctuation && t) {
    t = t
      .replace(/\bi\b(?=$|[\s',.!?])/g, 'I')
      .replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    if (!/[.!?…:"')\]]$/.test(t)) t += '.'
  }
  return t
}
