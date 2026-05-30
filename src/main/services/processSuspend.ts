import { exec } from 'child_process'
import { getPlatform } from './platform'

function execWithTimeout(command: string, timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject({ ...error, code: error.code, stderr })
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

export async function suspendProcess(pid: number): Promise<{ success: boolean; error?: string }> {
  if (!Number.isFinite(pid) || pid !== Math.floor(pid)) {
    return { success: false, error: 'Invalid PID' }
  }
  if (pid < 10) {
    return { success: false, error: 'Cannot suspend system process' }
  }
  return toggleSuspend(pid, 'suspend')
}

export async function resumeProcess(pid: number): Promise<{ success: boolean; error?: string }> {
  if (!Number.isFinite(pid) || pid !== Math.floor(pid)) {
    return { success: false, error: 'Invalid PID' }
  }
  if (pid < 10) {
    return { success: false, error: 'Cannot resume system process' }
  }
  return toggleSuspend(pid, 'resume')
}

async function toggleSuspend(pid: number, action: 'suspend' | 'resume'): Promise<{ success: boolean; error?: string }> {
  const platform = getPlatform()
  try {
    if (platform === 'win32') {
      const suspendCall = action === 'suspend'
        ? '[SuspendUtil]::NtSuspendProcess($h) | Out-Null'
        : '[SuspendUtil]::NtResumeProcess($h) | Out-Null'
      const script = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class SuspendUtil {
  [DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h);
  [DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h);
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint d, bool i, uint p);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
}
'@
$h = [SuspendUtil]::OpenProcess(0x1F0FFF, $false, ${pid})
if ($h -ne [IntPtr]::Zero) {
  ${suspendCall}
  [SuspendUtil]::CloseHandle($h) | Out-Null
}
`
      const base64 = Buffer.from(script, 'utf16le').toString('base64')
      await execWithTimeout(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64}`, 20000)
      return { success: true }
    } else {
      const sig = action === 'suspend' ? 'SIGSTOP' : 'SIGCONT'
      await execWithTimeout(`kill -${sig} ${pid}`, 5000)
      return { success: true }
    }
  } catch (err: any) {
    const stderr: string = typeof err?.stderr === 'string' ? err.stderr : ''
    if (stderr.toLowerCase().includes('access is denied')) {
      return { success: false, error: 'Access denied. Try running as administrator.' }
    }
    const code = err?.code
    if (code === 'ETIMEDOUT' || err?.killed) {
      return { success: false, error: `${action === 'suspend' ? 'Suspend' : 'Resume'} timed out for PID ${pid}` }
    }
    return { success: false, error: stderr || String(err) }
  }
}
