import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { aiAnalyzePaper, aiDiagnose } from './llm/generate'
import { callLlm, setApiKey, clearApiKey, hasApiKey, getAvailableProviders, setProvider } from './llm/client'
import { deepseekProvider } from './llm/providers/deepseek'
import { extractPdfContent } from './paper/extractPdfContent'

// Linux GPU fallback — must run before app ready
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu')
  app.disableHardwareAcceleration()
}

function getStoragePath(): string {
  const dir = join(app.getPath('userData'), 'saves')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'learning-state.json')
}

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: false,
      plugins: false
    },
    title: 'Kapalytics - AI Paper Learning Assistant'
  })

  // Dev diagnostics: log renderer crashes and console errors
  if (isDev) {
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[Main] Renderer crashed:', details.reason, 'exit:', details.exitCode)
    })
    mainWindow.webContents.on('unresponsive', () => {
      console.warn('[Main] Renderer unresponsive')
    })
    mainWindow.webContents.on('console-message', (_e, _level, message) => {
      if (message.startsWith('[ErrorBoundary]') || message.includes('Error:')) {
        console.error('[Renderer]', message)
      }
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = details.url
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('select-pdf', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择论文 PDF',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return { fileUrl: pathToFileURL(filePath).toString(), filePath }
  })

  ipcMain.handle('pdf:read-file', async (_e, fileUrl: string) => {
    try {
      const buf = readFileSync(fileURLToPath(fileUrl))
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    } catch (err) {
      console.error('[PDF read]', err)
      return null
    }
  })

  // PDF text extraction — returns structured ExtractedPaperContent
  ipcMain.handle('pdf:extract-text', async (_e, fileUrl: string) => {
    try {
      return await extractPdfContent(fileUrl)
    } catch (err) {
      console.error('[PDF extract]', err)
      return null
    }
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

  ipcMain.handle('llm:analyze-paper', async (_e, paperText: string) => {
    const send = (msg: string) => mainWindow.webContents.send('llm:progress', msg)
    return aiAnalyzePaper(paperText, send)
  })

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
  const mainWindow = createWindow()
  registerIpcHandlers(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
