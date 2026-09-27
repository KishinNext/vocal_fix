import { globalShortcut } from 'electron'

let currentAccelerator = ''

function register(accelerator: string, onTrigger: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, onTrigger)
  } catch {
    // Electron throws on malformed accelerators
    return false
  }
}

// Replaces the global record shortcut. On failure the previous one is restored.
// An empty accelerator disables the shortcut.
export function applyRecordShortcut(accelerator: string, onTrigger: () => void): boolean {
  const previous = currentAccelerator
  if (previous) globalShortcut.unregister(previous)
  currentAccelerator = ''

  if (!accelerator) return true

  if (register(accelerator, onTrigger)) {
    currentAccelerator = accelerator
    return true
  }

  if (previous && register(previous, onTrigger)) currentAccelerator = previous
  return false
}
