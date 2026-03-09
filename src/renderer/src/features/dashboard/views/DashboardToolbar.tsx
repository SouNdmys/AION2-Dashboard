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
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-3 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-kicker">Workspace</p>
          <h3 className="panel-title">控制台导航</h3>
          <p className="panel-subtitle">中栏为核心操作流，右栏承载日志与辅助信息。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill-btn pill-static whitespace-nowrap">版本: {buildVersion ? `v${buildVersion}` : "--"}</span>
          <button className="pill-btn whitespace-nowrap" onClick={onCheckAppUpdate} disabled={busy}>
            检查更新
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
          工坊
        </button>
      </div>
      {infoMessage ? <p className="mt-2 text-xs text-emerald-300">{infoMessage}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </article>
  );
}
