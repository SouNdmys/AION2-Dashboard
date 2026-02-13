import { app, BrowserWindow, Menu, dialog } from "electron";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { registerIpcHandlers } from "./ipc";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");

function resolvePreloadPath(): string {
  const envPath = process.env.ELECTRON_PRELOAD_URL;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const candidates = ["../preload/index.mjs", "../preload/index.js", "../preload/index.cjs"];
  for (const candidate of candidates) {
    const target = join(__dirname, candidate);
    if (existsSync(target)) {
      return target;
    }
  }

  return join(__dirname, "../preload/index.js");
}

function createWindow(): void {
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
  const mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: !isDev,
    backgroundColor: "#0A0A0A00",
    icon: resolveAppIconPath(),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    vibrancy: process.platform === "darwin" ? "under-window" : undefined,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  if (!isDev && process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
  }
}

function resolveAppIconPath(): string | undefined {
  const candidates = [
    join(process.cwd(), "icon.png"),
    join(process.resourcesPath, "icon.png"),
    join(__dirname, "../../icon.png"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function setupAutoUpdater(): void {
  if (!app.isPackaged || process.platform !== "win32") {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[aion2-dashboard] checking for updates");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[aion2-dashboard] update available:", info.version);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[aion2-dashboard] update not available");
  });

  autoUpdater.on("error", (error) => {
    console.error("[aion2-dashboard] auto update failed", error);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const result = await dialog.showMessageBox({
      type: "info",
      title: "发现新版本",
      message: `新版本 ${info.version} 已下载完成。`,
      detail: "点击“立即重启更新”后将自动退出并安装更新。",
      buttons: ["立即重启更新", "稍后"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  void autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    console.error("[aion2-dashboard] check update request failed", error);
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
