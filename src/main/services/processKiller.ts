import { exec } from 'child_process'
import { getPlatform } from './platform'

import type { KillResult } from '../../common/types'

function execWithTimeout(command: string, timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject({ ...error, code: error.code, errno: (error as any).errno, stderr })
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

async function getProcessName(pid: number): Promise<string | null> {
  try {
    const { stdout } = await execWithTimeout(
      `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
      5000
    )
    const name = stdout.split(',')[0]?.replace(/['"]/g, '').trim()
    return name || null
  } catch {
    return null
  }
}

export async function killProcess(pid: number): Promise<KillResult> {
  if (!Number.isFinite(pid) || pid !== Math.floor(pid)) {
    return { success: false, error: 'Invalid PID' }
  }
  if (pid < 10) {
    return { success: false, error: 'Cannot kill system process' }
  }

  const platform = getPlatform()
  if (platform !== 'win32') {
    try {
      await execWithTimeout(`kill -9 ${pid}`, 10000)
      return { success: true }
    } catch (err: any) {
      const errno = err?.errno
      const code = err?.code
      if (errno === 'EPERM' || code === 'EPERM') {
        return { success: false, error: 'Operation not permitted' }
      }
      if (errno === 'ESRCH' || code === 'ESRCH') {
        return { success: false, error: 'No such process' }
      }
      if (code === 'ETIMEDOUT' || err?.killed) {
        return { success: false, error: `Kill timed out for PID ${pid}` }
      }
      return { success: false, error: `Failed to kill PID ${pid}: ${String(err)}` }
    }
  }

  const processName = await getProcessName(pid)

  let pidKillFailed = false
  try {
    await execWithTimeout(`taskkill /F /T /PID ${pid}`, 10000)
  } catch (err: any) {
    const stderr: string = typeof err?.stderr === 'string' ? err.stderr : ''
    if (stderr.toLowerCase().includes('access is denied')) {
      return { success: false, error: 'Access denied. Try running as administrator.' }
    }
    if (err?.code === 'ETIMEDOUT' || err?.killed) {
      return { success: false, error: `Kill timed out for PID ${pid}` }
    }
    pidKillFailed = true
  }

  if (processName) {
    const lower = processName.toLowerCase()
    if (!(lower.includes('system') || lower.includes('kernel'))) {
      try {
        await execWithTimeout(`taskkill /F /IM ${processName}`, 10000)
      } catch {
      }
    }
  }

  if (pidKillFailed) {
    return { success: false, error: `PID ${pid} not found or already exited` }
  }
  return { success: true }
}
