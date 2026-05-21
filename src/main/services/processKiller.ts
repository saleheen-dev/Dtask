import { exec } from 'child_process'
import util from 'util'
import { getPlatform } from './platform'

const execAsync = util.promisify(exec)

import type { KillResult } from '../../common/types'

/**
 * Kill a process by PID in a platform-safe manner.
 */
export async function killProcess(pid: number): Promise<KillResult> {
  if (!Number.isFinite(pid) || pid !== Math.floor(pid)) {
    return { success: false, error: 'Invalid PID' }
  }
  if (pid < 10) {
    return { success: false, error: 'Cannot kill system process' }
  }

  const platform = getPlatform()
  try {
    if (platform === 'win32') {
      await execAsync(`taskkill /F /PID ${pid}`)
      return { success: true }
    } else {
      // macOS/Linux
      await execAsync(`kill -9 ${pid}`)
      return { success: true }
    }
  } catch (err: any) {
    const stderr: string = typeof err?.stderr === 'string' ? err.stderr : ''
    const errno = err?.errno
    const code = err?.code
    if (platform === 'win32') {
      if (stderr.toLowerCase().includes('access is denied')) {
        return { success: false, error: 'Access denied. Try running as administrator.' }
      }
      return { success: false, error: `Failed to kill PID ${pid}: ${stderr || String(err)}` }
    } else {
      if (errno === 'EPERM' || code === 'EPERM') {
        return { success: false, error: 'Operation not permitted' }
      }
      if (errno === 'ESRCH' || code === 'ESRCH') {
        return { success: false, error: 'No such process' }
      }
      return { success: false, error: `Failed to kill PID ${pid}: ${stderr || String(err)}` }
    }
  }
}
