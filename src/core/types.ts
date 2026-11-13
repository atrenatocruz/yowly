// Shared types. Everything in src/core is platform-neutral (no Electron, no DOM)
// so it can be reused unchanged by a React Native / iOS client.

export type ProviderId = 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama'
export type ModelLabel = 'Free' | 'Local' | 'Paid' | 'BYO key'

export interface Model {
  id: string // `${provider}:${model}`
  provider: ProviderId
  model: string
  name: string
  label: ModelLabel
  inPerM: number // USD per 1M input tokens
  outPerM: number // USD per 1M output tokens
  unavailable?: boolean
}

export interface Transform {
  id: string
  name: string
  instruction: string
}

export interface HistoryItem {
  id: string
  ts: number
  raw: string
  text: string
  seconds: number
  engine: SttEngine
}

export interface UsageEntry {
  ts: number
  kind: 'llm' | 'stt'
  name: string
  provider: string
  inTokens: number
  outTokens: number
  cost: number
  free: boolean
}

export type SttEngine = 'local' | 'groq' | 'openai'
export type PresetId = 'fast' | 'smart' | 'creative' | 'private' | 'free'

export interface CleanupPrefs {
  fillers: boolean
  repeats: boolean
  punctuation: boolean
}

export interface Settings {
  onboarded: boolean
  micId: string
  hotkey: string
  mode: 'toggle' | 'ptt'
  language: string
  sttEngine: SttEngine
  reviewBeforeInsert: boolean
  modelId: string
  presets: Record<PresetId, string>
  monthlyCapUsd: number // 0 = no cap
  autoFallback: boolean
  approvalThresholdUsd: number // 0 = never ask
  cleanup: CleanupPrefs
  retentionDays: number // 0 = don't keep history, -1 = keep forever
  consentCloudStt: boolean
  consentCloudLlm: boolean
  analytics: boolean
  theme: 'dark' | 'light'
  textScale: number
  transforms: Transform[]
}

export type ErrorCode =
  | 'mic_denied'
  | 'no_mic'
  | 'too_short'
  | 'silence'
  | 'offline'
  | 'outage'
  | 'invalid_key'
  | 'rate_limit'
  | 'insufficient_funds'
  | 'refused'
  | 'ollama_down'
  | 'no_key'
  | 'consent'
  | 'cap'
  | 'approval'
  | 'unknown'

export class ProviderError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code)
  }
}

export const ERROR_TEXT: Record<ErrorCode, string> = {
  mic_denied: 'Microphone access is blocked. Allow it in your system privacy settings, then retry.',
  no_mic: 'No microphone found. Plug one in or pick another in Settings.',
  too_short: 'That was too short to transcribe.',
  silence: "I didn't hear anything. Check your microphone and try again.",
  offline: "Can't reach the internet. Local transcription and local models still work.",
  outage: 'The provider is having problems right now. Try again or switch model.',
  invalid_key: 'That API key was rejected. Check it in Models.',
  rate_limit: 'Rate limit reached. Wait a moment or switch model.',
  insufficient_funds: 'Your provider account is out of credit.',
  refused: 'The model declined this request.',
  ollama_down: "Ollama isn't running. Start it to use local models.",
  no_key: 'Add an API key for this provider in Models.',
  consent: 'Cloud use needs your consent first.',
  cap: 'Monthly spending cap reached.',
  approval: 'This call needs your approval.',
  unknown: 'Something went wrong. Please try again.',
}
