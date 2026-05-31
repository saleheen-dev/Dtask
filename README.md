# Dtask

A modern, open-source cross-platform desktop app built with **Electron v41.3.0** + **React v19.2** + **Vite** that lists all network processes with their ports and lets you kill them with one click.

![Tech Stack](https://img.shields.io/badge/Electron-41.3.0-9feaf9?style=flat-square)
![React](https://img.shields.io/badge/React-19.2-61dafb?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)

## Features

- **Process table** — lists all network processes with PID, name, listening port(s), protocol, and optional command-line path
- **Search** — filter by PID, process name, or port number
- **Sortable columns** — click any column header (PID, Name, Ports, Protocol) to sort ascending/descending
- **Kill processes** — single-click kill with confirmation modal; system process protection (PID < 1000)
- **Batch kill** — checkbox-select multiple processes and kill them all at once
- **Kill by port** — `Ctrl+K` opens a dialog; enter a port to find and kill the owning process
- **Port conflict detector** — ports shared by multiple processes are highlighted with an amber indicator
- **Group by executable** — collapse same-name processes (e.g. `chrome.exe × 12`) into one expandable row
- **Command-line column** — toggle to show full executable paths and arguments, with hover tooltip
- **Export CSV** — download `dtask-processes-*.csv` with all filtered rows
- **Suspend / Resume** — pause a process (yellow indicator) and resume it later
- **Change highlighting** — new processes since the last refresh pulse green for 2.5 seconds
- **Auto-refresh** — toggle to refresh every 3 seconds
- **System tray** — minimize to tray on Windows/Linux; right-click → Kill by port
- **Window state persistence** — remembers size and position across restarts
- **Dark-mode-first** — modern UI with shadcn/ui components and Tailwind CSS v4
- **Responsive header** — full toolbar on wide windows, hamburger command menu on narrow

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

Build the app for packaging:

```bash
npm run build
```

Create distributables:

```bash
# All platforms
npm run dist

# Platform-specific
npm run dist:win    # Windows NSIS installer
npm run dist:mac    # macOS DMG
npm run dist:linux  # Linux AppImage
```

### GitHub Release

Tag and push to trigger CI:

```bash
npm version patch   # or minor / major
git push origin v0.1.1
```

## Keyboard Shortcuts

| Shortcut       | Action                           |
|----------------|----------------------------------|
| `Ctrl+S`       | Focus search input               |
| `Ctrl+K`       | Open Kill by Port dialog         |
| `Ctrl+R`       | Refresh process list             |
| `Escape`       | Clear search / close dialogs     |

## Platform Support

| Platform | Process Detection                | Process Killing                             | Suspend/Resume                    |
| -------- | -------------------------------- | ------------------------------------------- | --------------------------------- |
| Windows  | `netstat -ano` + `tasklist`      | `taskkill /F /T /PID` + `taskkill /F /IM`   | PowerShell NtSuspendProcess/NtResumeProcess |
| macOS    | `lsof -iTCP -sTCP:LISTEN`        | `kill -9`                                   | `kill -SIGSTOP` / `kill -SIGCONT`|
| Linux    | `ss -tunlp` (fallback `netstat`) | `kill -9`                                   | `kill -SIGSTOP` / `kill -SIGCONT`|

## Security

- `contextIsolation: true` — renderer is isolated from Node.js
- `nodeIntegration: false` — no direct Node API access in renderer
- All OS commands run exclusively in the main process
- Preload script exposes a minimal, typed API surface
- PID validation and system process guards prevent accidental damage

## License

MIT
