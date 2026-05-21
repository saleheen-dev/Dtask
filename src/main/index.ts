import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
} from "electron";
import path from "path";
import { ProcessInfo } from "../common/types";
import { listProcesses } from "./services/processDetector";
import { killProcess } from "./services/processKiller";
import { readWindowState, saveWindowState } from "./services/windowState";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const iconPath = () => {
  const base = path.join(app.getAppPath(), "resources");
  return process.platform === "win32"
    ? path.join(base, "icon.ico")
    : path.join(base, "icon.png");
};

async function createWindow() {
  const state = await readWindowState();
  const preloadPath = path.resolve(__dirname, "..", "preload", "index.cjs");

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    show: false,
    icon: iconPath(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, "../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting && process.platform !== "darwin") {
      event.preventDefault();
      mainWindow?.hide();
    } else {
      const bounds = mainWindow?.getBounds();
      if (bounds) {
        saveWindowState({
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
        }).catch(() => {});
      }
    }
  });
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip("Task Killer");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Task Killer",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: "Refresh",
      click: () => {
        mainWindow?.webContents.send("refresh:process-list");
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

app.whenReady().then(async () => {
  await createWindow();
  createTray();

  const accelerator =
    process.platform === "darwin" ? "Cmd+Shift+T" : "Ctrl+Shift+T";
  globalShortcut.register(accelerator, () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  // Keep app alive in tray on Windows/Linux
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("process:list", async (): Promise<ProcessInfo[]> => {
  try {
    return await listProcesses();
  } catch (err) {
    console.error("Error listing processes:", err);
    return [];
  }
});

ipcMain.handle("process:kill", async (_event, pid: number) => {
  const res = await killProcess(pid);
  return res;
});
