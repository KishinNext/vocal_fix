import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { CatalogModel } from './modelCatalog'

export interface DownloadProgress {
  file: string
  received: number
  total: number
}

const PROGRESS_INTERVAL_MS = 250

export interface DownloadOptions {
  fetch: typeof fetch
  maxAttempts: number
  retryDelayMs: number    // multiplied by the attempt number
  stallTimeoutMs: number  // a connection that sends nothing for this long is dropped
}

const DEFAULT_OPTIONS: DownloadOptions = {
  fetch: (...args) => fetch(...args),
  maxAttempts: 4,
  retryDelayMs: 2000,
  stallTimeoutMs: 30_000,
}

// A failure that trying again cannot fix (e.g. the file does not exist)
class PermanentError extends Error {}

const activeDownloads = new Map<string, Promise<void>>()
const progressByFile = new Map<string, DownloadProgress>()

export function getDownloadProgress(file: string): DownloadProgress | undefined {
  return progressByFile.get(file)
}

// Downloads to "<file>.part" and renames on success, so a partial file never looks installed.
// Concurrent calls for the same file share one download.
export function downloadModel(
  model: CatalogModel,
  modelsDir: string,
  onProgress: (progress: DownloadProgress) => void,
  options: Partial<DownloadOptions> = {},
): Promise<void> {
  const existing = activeDownloads.get(model.file)
  if (existing) return existing

  const task = runDownload(model, modelsDir, onProgress, { ...DEFAULT_OPTIONS, ...options }).finally(() => {
    activeDownloads.delete(model.file)
    progressByFile.delete(model.file)
  })
  activeDownloads.set(model.file, task)
  return task
}

// A dropped or stalled connection is retried, continuing from the bytes already on disk
async function runDownload(
  model: CatalogModel,
  modelsDir: string,
  onProgress: (progress: DownloadProgress) => void,
  options: DownloadOptions,
): Promise<void> {
  fs.mkdirSync(modelsDir, { recursive: true })
  const destPath = path.join(modelsDir, model.file)
  const partPath = `${destPath}.part`
  fs.rmSync(partPath, { force: true }) // leftovers of another session may be for a different file version

  const progress: DownloadProgress = { file: model.file, received: 0, total: model.sizeBytes }
  progressByFile.set(model.file, progress)
  onProgress(progress)

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await fetchInto(model, partPath, progress, onProgress, options)
        break
      } catch (e) {
        if (e instanceof PermanentError || attempt >= options.maxAttempts) throw e
        console.warn(`Download of ${model.file} failed (attempt ${attempt}), retrying:`, e instanceof Error ? e.message : e)
        await new Promise(resolve => setTimeout(resolve, options.retryDelayMs * attempt))
      }
    }
    fs.renameSync(partPath, destPath)
    onProgress({ ...progress, received: progress.total })
  } catch (e) {
    fs.rmSync(partPath, { force: true })
    throw e
  }
}

async function fetchInto(
  model: CatalogModel,
  partPath: string,
  progress: DownloadProgress,
  onProgress: (progress: DownloadProgress) => void,
  options: DownloadOptions,
): Promise<void> {
  const offset = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0
  const controller = new AbortController()
  let stallTimer: ReturnType<typeof setTimeout> | undefined
  const watchStall = () => {
    clearTimeout(stallTimer)
    stallTimer = setTimeout(() => controller.abort(new Error('La descarga dejó de recibir datos')), options.stallTimeoutMs)
  }

  watchStall()
  try {
    const response = await options.fetch(model.url, {
      headers: offset > 0 ? { Range: `bytes=${offset}-` } : {},
      signal: controller.signal,
    })
    if (!response.ok || !response.body) {
      const message = `Descarga fallida (${response.status} ${response.statusText})`
      // Client errors will not go away, except "too many requests" and timeouts
      const permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)
      throw permanent ? new PermanentError(message) : new Error(message)
    }

    // 206 continues the partial file; a server that ignores Range sends it whole again
    const resumed = offset > 0 && response.status === 206
    const length = Number(response.headers.get('content-length'))
    progress.received = resumed ? offset : 0
    progress.total = length ? progress.received + length : model.sizeBytes

    let lastEmit = 0
    const body = Readable.fromWeb(response.body as any, { signal: controller.signal })
    body.on('data', (chunk: Buffer) => {
      progress.received += chunk.length
      watchStall()
      const now = Date.now()
      if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
        lastEmit = now
        onProgress(progress)
      }
    })
    await pipeline(body, fs.createWriteStream(partPath, { flags: resumed ? 'a' : 'w' }))
  } catch (e) {
    // An abort surfaces as a generic AbortError: report why it was aborted
    throw controller.signal.aborted ? controller.signal.reason : e
  } finally {
    clearTimeout(stallTimer)
  }
}
