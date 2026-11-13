import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, screen, session, Tray } from 'electron'
import { join } from 'node:path'
import { cleanup } from '../core/cleanup'
import { costOf, decide, estimate, spend } from '../core/cost'
import { CATALOG, CLOUD_STT, isCloud, isPaid, ollamaModel } from '../core/models'
import { fetchOpenRouterPrices, listOllama, runChat, transcribeCloud } from '../core/providers'
import { AGENT_SYSTEM, agentUser, DEFAULT_SETTINGS } from '../core/settings'
import { ProviderError, type ErrorCode, type HistoryItem, type Model, type Settings, type SttEngine, type UsageEntry } from '../core/types'
import { getKeys, read, setKey, write } from './store'
import { devShots } from './devshot'

type Phase = 'idle' | 'recording' | 'processing'

let settings: Settings
let history: HistoryItem[]
let usage: UsageEntry[]
let catalog: Model[] = CATALOG.map((m) => ({ ...m }))
let ollama: Model[] = []
let mainWin: BrowserWindow
let pill: BrowserWindow
let tray: Tray | undefined
let quitting = false
let phase: Phase = 'idle'
let startedAt = 0
let engine: SttEngine = 'local'
let hotkeyOk = false
let hideTimer: NodeJS.Timeout | undefined
let hook: typeof import('uiohook-napi') | undefined // native keys: push-to-talk + paste

const models = () => [...catalog, ...ollama]
const findModel = (id: string) => models().find((m) => m.id === id)
const broadcast = () => mainWin?.webContents.send('changed')
const saveSettings = () => write('settings.json', settings)
const saveHistory = () => write('history.json', history)
const saveUsage = () => write('usage.json', usage)

function pruneHistory() {
  const d = settings.retentionDays
  if (d === 0) history = []
  else if (d > 0) history = history.filter((h) => h.ts > Date.now() - d * 864e5)
}

function record(e: Omit<UsageEntry, 'ts'>) {
  usage.push({ ts: Date.now(), ...e })
  saveUsage()
}

// ---------- windows ----------

const preload = join(__dirname, '../preload/index.js')
function load(win: BrowserWindow, hash: string) {
  const dev = process.env.ELECTRON_RENDERER_URL
  if (dev) win.loadURL(`${dev}/${hash}`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash: hash.slice(1) })
}

const overlay = () =>
  settings.theme === 'dark'
    ? { color: '#141311', symbolColor: '#ece7df', height: 40 }
    : { color: '#f7f3ec', symbolColor: '#1e1b17', height: 40 }

function createWindows() {
  mainWin = new BrowserWindow({
    width: 1080,
    height: 740,
    minWidth: 860,
    minHeight: 560,
    show: false,
    backgroundColor: overlay().color,
    titleBarStyle: 'hidden',
    titleBarOverlay: overlay(),
    webPreferences: { preload, sandbox: true },
  })
  load(mainWin, '')
  mainWin.once('ready-to-show', () => mainWin.show())
  mainWin.on('close', (e) => {
    if (quitting) return
    e.preventDefault() // keep running in the tray so the hotkey still works
    mainWin.hide()
  })

  pill = new BrowserWindow({
    width: 360,
    height: 84,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false, // never steal focus from the app being dictated into
    hasShadow: false,
    show: false,
    webPreferences: { preload, sandbox: true, backgroundThrottling: false },
  })
  pill.setAlwaysOnTop(true, 'screen-saver')
  load(pill, '#pill')
}

function showPill() {
  clearTimeout(hideTimer)
  const { workArea: a } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  pill.setPosition(Math.round(a.x + (a.width - 360) / 2), a.y + a.height - 84 - 28)
  pill.showInactive()
}
function pillShow(state: 'success' | 'error', message: string, ms = 1600) {
  pill.webContents.send('pill:show', { state, message })
  mainWin.webContents.send('dictation', state)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    pill.hide()
    mainWin.webContents.send('dictation', 'idle')
  }, ms)
}

function showMain() {
  if (mainWin.isMinimized()) mainWin.restore()
  mainWin.show()
  mainWin.focus()
}

// ---------- dictation ----------

function pickEngine(): { engine: SttEngine; notice?: string } {
  const e = settings.sttEngine
  if (e === 'local') return { engine: 'local' }
  const local = (notice: string) => ({ engine: 'local' as const, notice })
  if (!settings.consentCloudStt) return local('Cloud transcription not allowed yet. Using local.')
  if (!getKeys()[e]) return local(`No ${CLOUD_STT[e].name} key. Using local.`)
  if (settings.monthlyCapUsd > 0 && spend(usage).month >= settings.monthlyCapUsd)
    return local('Monthly cap reached. Using local transcription.')
  return { engine: e }
}

function startDictation() {
  if (phase !== 'idle') return
  phase = 'recording'
  startedAt = Date.now()
  const pick = pickEngine()
  engine = pick.engine
  showPill()
  pill.webContents.send('pill:start', { micId: settings.micId, language: settings.language, ...pick })
  mainWin.webContents.send('dictation', 'listening')
  globalShortcut.register('Escape', cancelDictation)
}

function stopDictation() {
  if (phase !== 'recording') return
  // A tap in push-to-talk mode is almost always an accident.
  if (settings.mode === 'ptt' && Date.now() - startedAt < 300) return cancelDictation()
  phase = 'processing'
  globalShortcut.unregister('Escape')
  pill.webContents.send('pill:stop')
  mainWin.webContents.send('dictation', 'transcribing')
}

function cancelDictation() {
  if (phase === 'idle') return
  phase = 'idle'
  globalShortcut.unregister('Escape')
  pill.webContents.send('pill:cancel')
  pill.hide()
  mainWin.webContents.send('dictation', 'idle')
}

function onHotkey() {
  if (settings.mode === 'ptt') startDictation() // key repeat while held is ignored
  else if (phase === 'idle') startDictation()
  else stopDictation()
}

function registerHotkey() {
  globalShortcut.unregisterAll()
  try {
    hotkeyOk = globalShortcut.register(settings.hotkey, onHotkey)
  } catch {
    hotkeyOk = false
  }
}

async function insertText(text: string): Promise<'pasted' | 'clipboard'> {
  clipboard.writeText(text)
  if (!hook) return 'clipboard'
  if (mainWin.isFocused()) {
    // Hand focus back to the app the user was in.
    if (process.platform === 'darwin') app.hide()
    else mainWin.minimize()
    await new Promise((r) => setTimeout(r, 250))
  }
  const { uIOhook, UiohookKey } = hook
  uIOhook.keyTap(UiohookKey.V, [process.platform === 'darwin' ? UiohookKey.Meta : UiohookKey.Ctrl])
  return 'pasted'
}

const insertedText = (how: 'pasted' | 'clipboard') =>
  how === 'pasted' ? 'Inserted' : 'Copied. Press Ctrl+V to paste'

async function onTranscript(raw: string, seconds: number) {
  phase = 'idle'
  const text = cleanup(raw, settings.cleanup)
  if (!text) return pillShow('error', "Didn't catch that", 2200)
  const item: HistoryItem = { id: crypto.randomUUID(), ts: Date.now(), raw, text, seconds, engine }
  if (settings.retentionDays !== 0) {
    history.unshift(item)
    pruneHistory()
    saveHistory()
  }
  broadcast()
  if (settings.reviewBeforeInsert) {
    pillShow('success', 'Ready to review', 900)
    showMain()
    mainWin.webContents.send('review:open', { text, id: item.id })
  } else {
    pillShow('success', insertedText(await insertText(text)))
  }
}

// ---------- agent ----------

type AgentError = { error: { code: ErrorCode; message?: string; est?: number; fallback?: string } }

function fallbackModel(): Model | undefined {
  if (getKeys().openrouter) return catalog.find((m) => m.label === 'Free' && !m.unavailable)
  return ollama[0]
}

async function runAgent(a: { modelId: string; text: string; instruction: string; approved?: boolean; useFallback?: boolean }) {
  let model = findModel(a.modelId)
  if (!model) return { error: { code: 'unknown', message: 'Model not found' } } satisfies AgentError
  if (isCloud(model) && !settings.consentCloudLlm) return { error: { code: 'consent' } } satisfies AgentError

  const user = agentUser(a.instruction, a.text)
  let notice: string | undefined
  const est = estimate(model, AGENT_SYSTEM, user)
  const gate = decide({
    model,
    estCost: est.cost,
    monthSpend: spend(usage).month,
    capUsd: settings.monthlyCapUsd,
    approvalUsd: settings.approvalThresholdUsd,
    approved: !!a.approved,
  })
  if (gate === 'cap') {
    const fb = fallbackModel()
    if (!fb || !(settings.autoFallback || a.useFallback))
      return { error: { code: 'cap', fallback: fb?.name } } satisfies AgentError
    notice = `Monthly cap reached. Used ${fb.name} instead.`
    model = fb
  }
  if (gate === 'approval') return { error: { code: 'approval', est: est.cost } } satisfies AgentError

  const key = getKeys()[model.provider] ?? ''
  if (!key && isCloud(model)) return { error: { code: 'no_key', message: model.provider } } satisfies AgentError

  try {
    const r = await runChat(model, key, AGENT_SYSTEM, user)
    const cost = r.costUsd ?? costOf(model, r.inTokens, r.outTokens)
    record({ kind: 'llm', name: model.name, provider: model.provider, inTokens: r.inTokens, outTokens: r.outTokens, cost, free: !isPaid(model) })
    broadcast()
    return { text: r.text, inTokens: r.inTokens, outTokens: r.outTokens, cost, modelName: model.name, notice }
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError('unknown', String(e))
    console.error('[agent]', model.id, err.code, err.message)
    return { error: { code: err.code } } satisfies AgentError
  }
}

async function refreshOllama() {
  ollama = (await listOllama()).map(ollamaModel)
  broadcast()
}

// ---------- IPC ----------

function state() {
  const keys = getKeys()
  return {
    settings,
    history,
    usage,
    models: models(),
    keys: Object.fromEntries(Object.keys(keys).map((p) => [p, true])),
    canPaste: !!hook,
    hotkeyOk,
    platform: process.platform,
  }
}

function ipc() {
  ipcMain.handle('state:get', state)
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const before = settings
    settings = { ...settings, ...patch }
    saveSettings()
    if (patch.hotkey && patch.hotkey !== before.hotkey) registerHotkey()
    if (patch.theme) mainWin.setTitleBarOverlay?.(overlay())
    if (patch.retentionDays !== undefined) {
      pruneHistory()
      saveHistory()
    }
    broadcast()
  })
  ipcMain.handle('keys:set', (_e, a: { provider: string; key?: string }) => {
    setKey(a.provider, a.key?.trim())
    broadcast()
  })
  ipcMain.handle('history:delete', (_e, id: string) => {
    history = history.filter((h) => h.id !== id)
    saveHistory()
    broadcast()
  })
  ipcMain.handle('data:deleteAll', () => {
    history = []
    usage = []
    saveHistory()
    saveUsage()
    broadcast()
  })
  ipcMain.handle('dictation:toggle', () => (phase === 'idle' ? startDictation() : stopDictation()))
  ipcMain.handle('agent:run', (_e, a) => runAgent(a))
  ipcMain.handle('output:insert', async (_e, text: string) => insertText(text))
  ipcMain.handle('output:copy', (_e, text: string) => clipboard.writeText(text))
  ipcMain.handle('models:refresh', async () => {
    await refreshOllama()
    try {
      const prices = await fetchOpenRouterPrices()
      for (const m of catalog) {
        if (m.provider !== 'openrouter') continue
        const p = prices.get(m.model)
        m.unavailable = !p
        if (p) [m.inPerM, m.outPerM] = p
      }
      broadcast()
      return { ok: true }
    } catch (e) {
      return { ok: false, code: e instanceof ProviderError ? e.code : 'offline' }
    }
  })
  ipcMain.handle('stt:preload', () => pill.webContents.send('pill:preload', settings.language))
  ipcMain.handle('stt:cloud', async (_e, a: { audio: ArrayBuffer; seconds: number }) => {
    if (engine === 'local') return { error: 'unknown' }
    try {
      const text = await transcribeCloud(engine, getKeys()[engine] ?? '', new Blob([a.audio], { type: 'audio/webm' }), settings.language)
      const s = CLOUD_STT[engine]
      record({ kind: 'stt', name: s.name, provider: engine, inTokens: 0, outTokens: 0, cost: (a.seconds / 60) * s.perMin, free: false })
      return { text }
    } catch (e) {
      console.error('[stt]', engine, e instanceof ProviderError ? e.code : e)
      return { error: e instanceof ProviderError ? e.code : 'unknown' }
    }
  })

  // From the recording pill
  ipcMain.on('pill:result', (_e, a: { text: string; seconds: number }) => void onTranscript(a.text, a.seconds))
  ipcMain.on('pill:fail', () => {
    phase = 'idle'
    globalShortcut.unregister('Escape')
    mainWin.webContents.send('dictation', 'error')
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      pill.hide()
      mainWin.webContents.send('dictation', 'idle')
    }, 5000)
  })
  ipcMain.on('pill:retry', () => {
    phase = 'idle'
    startDictation()
  })
  ipcMain.on('pill:stopClick', stopDictation)
  ipcMain.on('pill:cancelClick', cancelDictation)
  ipcMain.on('pill:status', (_e, text: string) => mainWin.webContents.send('stt:status', text))
  ipcMain.on('pill:icon', (_e, dataUrl: string) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    mainWin.setIcon(img)
    if (tray) return
    tray = new Tray(img.resize({ width: 16, height: 16 }))
    tray.setToolTip('Yowly')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Yowly', click: showMain },
        { label: 'Start / stop dictation', click: () => (phase === 'idle' ? startDictation() : stopDictation()) },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ]),
    )
    tray.on('click', showMain)
  })
}

// ---------- boot ----------

// Smoke-check runs use a throwaway profile so they never touch real data.
if (process.env.YOWLY_SHOT) app.setPath('userData', join(process.env.YOWLY_SHOT, 'profile'))
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', showMain)
app.on('before-quit', () => (quitting = true))
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  hook?.uIOhook.stop()
})

app.whenReady().then(async () => {
  settings = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>('settings.json', {}) }
  history = read<HistoryItem[]>('history.json', [])
  usage = read<UsageEntry[]>('usage.json', [])
  pruneHistory()

  // Only the microphone is ever granted to the renderer.
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'))

  try {
    hook = await import('uiohook-napi')
    hook.uIOhook.on('keyup', () => {
      if (settings.mode === 'ptt' && phase === 'recording') stopDictation()
    })
    hook.uIOhook.start()
  } catch (e) {
    console.error('[hook] native keyboard module unavailable; using clipboard fallback', e)
  }

  ipc()
  createWindows()
  registerHotkey()
  void refreshOllama()
  if (process.env.YOWLY_SHOT) void devShots(mainWin, pill, process.env.YOWLY_SHOT)
})
