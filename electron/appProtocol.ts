import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { resolveAppFile } from './appFiles'

// The packaged renderer is served from app://vocalfix/ instead of file://, so the
// absolute paths the pages use (/pages/settings.html, /assets/..., /audio-processor.js)
// resolve inside the build folder, as they do on the dev server.
const SCHEME = 'app'

export const APP_URL = `${SCHEME}://vocalfix/index.html`

// Must run before the app is ready. "secure" is what lets the page open the microphone.
export function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ])
}

export function serveApp(root: string) {
  protocol.handle(SCHEME, request => {
    const file = resolveAppFile(root, request.url)
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response('Not found', { status: 404 })
  })
}
