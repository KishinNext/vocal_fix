import { app } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { createRequire } from 'module'
import { findCatalogModel } from './modelCatalog'
import { getModelsDir, getSettings } from './settingsStore'
import { setEngineState, trackLoad } from './engineStatus'
import { cleanTranscript } from './transcript'
import { encodeWav } from './wav'
import { forgetServer, killOrphanedServer, rememberServer } from './whisperOrphan'

const IS_WINDOWS = process.platform === 'win32'
const BINARY_NAME = IS_WINDOWS ? 'server.exe' : 'server'

// whisper-node is only a vendor of whisper.cpp sources (`npm run whisper:build` compiles
// its HTTP server). Its JS wrapper is not used: it dropped the first transcribed segment.
// The server keeps the model loaded, so live partial transcriptions take well under a second.

// A packaged app ships the binary in its resources (see "build" in package.json); in
// development it is wherever scripts/build-whisper.mjs left it.
function serverBinary(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'whisper', BINARY_NAME)
  const whisperDir = path.join(path.dirname(createRequire(import.meta.url).resolve('whisper-node')), '../lib/whisper.cpp')
  return IS_WINDOWS ? path.join(whisperDir, 'build/bin/Release', BINARY_NAME) : path.join(whisperDir, BINARY_NAME)
}

// Runs the server ("$0" "$@") and kills it once our stdin pipe closes, which happens
// however this process ends (quit, crash, dev reload); otherwise the server, holding the
// model in memory, would outlive the app. sh exits when the server does. The pipe is
// passed on fd 3 because sh gives background jobs /dev/null as stdin.
// Windows has no sh: the server is spawned directly and whisperOrphan.ts cleans up.
const EXIT_WITH_PARENT =
  'exec 3<&0; "$0" "$@" </dev/null & pid=$!; (read _ <&3; kill $pid 2>/dev/null) & wait $pid'

const READY_TIMEOUT_MS = 60_000
const READY_POLL_MS = 200
const STDERR_TAIL_CHARS = 2000

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo
      probe.close(() => resolve(port))
    })
  })
}

// English-only models (*.en) must not get a language other than English
function whisperLanguage(modelFile: string, language: string): string {
  const englishOnly = findCatalogModel(modelFile)?.englishOnly ?? /\.en\./.test(modelFile)
  return englishOnly ? 'en' : language
}

function launch(binary: string, args: string[], cwd: string): ChildProcess {
  if (IS_WINDOWS) {
    killOrphanedServer(cwd)
    const child = spawn(binary, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    if (child.pid) rememberServer(cwd, child.pid)
    child.on('exit', () => forgetServer(cwd))
    return child
  }
  return spawn('/bin/sh', ['-c', EXIT_WITH_PARENT, binary, ...args], { cwd, stdio: ['pipe', 'ignore', 'pipe'] })
}

class WhisperServer {
  private process: ChildProcess | null = null
  private url = ''
  private config = ''  // model + language the running server was started with
  private starting: Promise<void> | null = null
  private stderrTail = ''

  // Starts the server for the model/language in settings, restarting it if they changed.
  async ensure(): Promise<string> {
    while (this.starting) await this.starting

    const { whisperModel, language } = getSettings()
    const modelPath = path.join(getModelsDir(), whisperModel)
    const lang = whisperLanguage(whisperModel, language)
    const config = `${modelPath}|${lang}`
    if (this.process && config === this.config) return this.url

    this.starting = trackLoad('whisper', modelPath, () => this.start(modelPath, lang, config))
      .finally(() => { this.starting = null })
    await this.starting
    return this.url
  }

  private async start(modelPath: string, lang: string, config: string) {
    this.stop()
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Modelo Whisper no descargado: ${path.basename(modelPath)}`)
    }
    const binary = serverBinary()
    if (!fs.existsSync(binary)) {
      throw new Error('whisper.cpp no está compilado. Ejecuta `npm run whisper:build`')
    }

    // The server writes a scratch WAV into its working directory
    const cwd = path.join(app.getPath('temp'), 'vocalfix-whisper')
    fs.mkdirSync(cwd, { recursive: true })

    const port = await freePort()
    const args = ['-m', modelPath, '-l', lang, '-nt', '--host', '127.0.0.1', '--port', String(port)]
    const child = launch(binary, args, cwd)

    this.stderrTail = ''
    child.stderr?.on('data', chunk => {
      this.stderrTail = (this.stderrTail + chunk).slice(-STDERR_TAIL_CHARS)
    })
    child.on('exit', () => {
      if (this.process !== child) return
      // Not stopped by us: it crashed (stop() clears this.process first)
      this.process = null
      setEngineState('whisper', 'error', 'El servidor de Whisper se detuvo')
    })

    this.process = child
    this.url = `http://127.0.0.1:${port}`
    this.config = config
    await this.waitUntilReady(child)
    console.log(`Whisper server ready (${path.basename(modelPath)}, -l ${lang})`)
  }

  private async waitUntilReady(child: ChildProcess) {
    const deadline = Date.now() + READY_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (this.process !== child) {
        throw new Error(`El servidor de Whisper se detuvo al iniciar: ${this.stderrTail.trim().split('\n').pop() ?? ''}`)
      }
      try {
        if ((await fetch(this.url)).ok) return
      } catch {
        // not listening yet
      }
      await new Promise(resolve => setTimeout(resolve, READY_POLL_MS))
    }
    this.stop()
    throw new Error('El servidor de Whisper no respondió a tiempo')
  }

  // `prompt` gives whisper the previous sentence as context (spelling, names, casing)
  async transcribe(pcm: Int16Array, prompt = ''): Promise<string> {
    const url = await this.ensure()
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(encodeWav(pcm))], { type: 'audio/wav' }), 'audio.wav')
    form.append('response-format', 'json')
    // Always sent: the server keeps request parameters between requests
    form.append('prompt', prompt)

    const response = await fetch(`${url}/inference`, { method: 'POST', body: form })
    const body = await response.json() as { text?: string, error?: string }
    if (body.error) throw new Error(`Whisper: ${body.error}`)
    return cleanTranscript(body.text ?? '')
  }

  stop() {
    if (IS_WINDOWS) this.process?.kill()
    else this.process?.stdin?.end() // the wrapper kills the server on EOF
    this.process = null
    this.config = ''
  }
}

export const whisperServer = new WhisperServer()
