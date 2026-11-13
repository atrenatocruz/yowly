import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('yowly', {
  invoke: (channel: string, arg?: unknown) => ipcRenderer.invoke(channel, arg),
  send: (channel: string, arg?: unknown) => ipcRenderer.send(channel, arg),
  on: (channel: string, cb: (arg: unknown) => void) => {
    const f = (_e: IpcRendererEvent, arg: unknown) => cb(arg)
    ipcRenderer.on(channel, f)
    return () => ipcRenderer.removeListener(channel, f)
  },
})
