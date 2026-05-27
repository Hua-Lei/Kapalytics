import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { aiDiagnose } from './llm/generate'
import { callLlm, setApiKey, clearApiKey, hasApiKey, getAvailableProviders, setProvider } from './llm/client'
import { deepseekProvider } from './llm/providers/deepseek'

function getStoragePath(): string {
  const dir = join(app.getPath('userData'), 'saves')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'learning-state.json')
}

const isDev = !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    },
    title: 'Kapalytics - AI Paper Learning Assistant'
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('select-pdf', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择论文 PDF',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return pathToFileURL(filePath).toString()
  })

  // LLM handlers
  ipcMain.handle('llm:set-api-key', (_e, key: string) => {
    setApiKey(key)
  })

  ipcMain.handle('llm:clear-api-key', () => {
    clearApiKey()
  })

  ipcMain.handle('llm:has-api-key', () => {
    return hasApiKey()
  })

  ipcMain.handle('llm:get-providers', () => {
    return getAvailableProviders()
  })

  ipcMain.handle('llm:set-provider', (_e, providerId: string) => {
    if (providerId === 'deepseek') setProvider(deepseekProvider)
  })

  ipcMain.handle('llm:test-connection', async () => {
    try {
      if (!hasApiKey()) return false
      await callLlm({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
        temperature: 0
      })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(
    'llm:diagnose',
    async (
      _e,
      params: { stageId: string; stageName: string; taskDescription: string; userAnswer: string }
    ) => {
      return aiDiagnose(params.stageId, params.stageName, params.taskDescription, params.userAnswer)
    }
  )

  // Storage handlers
  ipcMain.handle('storage:save', (_e, data: unknown) => {
    try {
      writeFileSync(getStoragePath(), JSON.stringify(data, null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('storage:load', () => {
    try {
      const path = getStoragePath()
      if (!existsSync(path)) return null
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return null
    }
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
