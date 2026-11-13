import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Plain JSON in the per-user app data folder. Small data, so no database yet.
const file = (name: string) => join(app.getPath('userData'), name)

export function read<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file(name), 'utf8')) as T
  } catch {
    return fallback
  }
}

export const write = (name: string, value: unknown) => writeFileSync(file(name), JSON.stringify(value))

// API keys are encrypted with a key held by the OS (Windows DPAPI / macOS
// Keychain) via Electron safeStorage. Only ciphertext touches disk, and
// decrypted keys never leave the main process.
type Enc = Record<string, string>

export function getKeys(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [provider, b64] of Object.entries(read<Enc>('keys.json', {}))) {
    try {
      out[provider] = safeStorage.decryptString(Buffer.from(b64, 'base64'))
    } catch {
      // Unreadable on this machine/user: treat as missing.
    }
  }
  return out
}

export function setKey(provider: string, key?: string) {
  const enc = read<Enc>('keys.json', {})
  if (key) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS keychain unavailable')
    enc[provider] = safeStorage.encryptString(key).toString('base64')
  } else delete enc[provider]
  write('keys.json', enc)
}
