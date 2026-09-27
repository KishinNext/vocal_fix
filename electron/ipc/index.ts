import { registerAudioHandlers } from './audio'
import { registerModelHandlers } from './models'
import { registerSettingsHandlers } from './settings'

export { registerRecordShortcut } from './settings'

export function registerIpcHandlers() {
  registerModelHandlers()
  registerSettingsHandlers()
  registerAudioHandlers()
}
