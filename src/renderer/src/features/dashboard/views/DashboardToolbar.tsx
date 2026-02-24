import type { DashboardMode, ViewMode } from "../dashboard-types";

interface DashboardToolbarProps {
  busy: boolean;
  viewMode: ViewMode;
  dashboardMode: DashboardMode;
  infoMessage: string | null;
  error: string | null;
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
    infoMessage,
    error,
    onSwitchOverview,
    onSwitchCharacter,
    onSwitchSettings,
    onSwitchWorkshop,
  } = props;

  return (
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-3 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`pill-btn ${viewMode === "dashboard" && dashboardMode === "overview" ? "bg-white/20" : ""}`}
          onClick={onSwitchOverview}
          disabled={busy}
        >
          角色总览
        </button>
        <button
          className={`pill-btn ${viewMode === "dashboard" && dashboardMode === "character" ? "bg-white/20" : ""}`}
          onClick={onSwitchCharacter}
          disabled={busy}
        >
          角色操作
        </button>
        <button className={`pill-btn ${viewMode === "settings" ? "bg-white/20" : ""}`} onClick={onSwitchSettings} disabled={busy}>
          设置页
        </button>
        <button className={`pill-btn ${viewMode === "workshop" ? "bg-white/20" : ""}`} onClick={onSwitchWorkshop} disabled={busy}>
          工坊
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-300">中栏为核心操作流，右栏承载日志与辅助信息。</p>
      {infoMessage ? <p className="mt-2 text-xs text-emerald-300">{infoMessage}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </article>
  );
}
