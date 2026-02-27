import { app } from "electron";
import { createRequire } from "node:module";
import type { AppUpdateCheckResult, AppUpdateStatus } from "../shared/types";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");

let initialized = false;
let checkInFlight: Promise<AppUpdateCheckResult> | null = null;

function isUpdaterEnabled(): boolean {
  return app.isPackaged && process.platform === "win32";
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "更新检查失败";
}

function buildResult(
  status: AppUpdateStatus,
  message: string,
  latestVersion: string | undefined,
  installTriggered = false,
): AppUpdateCheckResult {
  return {
    status,
    currentVersion: app.getVersion(),
    latestVersion,
    message,
    installTriggered,
  };
}

export function initializeAutoUpdater(): void {
  if (initialized || !isUpdaterEnabled()) {
    return;
  }

  initialized = true;
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
  autoUpdater.on("update-downloaded", (info) => {
    console.log("[aion2-dashboard] update downloaded:", info.version);
  });

  void checkForAppUpdate({ installOnDownload: false, source: "startup" });
}

interface CheckForAppUpdateOptions {
  installOnDownload?: boolean;
  source?: "startup" | "manual";
}

export async function checkForAppUpdate(options: CheckForAppUpdateOptions = {}): Promise<AppUpdateCheckResult> {
  const { installOnDownload = true, source = "manual" } = options;

  if (!isUpdaterEnabled()) {
    return buildResult("disabled", "当前环境不支持自动更新（仅 Windows 安装版支持）。", undefined, false);
  }

  if (checkInFlight) {
    return buildResult("busy", "已有更新检查任务正在执行，请稍后。", undefined, false);
  }

  checkInFlight = (async () => {
    try {
      const checkResult = await autoUpdater.checkForUpdates();
      const latestVersion = checkResult?.updateInfo?.version;
      const currentVersion = app.getVersion();

      if (!latestVersion || latestVersion === currentVersion) {
        return buildResult("up-to-date", `当前已是最新版本 v${currentVersion}。`, latestVersion, false);
      }

      const downloadPromise = checkResult?.downloadPromise ?? autoUpdater.downloadUpdate();
      await downloadPromise;

      if (installOnDownload) {
        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 1200);
        return buildResult(
          "update-downloaded",
          `新版本 v${latestVersion} 已下载，应用即将自动重启安装。`,
          latestVersion,
          true,
        );
      }

      const message =
        source === "startup"
          ? `发现新版本 v${latestVersion}，已在后台下载，退出应用后自动安装。`
          : `新版本 v${latestVersion} 已下载，退出应用后自动安装。`;
      return buildResult("update-downloaded", message, latestVersion, false);
    } catch (error) {
      return buildResult("error", `更新检查失败: ${normalizeErrorMessage(error)}`, undefined, false);
    }
  })();

  try {
    return await checkInFlight;
  } finally {
    checkInFlight = null;
  }
}

