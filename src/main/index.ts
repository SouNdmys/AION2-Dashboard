import { app, BrowserWindow } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { registerIpcHandlers } from "./ipc";

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
  const mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0A0A0A00",
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
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

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
