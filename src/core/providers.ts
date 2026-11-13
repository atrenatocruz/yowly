import Anthropic from '@anthropic-ai/sdk'
import { CLOUD_STT, PROVIDERS } from './models'
import { ProviderError, type ErrorCode, type Model, type SttEngine } from './types'

export interface ChatResult {
  text: string
  inTokens: number
  outTokens: number
  costUsd?: number // set when the provider reports the real charge
}

const fromStatus = (s: number): ErrorCode =>
  s === 401 || s === 403
    ? 'invalid_key'
    : s === 402
      ? 'insufficient_funds'
      : s === 429
        ? 'rate_limit'
        : s >= 500
          ? 'outage'
          : 'unknown'

async function httpError(res: Response): Promise<ProviderError> {
  const body = (await res.text().catch(() => '')).slice(0, 200)
  return new ProviderError(fromStatus(res.status), `HTTP ${res.status} ${body}`)
}

/** One entry point for every provider. OpenRouter, OpenAI, Gemini, Groq and
 *  Ollama all speak the OpenAI chat format; Anthropic uses its own SDK. */
export async function runChat(model: Model, apiKey: string, system: string, user: string): Promise<ChatResult> {
  if (model.provider === 'anthropic') return runAnthropic(model, apiKey, system, user)

  const isOR = model.provider === 'openrouter'
  let res: Response
  try {
    res = await fetch(`${PROVIDERS[model.provider].baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey || 'local'}` },
      body: JSON.stringify({
        model: model.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...(isOR ? { usage: { include: true } } : {}),
      }),
    })
  } catch {
    throw new ProviderError(model.provider === 'ollama' ? 'ollama_down' : 'offline')
  }
  if (!res.ok) throw await httpError(res)
  const j = await res.json()
  const text = j.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new ProviderError('unknown', 'Empty response')
  return {
    text: text.trim(),
    inTokens: j.usage?.prompt_tokens ?? 0,
    outTokens: j.usage?.completion_tokens ?? 0,
    costUsd: typeof j.usage?.cost === 'number' ? j.usage.cost : undefined,
  }
}

async function runAnthropic(model: Model, apiKey: string, system: string, user: string): Promise<ChatResult> {
  const client = new Anthropic({ apiKey })
  // Sonnet/Opus can decline via safety classifiers; let the API retry on its
  // default fallback model. Haiku has no server-side fallback.
  const withFallback = !model.model.includes('haiku')
  try {
    const res = await client.beta.messages.create({
      model: model.model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'low' },
      ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    })
    if (res.stop_reason === 'refusal') throw new ProviderError('refused')
    const text = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new ProviderError('unknown', 'Empty response')
    return { text, inTokens: res.usage.input_tokens, outTokens: res.usage.output_tokens }
  } catch (e) {
    if (e instanceof ProviderError) throw e
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new ProviderError('invalid_key')
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError('rate_limit')
    if (e instanceof Anthropic.APIConnectionError) throw new ProviderError('offline')
    if (e instanceof Anthropic.APIError) throw new ProviderError(fromStatus(e.status ?? 0), e.message)
    throw new ProviderError('unknown', String(e))
  }
}

export async function transcribeCloud(
  engine: Exclude<SttEngine, 'local'>,
  apiKey: string,
  audio: Blob,
  language: string,
): Promise<string> {
  const form = new FormData()
  form.append('file', audio, 'audio.webm')
  form.append('model', CLOUD_STT[engine].model)
  form.append('language', language)
  let res: Response
  try {
    res = await fetch(`${PROVIDERS[engine].baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    })
  } catch {
    throw new ProviderError('offline')
  }
  if (!res.ok) throw await httpError(res)
  return String((await res.json()).text ?? '')
}

export async function listOllama(): Promise<string[]> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) })
    const j = await res.json()
    return (j.models ?? []).map((x: { name: string }) => x.name)
  } catch {
    return []
  }
}

/** Public, key-less price list. Returns model id -> [inPerM, outPerM]. */
export async function fetchOpenRouterPrices(): Promise<Map<string, [number, number]>> {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw await httpError(res)
  const j = await res.json()
  return new Map(
    (j.data as { id: string; pricing: { prompt: string; completion: string } }[]).map((x) => [
      x.id,
      [Number(x.pricing.prompt) * 1e6, Number(x.pricing.completion) * 1e6],
    ]),
  )
}
