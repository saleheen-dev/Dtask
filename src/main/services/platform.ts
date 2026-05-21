/**
 * Platform utility to detect the current OS platform in a safe way.
 * Returns one of 'win32', 'darwin', or 'linux'.
 */
export type Platform = 'win32' | 'darwin' | 'linux'

/** Determine the current platform using Node's process.platform. */
export function getPlatform(): Platform {
  const p = process.platform
  if (p === 'win32' || p === 'darwin' || p === 'linux') {
    return p
  }
  // Fallback to linux for unknown platforms to keep behavior predictable
  return 'linux'
}
