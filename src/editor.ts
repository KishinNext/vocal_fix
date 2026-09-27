import { modelDisplayName } from '../electron/modelCatalog'

// DOM helpers for the editor window (src/main.ts wires them to events).

export const PLACEHOLDER = 'Esperando voz...'

const OPTION_CLASS = 'bg-studio-surface text-studio-heading'

export function fillModelSelect(select: HTMLSelectElement, files: string[]) {
  select.innerHTML = ''
  select.disabled = files.length === 0
  if (files.length === 0) {
    select.add(new Option('No model found', ''))
    return
  }
  files.forEach(file => {
    const option = new Option(modelDisplayName(file), file)
    option.className = OPTION_CLASS
    select.add(option)
  })
}

export function fillMicrophoneSelect(select: HTMLSelectElement, devices: MediaDeviceInfo[]) {
  select.innerHTML = ''
  select.add(new Option('Predeterminado', ''))
  devices.forEach((device, i) => {
    const option = new Option(device.label || `Micrófono ${i + 1}`, device.deviceId)
    option.className = OPTION_CLASS
    select.add(option)
  })
}

// Appends a line of text, clearing the "waiting" placeholder the first time.
// Uses textContent: transcriptions are user speech, never markup.
export function appendLine(container: HTMLElement, text: string, className: string) {
  if (container.innerText.includes(PLACEHOLDER)) container.innerHTML = ''
  const line = document.createElement('p')
  line.className = className
  line.textContent = text
  container.appendChild(line)
}

export type RecordState = 'idle' | 'listening' | 'processing'

const RECORD_STATES: Record<RecordState, { dot: string, label: string, labelClass: string, keyClass: string }> = {
  idle: {
    dot: 'bg-zinc-500', label: 'En pausa', labelClass: 'text-zinc-400',
    keyClass: 'text-zinc-500 bg-white/[0.04]',
  },
  listening: {
    dot: 'bg-rose-500 animate-pulse', label: 'Escuchando', labelClass: 'text-studio-heading',
    keyClass: 'text-zinc-400 bg-white/[0.06]',
  },
  processing: {
    dot: 'bg-zinc-500', label: 'Procesando AI...', labelClass: 'text-zinc-400',
    keyClass: 'text-zinc-500 bg-white/[0.04]',
  },
}

export function renderRecordButton(button: HTMLElement, state: RecordState) {
  const { dot, label, labelClass, keyClass } = RECORD_STATES[state]
  button.dataset.state = state
  button.innerHTML = `
    <span class="w-2 h-2 rounded-full ${dot}"></span>
    <span class="text-xs ${labelClass} font-medium tracking-wide">${label}</span>
    <span class="text-[10px] font-mono ${keyClass} px-1.5 py-0.5 rounded border border-studio-border">Espacio</span>`
}

// Space toggles recording unless the user is typing in a form control
export function isTypingTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
