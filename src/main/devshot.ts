import { ipcMain, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Smoke check: `YOWLY_SHOT=<dir> npm run dev` saves a PNG of every screen and exits. */
export async function devShots(main: BrowserWindow, pill: BrowserWindow, dir: string) {
  mkdirSync(dir, { recursive: true })
  await wait(3500)
  const snap = async (win: BrowserWindow, name: string) =>
    writeFileSync(join(dir, `${name}.png`), (await win.webContents.capturePage()).toPNG())
  await snap(main, 'welcome')
  await main.webContents.executeJavaScript(`document.querySelector('.welcome .btn')?.click()`)
  if (process.env.YOWLY_SHOT_TEXT) {
    // Fill the editor so the Dictate shot shows real content.
    await wait(300)
    await main.webContents.executeJavaScript(`{
      const t = document.querySelector('textarea.editor')
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, ${JSON.stringify(process.env.YOWLY_SHOT_TEXT)})
      t.dispatchEvent(new Event('input', { bubbles: true }))
    }`)
  }
  for (const route of ['dictate', 'history', 'models', 'usage', 'settings']) {
    await main.webContents.executeJavaScript(`location.hash = '#/${route}'`)
    await wait(500)
    await snap(main, route)
  }
  for (const state of ['listening', 'transcribing', 'success', 'error']) {
    pill.showInactive()
    pill.webContents.send('pill:show', { state, message: state })
    await wait(400)
    await snap(pill, `pill-${state}`)
  }
  console.log('[shots] saved to', dir)
  if (process.env.YOWLY_SHOT_STT) {
    // Also prove the local speech model loads (downloads it on first run).
    pill.webContents.on('console-message', (e) => console.log('[pill]', e.message))
    ipcMain.on('pill:status', (_e, text: string) => {
      console.log('[stt]', text)
      if (/ready|Could not/.test(text)) process.exit(0)
    })
    pill.webContents.send('pill:preload', 'en')
    await wait(240000)
  }
  process.exit(0)
}
