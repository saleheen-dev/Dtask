# Dtask

A modern, open-source cross-platform desktop app built with **Electron v41.3.0** + **React v19.2** + **Vite** that lists all network processes with their ports and lets you kill them with one click.

![Tech Stack](https://img.shields.io/badge/Electron-41.3.0-9feaf9?style=flat-square)
![React](https://img.shields.io/badge/React-19.2-61dafb?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)

## Features

- **List processes** with their PID, name, listening port(s), and protocol
- **Search** by PID, process name, or port number
- **Kill processes** directly from the UI with a confirmation modal
- **System process protection** — warns before killing system processes (PID < 1000)
- **Auto-refresh** toggle to keep the list updated every 3 seconds
- **Sortable columns** — click any column header to sort
- **System tray** support — minimize to tray on Windows/Linux
- **Global shortcut** — `Ctrl/Cmd+Shift+T` to show/hide the app
- **Window state persistence** — remembers window size and position
- **Dark-mode-first** modern UI built with Tailwind CSS v4

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

## Platform Support

| Platform | Process Detection                | Process Killing    |
| -------- | -------------------------------- | ------------------ |
| Windows  | `netstat -ano` + `tasklist`      | `taskkill /F /PID` |
| macOS    | `lsof -iTCP -sTCP:LISTEN`        | `kill -9`          |
| Linux    | `ss -tunlp` (fallback `netstat`) | `kill -9`          |

## Security

- `contextIsolation: true` — renderer is isolated from Node.js
- `nodeIntegration: false` — no direct Node API access in renderer
- All OS commands run exclusively in the main process
- Preload script exposes a minimal, typed API surface
- PID validation and system process guards prevent accidental damage

## License

MIT
