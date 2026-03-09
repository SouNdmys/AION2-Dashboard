import type { DashboardMode, ViewMode } from "../dashboard-types";

interface DashboardToolbarProps {
  busy: boolean;
  viewMode: ViewMode;
  dashboardMode: DashboardMode;
  buildVersion: string | null;
  infoMessage: string | null;
  error: string | null;
  onCheckAppUpdate: () => void;
  onSwitchOverview: () => void;
  onSwitchCharacter: () => void;
  onSwitchSettings: () => void;
  onSwitchWorkshop: () => void;
}

export function DashboardToolbar(props: DashboardToolbarProps): JSX.Element {
  const {
    busy,
    viewMode,
    dashboardMode,
    buildVersion,
    infoMessage,
    error,
    onCheckAppUpdate,
    onSwitchOverview,
    onSwitchCharacter,
    onSwitchSettings,
    onSwitchWorkshop,
  } = props;

  return (
    <article className="hero-strip rounded-[30px] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="panel-kicker">Workspace</p>
          <h3 className="panel-title !text-[1.2rem]">控制台导航</h3>
          <p className="panel-subtitle">中栏负责主任务，左右两侧只保留上下文和辅助控制，减少来回切换的压迫感。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill-btn pill-static whitespace-nowrap">版本: {buildVersion ? `v${buildVersion}` : "--"}</span>
          <button className="pill-btn whitespace-nowrap" onClick={onCheckAppUpdate} disabled={busy}>
            检查更新
          </button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          className={`pill-btn ${viewMode === "dashboard" && dashboardMode === "overview" ? "pill-btn-active" : ""}`}
          onClick={onSwitchOverview}
          disabled={busy}
        >
          角色总览
        </button>
        <button
          className={`pill-btn ${viewMode === "dashboard" && dashboardMode === "character" ? "pill-btn-active" : ""}`}
          onClick={onSwitchCharacter}
          disabled={busy}
        >
          角色操作
        </button>
        <button className={`pill-btn ${viewMode === "settings" ? "pill-btn-active" : ""}`} onClick={onSwitchSettings} disabled={busy}>
          设置页
        </button>
        <button className={`pill-btn ${viewMode === "workshop" ? "pill-btn-active" : ""}`} onClick={onSwitchWorkshop} disabled={busy}>
          做装模拟
        </button>
      </div>
      {infoMessage ? <p className="mt-3 text-xs text-emerald-300">{infoMessage}</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
    </article>
  );
}
