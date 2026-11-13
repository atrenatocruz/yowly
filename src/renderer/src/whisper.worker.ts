import { pipeline } from '@huggingface/transformers'

// Local speech-to-text. Audio never leaves the device; the model files are
// downloaded once from Hugging Face and cached by the browser engine.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any
let loaded = ''
let lastStep = -1

async function ensure(language: string) {
  const model = language === 'en' ? 'Xenova/whisper-base.en' : 'Xenova/whisper-base'
  if (loaded === model) return
  asr = await pipeline('automatic-speech-recognition', model, {
    dtype: 'q8',
    progress_callback: (p: { status: string; file?: string; progress?: number }) => {
      if (p.status !== 'progress' || !p.file?.endsWith('.onnx')) return
      const step = Math.floor((p.progress ?? 0) / 25) * 25 // report at 0/25/50/75/100 only
      if (step === lastStep) return
      lastStep = step
      postMessage({ type: 'progress', text: `Downloading speech model… ${step}%` })
    },
  })
  loaded = model
}

self.onmessage = async (e: MessageEvent<{ id: number; pcm?: Float32Array; language: string }>) => {
  const { id, pcm, language } = e.data
  try {
    await ensure(language)
    if (!pcm) return postMessage({ id, text: '' }) // preload only
    const out = await asr(pcm, {
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(language === 'en' ? {} : { language, task: 'transcribe' }),
    })
    postMessage({ id, text: out.text ?? '' })
  } catch (err) {
    postMessage({ id, error: String(err) })
  }
}
