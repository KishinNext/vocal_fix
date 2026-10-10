// Converts keyboard events to Electron accelerators ("CommandOrControl+Shift+Space") and back to labels.

const MODIFIER_CODES = new Set([
  'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
])

const NAMED_KEYS: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
}

// Electron accepts "Command" only on macOS; the Windows key is "Super"
const IS_MAC = /mac/i.test(navigator.platform)

type KeyLike = Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return NAMED_KEYS[code] ?? null
}

// Returns null while only modifiers are held, or for unsupported/modifier-less combos
// (a global shortcut without a modifier would hijack normal typing system-wide).
export function eventToAccelerator(event: KeyLike, mac = IS_MAC): string | null {
  if (MODIFIER_CODES.has(event.code)) return null
  const key = keyFromCode(event.code)
  if (!key) return null

  const parts: string[] = []
  if (event.metaKey) parts.push(mac ? 'Command' : 'Super')
  if (event.ctrlKey) parts.push('Control')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (parts.length === 0) return null

  return [...parts, key].join('+')
}

const KEY_LABELS: Record<string, string> = {
  Space: 'Espacio', Up: '↑', Down: '↓', Left: '←', Right: '→', Enter: '↵',
}

const MAC_LABELS: Record<string, string> = {
  CommandOrControl: '⌘', Command: '⌘', Cmd: '⌘', Super: '⌘', Control: '⌃', Ctrl: '⌃',
  Alt: '⌥', Option: '⌥', Shift: '⇧',
}

const PC_LABELS: Record<string, string> = {
  CommandOrControl: 'Ctrl', Control: 'Ctrl', Ctrl: 'Ctrl', Command: 'Win', Cmd: 'Win', Super: 'Win',
  Alt: 'Alt', Option: 'Alt', Shift: 'Shift',
}

export function acceleratorToLabels(accelerator: string, mac = IS_MAC): string[] {
  if (!accelerator) return []
  const modifiers = mac ? MAC_LABELS : PC_LABELS
  return accelerator.split('+').map(part => modifiers[part] ?? KEY_LABELS[part] ?? part)
}

// The modifiers a shortcut can use, as shown in the hint under the shortcuts table
export function modifierHint(mac = IS_MAC): string {
  return mac ? '⌘ ⌥ ⌃ ⇧' : 'Ctrl, Alt, Shift o Win'
}
