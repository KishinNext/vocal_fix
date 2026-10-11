import { app, shell } from 'electron'
import { getSettings } from './settingsStore'
import type { UpdateState } from './updateState'
import { isNewerVersion } from './version'

// Looks for a newer release on GitHub and tells the windows about it. Nothing is ever
// downloaded on its own: the user starts it from the notice.
// - Windows: the installer is downloaded and run by electron-updater.
// - macOS: the release page is opened, because updating in place needs an app signed
//   with an Apple Developer ID.

const REPOSITORY = 'KishinNext/vocal_fix'
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const CHECK_TIMEOUT_MS = 8000

const installsInApp = process.platform === 'win32' && app.isPackaged

let state: UpdateState = {
  current: app.getVersion(), latest: null, url: '', phase: 'idle', percent: 0, message: '', installsInApp,
}
const listeners = new Set<(state: UpdateState) => void>()

function setState(patch: Partial<UpdateState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
}

export function getUpdateState(): UpdateState {
  return state
}

export function onUpdateState(listener: (state: UpdateState) => void) {
  listeners.add(listener)
}

// `manual` checks even when the setting is off and reports failures
export async function checkForUpdates(manual = false): Promise<UpdateState> {
  if (!manual && !getSettings().checkUpdates) return state
  if (state.phase === 'checking' || state.phase === 'downloading') return state

  setState({ phase: 'checking', message: '' })
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    // 404: the repository has no release yet
    if (response.status === 404) return finish({ latest: null })
    if (!response.ok) throw new Error(`GitHub respondió ${response.status}`)

    const release = await response.json() as { tag_name?: string, html_url?: string }
    const tag = release.tag_name ?? ''
    return finish(isNewerVersion(tag, state.current)
      ? { latest: tag.replace(/^v/, ''), url: release.html_url ?? '' }
      : { latest: null })
  } catch (e) {
    // Being offline is normal for this app: only a check the user asked for reports it
    return finish(manual ? { phase: 'error', message: e instanceof Error ? e.message : String(e) } : {})
  }
}

function finish(patch: Partial<UpdateState>): UpdateState {
  const latest = 'latest' in patch ? patch.latest : state.latest
  setState({ phase: latest ? 'available' : 'idle', ...patch })
  return state
}

// Started by the user from the update notice
export async function installUpdate(): Promise<void> {
  if (!state.latest || state.phase === 'downloading') return
  if (!installsInApp) {
    await shell.openExternal(state.url)
    return
  }

  setState({ phase: 'downloading', percent: 0, message: '' })
  try {
    const { autoUpdater } = (await import('electron-updater')).default
    autoUpdater.autoDownload = false
    autoUpdater.removeAllListeners('download-progress')
    autoUpdater.on('download-progress', progress => setState({ percent: Math.floor(progress.percent) }))
    await autoUpdater.checkForUpdates()
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
  } catch (e) {
    setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
