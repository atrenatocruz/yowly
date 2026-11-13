import type { HistoryItem, Model, Settings, UsageEntry } from '../../core/types'

export interface AppState {
  settings: Settings
  history: HistoryItem[]
  usage: UsageEntry[]
  models: Model[]
  keys: Record<string, boolean>
  canPaste: boolean
  hotkeyOk: boolean
  platform: string
}

declare global {
  interface Window {
    yowly: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (channel: string, arg?: unknown) => Promise<any>
      send: (channel: string, arg?: unknown) => void
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on: (channel: string, cb: (arg: any) => void) => () => void
    }
  }
}

export const api = window.yowly
export type MascotState = 'idle' | 'listening' | 'thinking' | 'transcribing' | 'success' | 'error'
