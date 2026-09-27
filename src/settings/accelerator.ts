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

type KeyLike = Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return NAMED_KEYS[code] ?? null
}

// Returns null while only modifiers are held, or for unsupported/modifier-less combos
// (a global shortcut without a modifier would hijack normal typing system-wide).
export function eventToAccelerator(event: KeyLike): string | null {
  if (MODIFIER_CODES.has(event.code)) return null
  const key = keyFromCode(event.code)
  if (!key) return null

  const parts: string[] = []
  if (event.metaKey) parts.push('Command')
  if (event.ctrlKey) parts.push('Control')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (parts.length === 0) return null

  return [...parts, key].join('+')
}

const LABELS: Record<string, string> = {
  CommandOrControl: '⌘', Command: '⌘', Cmd: '⌘', Control: '⌃', Ctrl: '⌃',
  Alt: '⌥', Option: '⌥', Shift: '⇧', Space: 'Espacio',
  Up: '↑', Down: '↓', Left: '←', Right: '→', Enter: '↵',
}

export function acceleratorToLabels(accelerator: string): string[] {
  if (!accelerator) return []
  return accelerator.split('+').map(part => LABELS[part] ?? part)
}
