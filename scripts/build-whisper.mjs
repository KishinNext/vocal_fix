// Builds the whisper.cpp HTTP server used for transcription (electron/whisperServer.ts).
// macOS: `make server` -> <whisper.cpp>/server
// Windows: CMake + MSVC -> <whisper.cpp>/build/bin/Release/server.exe
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const whisperDir = fileURLToPath(new URL('../node_modules/whisper-node/lib/whisper.cpp', import.meta.url))

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: whisperDir, stdio: 'inherit', env: { ...process.env, ...env } })
  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Prefer Xcode's own SDK: a newer Command Line Tools SDK can use architectures
// Xcode's linker doesn't know yet ("unknown architecture arm64e.x1").
function xcodeSdk() {
  const developerDir = spawnSync('xcode-select', ['-p'], { encoding: 'utf-8' }).stdout?.trim()
  const sdk = developerDir ? join(developerDir, 'Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk') : ''
  return sdk && existsSync(sdk) ? { SDKROOT: sdk } : {}
}

if (process.platform === 'win32') {
  // Static libraries, so server.exe needs no DLLs next to it
  run('cmake', ['-B', 'build', '-DBUILD_SHARED_LIBS=OFF', '-DWHISPER_BUILD_TESTS=OFF'])
  run('cmake', ['--build', 'build', '--config', 'Release', '--target', 'server'])
} else {
  run('make', ['server'], process.platform === 'darwin' ? xcodeSdk() : {})
}
