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

export type RecordState = 'idle' | 'listening'

const RECORD_BUTTON = 'flex items-center gap-2.5 rounded-full border pl-4 pr-2.5 py-2 text-[13px] cursor-pointer transition-colors'
const RECORD_KEY = 'font-mono text-[11px] border rounded-[5px] px-[7px] py-0.5'

const RECORD_STATES: Record<RecordState, { button: string, dot: string, label: string, key: string }> = {
  idle: {
    button: 'bg-[#1f1f23] border-vf-stroke text-vf-ink hover:bg-vf-edge',
    dot: 'rounded-full', label: 'Grabar',
    key: 'text-vf-dim bg-vf-rail border-vf-chip',
  },
  listening: {
    button: 'bg-[#2a1a1b] border-[#5a2c2e] text-[#f4d6d6]',
    dot: 'rounded-sm animate-pulse', label: 'Detener',
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
  button.className = `${RECORD_BUTTON} ${buttonClass}`
  button.innerHTML = `
    <span class="w-2 h-2 bg-vf-red ${dot}"></span>${label}${time}
    <span class="${RECORD_KEY} ${key}">Espacio</span>`
}

// Space toggles recording unless the user is typing in a form control
export function isTypingTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
