import type { EngineInfo, EngineState, EngineStatus } from '../electron/engineStatus'

// DOM helpers for the editor window (src/main.ts wires them to events).

function createOption(text: string, value: string): HTMLOptionElement {
  const option = document.createElement('option')
  option.text = text
  option.value = value
  return option
}

export function fillMicrophoneSelect(select: HTMLSelectElement, devices: MediaDeviceInfo[]) {
  select.innerHTML = ''
  select.add(createOption('Predeterminado', ''))
  devices.forEach((device, i) => {
    select.add(createOption(device.label || `Micrófono ${i + 1}`, device.deviceId))
  })
}

export type RecordState = 'idle' | 'listening' | 'loading' | 'unavailable'

const RECORD_BUTTON = 'flex items-center gap-2.5 rounded-full border pl-4 pr-2.5 py-2 text-[13px] cursor-pointer transition-colors'
const RECORD_KEY = 'font-mono text-[11px] border rounded-[5px] px-[7px] py-0.5'

const RECORD_STATES: Record<RecordState, { button: string, dot: string, label: string, key: string }> = {
  idle: {
    button: 'bg-[#1f1f23] border-vf-stroke text-vf-ink hover:bg-vf-edge',
    dot: 'rounded-full bg-vf-red', label: 'Grabar',
    key: 'text-vf-dim bg-vf-rail border-vf-chip',
  },
  // Recording waits until both models are ready
  loading: {
    button: 'bg-[#1f1f23] border-vf-rim text-vf-faint cursor-default',
    dot: 'rounded-full bg-vf-amber animate-pulse', label: 'Cargando modelos…',
    key: 'hidden',
  },
  // A model is missing or failed: the header pill says which and opens Settings
  unavailable: {
    button: 'bg-[#1f1f23] border-vf-rim text-vf-faint cursor-default',
    dot: 'rounded-full bg-vf-red', label: 'Modelo no disponible',
    key: 'hidden',
  },
  listening: {
    button: 'bg-[#2a1a1b] border-[#5a2c2e] text-[#f4d6d6]',
    dot: 'rounded-sm bg-vf-red animate-pulse', label: 'Detener',
    key: 'text-[#c98a8a] bg-[#1f1415] border-[#4a2829]',
  },
}

// "01:05" for 65 seconds of recording
export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`
}

// While listening the button shows the recording time in [data-rec-time]
export function renderRecordButton(button: HTMLElement, state: RecordState) {
  const { button: buttonClass, dot, label, key } = RECORD_STATES[state]
  const time = state === 'listening'
    ? `<span data-rec-time class="font-mono text-xs text-[#ef9a9a]">${formatElapsed(0)}</span>`
    : ''
  button.dataset.state = state
  ;(button as HTMLButtonElement).disabled = state === 'loading' || state === 'unavailable'
  button.className = `${RECORD_BUTTON} ${buttonClass}`
  button.innerHTML = `
    <span class="w-2 h-2 ${dot}"></span>${label}${time}
    <span class="${RECORD_KEY} ${key}">Espacio</span>`
}

// Space toggles recording unless the user is typing in a form control
export function isTypingTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

// What the record button shows while not recording: both models must be ready
export function restingRecordState(status: EngineStatus): RecordState {
  const states = [status.whisper.state, status.llm.state]
  if (states.some(state => state === 'missing' || state === 'error')) return 'unavailable'
  return states.every(state => state === 'ready') ? 'idle' : 'loading'
}

const ENGINE_DOT = 'w-1.5 h-1.5 rounded-full shrink-0'

const ENGINE_STATES: Record<EngineState, { dot: string, label: string }> = {
  loading: { dot: 'bg-vf-amber animate-pulse', label: 'cargando…' },
  ready: { dot: 'bg-vf-green', label: 'listo' },
  missing: { dot: 'bg-vf-red', label: 'sin descargar' },
  error: { dot: 'bg-vf-red', label: 'error' },
}

// The dot next to a model's name in the header; returns the text for its tooltip
export function renderEngineDot(dot: HTMLElement, name: string, info: EngineInfo): string {
  const { dot: dotClass, label } = ENGINE_STATES[info.state]
  dot.className = `${ENGINE_DOT} ${dotClass}`
  dot.dataset.state = info.state
  return `${name}: ${label}${info.message ? ` (${info.message})` : ''}`
}

const LEVEL_BARS = 18
const LEVEL_BAR = 'w-[3px] rounded-sm transition-[height] duration-75'
const LEVEL_MIN_PX = 3
const LEVEL_MAX_PX = 20

// Speech has an RMS of roughly 0.02-0.2: the square root spreads that over the meter
export function levelFromRms(rms: number): number {
  return Math.min(1, Math.sqrt(Math.max(0, rms)) * 2.2)
}

// A short rolling history of the microphone level, newest on the right
export function createLevelMeter(container: HTMLElement) {
  const levels = new Array<number>(LEVEL_BARS).fill(0)
  const bars = levels.map(() => document.createElement('span'))
  container.replaceChildren(...bars)

  const render = (live: boolean) => bars.forEach((bar, i) => {
    bar.className = `${LEVEL_BAR} ${live && levels[i] > 0.08 ? 'bg-vf-ink' : 'bg-[#3a3a40]'}`
    bar.style.height = `${Math.round(LEVEL_MIN_PX + levels[i] * (LEVEL_MAX_PX - LEVEL_MIN_PX))}px`
  })
  render(false)

  return {
    push(rms: number) {
      levels.shift()
      levels.push(levelFromRms(rms))
      render(true)
    },
    reset() {
      levels.fill(0)
      render(false)
    },
  }
}
