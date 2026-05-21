import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
}

const DEFAULT_STATE: WindowState = {
  width: 1100,
  height: 700
}

const STATE_PATH = path.join(app.getPath('userData'), 'window-state.json')

export async function readWindowState(): Promise<WindowState> {
  try {
    const raw = await readFile(STATE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as WindowState
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

export async function saveWindowState(state: WindowState): Promise<void> {
  try {
    await writeFile(STATE_PATH, JSON.stringify(state), 'utf-8')
  } catch (err) {
    console.error('Failed to save window state:', err)
  }
}
