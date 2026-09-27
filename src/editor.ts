import { modelDisplayName } from '../electron/modelCatalog'

// DOM helpers for the editor window (src/main.ts wires them to events).

const OPTION_CLASS = 'bg-studio-surface text-studio-heading'

function createOption(text: string, value: string, className = ''): HTMLOptionElement {
  const option = document.createElement('option')
  option.text = text
  option.value = value
  option.className = className
  return option
}

export function fillModelSelect(select: HTMLSelectElement, files: string[]) {
  select.innerHTML = ''
  select.disabled = files.length === 0
  if (files.length === 0) {
    select.add(createOption('No model found', ''))
    return
  }
  files.forEach(file => select.add(createOption(modelDisplayName(file), file, OPTION_CLASS)))
}

export function fillMicrophoneSelect(select: HTMLSelectElement, devices: MediaDeviceInfo[]) {
  select.innerHTML = ''
  select.add(createOption('Predeterminado', ''))
  devices.forEach((device, i) => {
    select.add(createOption(device.label || `Micrófono ${i + 1}`, device.deviceId, OPTION_CLASS))
  })
}

export type RecordState = 'idle' | 'listening'

const RECORD_STATES: Record<RecordState, { dot: string, label: string, labelClass: string, keyClass: string }> = {
  idle: {
    dot: 'bg-zinc-500', label: 'En pausa', labelClass: 'text-zinc-400',
    keyClass: 'text-zinc-500 bg-white/[0.04]',
  },
  listening: {
    dot: 'bg-rose-500 animate-pulse', label: 'Escuchando', labelClass: 'text-studio-heading',
    keyClass: 'text-zinc-400 bg-white/[0.06]',
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
