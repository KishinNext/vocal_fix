import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Windows only. On macOS a shell wrapper kills the whisper server when the app dies
// (see whisperServer.ts); Windows has no equivalent, so a server that outlived a crash
// is found through its saved PID and killed the next time the app starts one.

const PID_FILE = 'server.pid'

// `tasklist /FO CSV /NH` prints one line per match: "server.exe","1234",...
export function isServerProcess(tasklistOutput: string, pid: number): boolean {
  return tasklistOutput
    .split(/\r?\n/)
    .some(line => line.toLowerCase().startsWith('"server.exe"') && line.includes(`"${pid}"`))
}

export function rememberServer(dir: string, pid: number) {
  fs.writeFileSync(path.join(dir, PID_FILE), String(pid))
}

export function forgetServer(dir: string) {
  fs.rmSync(path.join(dir, PID_FILE), { force: true })
}

export function killOrphanedServer(dir: string) {
  try {
    const pid = Number(fs.readFileSync(path.join(dir, PID_FILE), 'utf-8'))
    if (!Number.isInteger(pid) || pid <= 0) return
    // The PID may have been reused by an unrelated program: only kill a whisper server
    const tasks = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf-8' })
    if (isServerProcess(tasks, pid)) process.kill(pid)
  } catch {
    // no PID file, or the process is already gone
  } finally {
    forgetServer(dir)
  }
}
