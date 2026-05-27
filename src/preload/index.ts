import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  selectPdf: (): Promise<string | null> => ipcRenderer.invoke('select-pdf')
})
