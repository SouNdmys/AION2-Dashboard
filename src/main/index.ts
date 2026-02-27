import { app, BrowserWindow, Menu } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { initializeAutoUpdater } from "./app-updater";
import { registerIpcHandlers } from "./ipc";
import { buildRendererContentSecurityPolicy, withContentSecurityPolicyHeader } from "./security/csp";
import { cleanupWorkshopOcrHotkey, initializeWorkshopOcrAutomation } from "./workshop-automation";
import { cleanupWorkshopOcrEngine } from "./workshop-store/ocr";

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
      sandbox: true,
    },
  });
  installRendererContentSecurityPolicy(mainWindow, isDev);

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

function installRendererContentSecurityPolicy(mainWindow: BrowserWindow, isDev: boolean): void {
  const policy = buildRendererContentSecurityPolicy(isDev);
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    {
      urls: ["file://*/*", "http://localhost:*/*", "http://127.0.0.1:*/*"],
    },
    (details, callback) => {
      callback({
        responseHeaders: withContentSecurityPolicyHeader(details.responseHeaders, policy),
      });
    },
  );
}

function resolveAppIconPath(): string | undefined {
  const candidates = [
    join(process.cwd(), "icon.png"),
    join(process.resourcesPath, "icon.png"),
    join(__dirname, "../../icon.png"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

app.whenReady().then(() => {
  registerIpcHandlers();
  initializeWorkshopOcrAutomation();
  createWindow();
  initializeAutoUpdater();

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

app.on("will-quit", () => {
  cleanupWorkshopOcrHotkey();
  cleanupWorkshopOcrEngine();
});
