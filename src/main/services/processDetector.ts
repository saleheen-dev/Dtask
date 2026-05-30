import { exec } from 'child_process'
import util from 'util'
import { getPlatform } from './platform'
import type { ProcessInfo } from '../../common/types'

const execAsync = util.promisify(exec)

/**
 * Pure helper to parse Windows netstat output into ProcessInfo entries.
 */
function parseWindowsNetstatOutput(stdout: string): Map<number, { name?: string; ports: number[]; protocol: string; address?: string }> {
  const map = new Map<number, { name?: string; ports: number[]; protocol: string; address?: string }>()
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Expect a line with: Proto LocalAddress ForeignAddress State PID
    const parts = trimmed.split(/\s+/)
    // Basic sanity: need at least 5 columns and a PID at the end
    if (parts.length < 5) continue
    const proto = parts[0]
    const local = parts[1]
    // const _foreign = parts[2]
    // const _state = parts[3]
    const pidStr = parts[parts.length - 1]
    const pid = Number(pidStr)
    if (!Number.isFinite(pid)) continue
    const port = Number((local.split(':').pop()) || NaN)
    const portNum = Number.isFinite(port) ? port : NaN
    const entry = map.get(pid) ?? { ports: [], protocol: proto, address: local.split(':')[0] }
    if (Number.isFinite(portNum)) entry.ports.push(portNum)
    map.set(pid, entry)
  }
  // Normalize: dedupe ports
  for (const [pid, v] of map.entries()) {
    v.ports = Array.from(new Set(v.ports))
  }
  return map
}

/**
 * Parse Lsof-like output on macOS when available via -F options.
 * This function expects a compact, line-oriented format and extracts pid, name, and port if present.
 */
function parseMacLsofF(stdout: string): Map<number, { name?: string; ports: number[]; protocol: string; address?: string }> {
  const map = new Map<number, { name?: string; ports: number[]; protocol: string; address?: string }>()
  // macOS lsof with -F format yields lines like: p1234, cnode, n*:8080
  let current: { pid?: number; name?: string; port?: number; protocol?: string } = {}
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue
    const tag = line[0]
    const payload = line.substring(1)
    if (tag === 'p') {
      // start of a new entry
      current = { pid: Number(payload) }
      continue
    }
    if (tag === 'c') {
      current.name = payload
      continue
    }
    if (tag === 'n') {
      // n contains host:port, e.g., *:8080
      const m = payload.match(/:(\d+)$|^(?:.*:)?(\d+)$/)
      const port = m ? Number(m[1] ?? m[2]) : NaN
      if (!Number.isNaN(port)) current.port = port
    }
    // commit when we have a pid and name
    if (current.pid != null && current.name != null && current.port != null) {
      const pid = current.pid!
      const entry = map.get(pid) ?? { ports: [], protocol: current.protocol ?? 'TCP', address: '*' }
      entry.name = current.name
      entry.ports = Array.from(new Set([...(entry.ports ?? []), current.port!]))
      map.set(pid, entry)
      current = {}
    }
  }
  return map
}

/**
 * Parse Linux/UNIX style output to extract listening ports and process names.
 * We attempt to extract pid and port from lines.
 */
function parseUnixSS(stdout: string): Map<number, { name?: string; ports: number[]; protocol: string; address?: string }> {
  const map = new Map<number, { name?: string; ports: number[]; protocol: string; address?: string }>()
  for (const line of stdout.split(/\r?\n/)) {
    const s = line.trim()
    if (!s) continue
    // Block: ... pid=1234, name='node', ... or 'pid=1234' within line
    const pidMatch = line.match(/pid=(\d+)/)
    const pid = pidMatch ? Number(pidMatch[1]) : NaN
    // Port is at the end in socket information like 127.0.0.1:8080
    const portMatch = line.match(/:(\d+)\b/)
    const port = portMatch ? Number(portMatch[1]) : NaN
    if (!Number.isFinite(pid)) continue
    const nameMatch = line.match(/\)\s*pid=\d+\,?\s*(\w+)/) // heuristic
    const name = nameMatch ? nameMatch[1] : undefined
    const entry = map.get(pid) ?? { ports: [], protocol: 'TCP', address: undefined }
    if (!Number.isNaN(port)) entry.ports = Array.from(new Set([...(entry.ports ?? []), port]))
    if (name) entry.name = name
    map.set(pid, entry)
  }
  return map
}

export interface InternalProcessInfo {
  pid: number
  name: string
  ports: number[]
  protocol: string
  address?: string
}

/**
 * Main entry: list all listening processes with their ports.
 */
export async function listProcesses(): Promise<ProcessInfo[]> {
  const platform = getPlatform()
  const results: Map<number, { name?: string; ports: number[]; protocol: string; address?: string }> = new Map()

  try {
    if (platform === 'win32') {
      // Windows: netstat -ano and/or filter LISTENING lines
      const { stdout } = await execAsync('netstat -ano')
      const map = parseWindowsNetstatOutput(stdout)

      // Single tasklist call to build PID → name lookup
      const { stdout: taskOut } = await execAsync('tasklist /FO CSV /NH')
      const pidToName = new Map<number, string>()
      for (const line of taskOut.split(/\r?\n/)) {
        if (!line.trim()) continue
        const parts = line.split(',')
        const name = parts[0]?.replace(/['"]/g, '').trim()
        const pid = parseInt(parts[1]?.replace(/['"]/g, ''), 10)
        if (name && Number.isFinite(pid)) pidToName.set(pid, name)
      }

      for (const [pid, v] of map.entries()) {
        v.name = pidToName.get(pid) || v.name
        results.set(pid, v)
      }
    } else if (platform === 'darwin') {
      // macOS: use lsof to enumerate listening ports
      try {
        // Try portable parse with -F for easier parsing
        const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n -F')
        const map = parseMacLsofF(stdout)
        for (const [pid, v] of map.entries()) results.set(pid, v)
      } catch {
        // Fallback to textual parsing of netstat-like output
        const { stdout } = await execAsync('netstat -anv -p tcp')
        const map = new Map<number, { name?: string; ports: number[]; protocol: string; address?: string }>()
        for (const line of stdout.split(/\r?\n/)) {
          const m = line.match(/tcp\s+.*?LISTEN\s+([0-9.:]+)(?:\s+|$)/i)
          if (!m) continue
          const addr = m[1]
          const [host, portStr] = addr.split(':')
          const port = Number(portStr)
          const pidMatch = line.match(/pid=(\d+)/)
          const pid = pidMatch ? Number(pidMatch[1]) : NaN
          if (!Number.isFinite(pid)) continue
          const v = map.get(pid) ?? { ports: [], protocol: 'TCP' as const, address: host }
          if (Number.isFinite(port)) v.ports = Array.from(new Set([...(v.ports ?? []), port]))
          map.set(pid, v)
        }
        for (const [pid, v] of map.entries()) results.set(pid, v)
      }
    } else {
      // linux
      try {
        const { stdout } = await execAsync('ss -tunlp -H')
        const map = new Map<number, { name?: string; ports: number[]; protocol: string; address?: string }>()
        for (const line of stdout.split(/\r?\n/)) {
          const parts = line.split(/\s+/)
          if (parts.length < 5) continue
          // Local address:port is in parts[3]
          const local = parts[3]
          const pidPart = line.match(/pid=(\d+)/)
          const pid = pidPart ? Number(pidPart[1]) : NaN
          if (!Number.isFinite(pid)) continue
          const port = Number(local.split(':').pop())
          const v = map.get(pid) ?? { ports: [], protocol: 'TCP', address: local.split(':')[0] }
          if (Number.isFinite(port)) v.ports = Array.from(new Set([...(v.ports ?? []), port]))
          map.set(pid, v)
        }
        for (const [pid, v] of map.entries()) results.set(pid, v)
      } catch {
        // fallback to netstat if ss is unavailable
        try {
          const { stdout } = await execAsync('netstat -tunlp')
          const map = new Map<number, { name?: string; ports: number[]; protocol: string; address?: string }>()
          for (const line of stdout.split(/\r?\n/)) {
            if (!line.includes('LISTEN')) continue
            const m = line.match(/:(\d+)\s/)
            const port = m ? Number(m[1]) : NaN
            const pidMatch = line.match(/pid=(\d+)/)
            const pid = pidMatch ? Number(pidMatch[1]) : NaN
            if (!Number.isFinite(pid)) continue
            const v = map.get(pid) ?? { ports: [], protocol: 'TCP', address: undefined }
            if (Number.isFinite(port)) v.ports = Array.from(new Set([...(v.ports ?? []), port]))
            map.set(pid, v)
          }
          for (const [pid, v] of map.entries()) results.set(pid, v)
        } catch {
          // if all else fails, return empty
        }
      }
    }
  } catch (err) {
    // If any error occurs, return empty list to renderer
    console.error('Error listing processes:', err)
  }

  const cmdlines = await fetchCmdlines(platform, results.keys())

  const list: ProcessInfo[] = []
  for (const [pid, v] of results.entries()) {
    if (!v.ports || v.ports.length === 0) continue
    list.push({ pid, name: (v.name ?? ''), ports: v.ports, protocol: v.protocol ?? 'TCP', address: v.address, cmdline: cmdlines.get(pid) })
  }
  // Ensure determinism for tests
  list.sort((a, b) => a.pid - b.pid)
  return list
}

async function fetchCmdlines(platform: string, pids: Iterable<number>): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  const pidSet = new Set(pids)
  if (pidSet.size === 0) return result
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, CommandLine | ConvertTo-Csv -NoTypeInformation"'
      )
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.trim() || line.startsWith('"ProcessId"')) continue
        const parts = line.split('","')
        if (parts.length < 2) continue
        const pid = parseInt(parts[0]?.replace(/"/g, ''), 10)
        if (!Number.isFinite(pid) || !pidSet.has(pid)) continue
        const cmd = parts.slice(1).join('","').replace(/""/g, '"').replace(/"$/, '').trim()
        if (cmd) result.set(pid, cmd)
      }
    } else {
      const { stdout } = await execAsync('ps -eo pid=,args=')
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const spaceIdx = trimmed.indexOf(' ')
        if (spaceIdx === -1) continue
        const pid = parseInt(trimmed.substring(0, spaceIdx), 10)
        if (!Number.isFinite(pid) || !pidSet.has(pid)) continue
        const cmd = trimmed.substring(spaceIdx + 1).trim()
        if (cmd) result.set(pid, cmd)
      }
    }
  } catch {
  }
  return result
}

/** lightweight export for tests and future extension */
export type ProcessInfoLocal = ProcessInfo
