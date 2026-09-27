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
): Promise<void> {
  const existing = activeDownloads.get(model.file)
  if (existing) return existing

  const task = runDownload(model, modelsDir, onProgress).finally(() => {
    activeDownloads.delete(model.file)
    progressByFile.delete(model.file)
  })
  activeDownloads.set(model.file, task)
  return task
}

async function runDownload(
  model: CatalogModel,
  modelsDir: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  fs.mkdirSync(modelsDir, { recursive: true })
  const destPath = path.join(modelsDir, model.file)
  const partPath = `${destPath}.part`

  const progress: DownloadProgress = { file: model.file, received: 0, total: model.sizeBytes }
  progressByFile.set(model.file, progress)
  onProgress(progress)

  try {
    const response = await fetch(model.url)
    if (!response.ok || !response.body) {
      throw new Error(`Descarga fallida (${response.status} ${response.statusText})`)
    }
    progress.total = Number(response.headers.get('content-length')) || model.sizeBytes

    let lastEmit = 0
    const body = Readable.fromWeb(response.body as any)
    body.on('data', (chunk: Buffer) => {
      progress.received += chunk.length
      const now = Date.now()
      if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
        lastEmit = now
        onProgress(progress)
      }
    })

    await pipeline(body, fs.createWriteStream(partPath))
    fs.renameSync(partPath, destPath)
    onProgress({ ...progress, received: progress.total })
  } catch (e) {
    fs.rmSync(partPath, { force: true })
    throw e
  }
}
