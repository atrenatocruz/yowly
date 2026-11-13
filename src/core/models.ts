import type { Model, ModelLabel, PresetId, ProviderId, SttEngine } from './types'

export const PROVIDERS: Record<ProviderId, { name: string; baseUrl: string; keyHint: string }> = {
  openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyHint: 'openrouter.ai/keys' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyHint: 'platform.openai.com' },
  anthropic: { name: 'Anthropic', baseUrl: 'https://api.anthropic.com', keyHint: 'platform.claude.com' },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyHint: 'aistudio.google.com',
  },
  groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyHint: 'console.groq.com' },
  ollama: { name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', keyHint: '' },
}

const m = (
  provider: ProviderId,
  model: string,
  name: string,
  label: ModelLabel,
  inPerM = 0,
  outPerM = 0,
): Model => ({ id: `${provider}:${model}`, provider, model, name, label, inPerM, outPerM })

// OpenRouter IDs and prices checked against openrouter.ai/api/v1/models on 2026-11-13.
// "Refresh prices" in the app re-syncs them. Direct-provider IDs mirror those slugs.
export const CATALOG: Model[] = [
  m('openrouter', 'google/gemma-4-31b-it:free', 'Gemma 4 31B', 'Free'),
  m('openrouter', 'google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B', 'Free'),
  m('openrouter', 'nvidia/nemotron-3.5-lightning:free', 'Nemotron 3.5 Lightning', 'Free'),
  m('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra', 'Free'),
  m('openrouter', 'liquid/lfm-3-1.7b:free', 'Liquid LFM 3', 'Free'),
  m('openrouter', 'baidu/ernie-5.5-flash-preview:free', 'ERNIE 5.5 Flash', 'Free'),

  m('openrouter', 'openai/gpt-6-luna', 'GPT-6 Luna', 'Paid', 0.1, 0.5),
  m('openrouter', 'anthropic/claude-haiku-5.5', 'Claude Haiku 5.5', 'Paid', 0.1, 0.5),
  m('openrouter', 'deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash', 'Paid', 0.09, 0.18),
  m('openrouter', 'meta-llama/llama-4-scout', 'Llama 4 Scout', 'Paid', 0.1, 0.3),
  m('openrouter', 'google/gemini-3.8-flash', 'Gemini 3.8 Flash', 'Paid', 0.83, 4.13),
  m('openrouter', 'anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5', 'Paid', 2, 10),
  m('openrouter', 'openai/gpt-6.1-sol', 'GPT-6.1 Sol', 'Paid', 2, 10),
  m('openrouter', 'anthropic/claude-opus-5.5', 'Claude Opus 5.5', 'Paid', 4, 20),

  m('openai', 'gpt-6-luna', 'GPT-6 Luna', 'BYO key', 0.1, 0.5),
  m('openai', 'gpt-6.1-sol', 'GPT-6.1 Sol', 'BYO key', 2, 10),
  m('anthropic', 'claude-haiku-5-5', 'Claude Haiku 5.5', 'BYO key', 0.1, 0.5),
  m('anthropic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 'BYO key', 2, 10),
  m('anthropic', 'claude-opus-5-5', 'Claude Opus 5.5', 'BYO key', 4, 20),
  m('gemini', 'gemini-3.8-flash', 'Gemini 3.8 Flash', 'BYO key', 0.83, 4.13),
  m('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', 'BYO key', 0.59, 0.79),
]

export const DEFAULT_PRESETS: Record<PresetId, string> = {
  fast: 'openrouter:openai/gpt-6-luna',
  smart: 'openrouter:anthropic/claude-sonnet-5.5',
  creative: 'openrouter:openai/gpt-6.1-sol',
  private: '', // resolved to the first installed Ollama model
  free: 'openrouter:google/gemma-4-31b-it:free',
}

export const PRESET_NAMES: Record<PresetId, string> = {
  fast: 'Fast',
  smart: 'Smart',
  creative: 'Creative',
  private: 'Private',
  free: 'Free',
}

export const CLOUD_STT: Record<Exclude<SttEngine, 'local'>, { name: string; model: string; perMin: number }> = {
  groq: { name: 'Groq Whisper', model: 'whisper-large-v3-turbo', perMin: 0.04 / 60 },
  openai: { name: 'OpenAI Whisper', model: 'whisper-1', perMin: 0.006 },
}

// OpenRouter's documented free-model allowance for accounts without credits.
export const FREE_DAILY_LIMIT = 50

export const isPaid = (x: Model) => x.inPerM > 0 || x.outPerM > 0
export const isCloud = (x: Model) => x.provider !== 'ollama'
export const ollamaModel = (name: string): Model => m('ollama', name, name, 'Local')
