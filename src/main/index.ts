import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { aiAnalyzePaper, aiDiagnose } from './llm/generate'
import { callLlm, setApiKey, clearApiKey, hasApiKey, getAvailableProviders, setProvider } from './llm/client'
import { deepseekProvider } from './llm/providers/deepseek'

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

function extractFormulaCandidates(pageText: string): string[] {
  const candidates = new Set<string>()
  const formulaPatterns = [
    /[^.。;；]{0,80}(?:argmin|softmax|LoRA|∆W|ΔW|W\s*[′']|L\s*SFT|h\s*=|[A-Z]\s*[∈=]|θ|ϕ|Ω|Ψ|\b[A-Z]\^?[TB]?\b\s*[=+−-])[^.。;；]{0,120}/g,
    /[^.。;；]{0,80}(?:\([0-9]+\)|[A-Za-z]\s*\([^)]{1,80}\)\s*=|\|[^|]{1,80}\|)[^.。;；]{0,120}/g
  ]

  for (const pattern of formulaPatterns) {
    for (const match of pageText.matchAll(pattern)) {
      const value = match[0].replace(/\s+/g, ' ').trim()
      const symbolCount = (value.match(/[=+−\-×*/^_∈∆ΔθϕΩΨ|]/g) ?? []).length
      if (value.length >= 20 && symbolCount >= 2) candidates.add(value.slice(0, 220))
    }
  }

  return [...candidates].slice(0, 4)
}

function extractFormulaLineCandidates(
  items: Array<{ str?: string; transform?: number[] }>,
  pageNumber: number
): string[] {
  const rows = new Map<number, { x: number; text: string }[]>()

  for (const item of items) {
    if (!item.str?.trim() || !Array.isArray(item.transform)) continue
    const x = item.transform[4] ?? 0
    const y = Math.round(item.transform[5] ?? 0)
    const row = rows.get(y) ?? []
    row.push({ x, text: item.str })
    rows.set(y, row)
  }

  const candidates: string[] = []
  for (const [y, row] of rows) {
    const line = row
      .sort((a, b) => a.x - b.x)
      .map((part) => part.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const symbolCount = (line.match(/[=+−×*/^_∈∆ΔθϕΩΨΣ∑√|<>≤≥]/g) ?? []).length
    const hasMathSymbol = /[=+−×*/^_∈∆ΔθϕΩΨΣ∑√|<>≤≥]/.test(line)
    const mathWordCount = (line.match(/\b(?:argmin|softmax|loss|rank|LoRA|SFT|head|emb|MLP|T2L)\b/gi) ?? []).length
    if (line.length >= 12 && hasMathSymbol && (symbolCount >= 2 || mathWordCount >= 1)) {
      candidates.push(`Page ${pageNumber}, y=${y}: ${line.slice(0, 240)}`)
    }
  }

  return candidates.slice(0, 8)
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
      return readFileSync(fileURLToPath(fileUrl)).buffer
    } catch (err) {
      console.error('[PDF read]', err)
      return null
    }
  })

  // PDF text extraction
  ipcMain.handle('pdf:extract-text', async (_e, fileUrl: string) => {
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const filePath = fileURLToPath(fileUrl)
      const data = new Uint8Array(readFileSync(filePath))
      const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise
      const pages: string[] = []
      const formulaCandidates: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const textItems = content.items as Array<{ str?: string; transform?: number[] }>
        const text = textItems
          .map((item) => item.str ?? '')
          .join(' ')
        pages.push(`[Page ${i}]\n${text}`)
        extractFormulaLineCandidates(textItems, i).forEach((candidate) => {
          formulaCandidates.push(candidate)
        })
        extractFormulaCandidates(text).forEach((candidate) => {
          formulaCandidates.push(`Page ${i}: ${candidate}`)
        })
      }
      const formulas = formulaCandidates.length > 0
        ? `\n\n[Formula candidates extracted from PDF]\n${formulaCandidates.slice(0, 24).join('\n')}`
        : ''
      return `${pages.join('\n\n')}${formulas}`
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
