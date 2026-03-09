import type { AppBuildInfo } from "../../../../../shared/types";
import { COUNT_SELECT_MAX, PRIORITY_SETTING_FIELDS, type CorridorDraft, type SettingsDraft } from "../dashboard-types";
import { buildCountOptions, formatBuildTime } from "../dashboard-utils";

interface DashboardSettingsPanelProps {
  visible: boolean;
  busy: boolean;
  settingsDraft: SettingsDraft;
  corridorDraft: CorridorDraft;
  buildInfo: AppBuildInfo | null;
  onSettingsDraftChange: (next: SettingsDraft) => void;
  onCorridorDraftChange: (next: CorridorDraft) => void;
  onSaveSettings: () => void;
  onExportData: () => Promise<void> | void;
  onImportData: () => Promise<void> | void;
  onApplyCorridorSettings: () => void;
  onApplyCorridorCompletionFromSettings: () => void;
}

export function DashboardSettingsPanel(props: DashboardSettingsPanelProps): JSX.Element | null {
  const {
    visible,
    busy,
    settingsDraft,
    corridorDraft,
    buildInfo,
    onSettingsDraftChange,
    onCorridorDraftChange,
    onSaveSettings,
    onExportData,
    onImportData,
    onApplyCorridorSettings,
    onApplyCorridorCompletionFromSettings,
  } = props;

  if (!visible) {
    return null;
  }

  return (
    <article className="glass-panel rounded-[30px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-kicker">Settings</p>
          <h3 className="panel-title !mt-1 !text-base">设置页</h3>
          <p className="panel-subtitle">把收益、阈值、优先级和数据操作收成几个短分组，减少整页输入框平铺。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="task-btn" onClick={onSaveSettings} disabled={busy}>
            保存设置
          </button>
          <button className="pill-btn" onClick={() => void onExportData()} disabled={busy}>
            导出 JSON
          </button>
          <button className="pill-btn" onClick={() => void onImportData()} disabled={busy}>
            导入 JSON
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="section-card">
          <p className="panel-kicker !tracking-[0.08em]">Economy</p>
          <h4 className="panel-title !mt-1 !text-sm">收益与阈值</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs text-slate-300">远征单次金币（万）</p>
              <input
                className="field-control"
                value={settingsDraft.expeditionGoldPerRun}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, expeditionGoldPerRun: event.target.value })}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-300">超越单次金币（万）</p>
              <input
                className="field-control"
                value={settingsDraft.transcendenceGoldPerRun}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, transcendenceGoldPerRun: event.target.value })}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-300">远征阈值</p>
              <input
                className="field-control"
                value={settingsDraft.expeditionWarnThreshold}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, expeditionWarnThreshold: event.target.value })}
                disabled={busy}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-slate-300">超越阈值</p>
              <input
                className="field-control"
                value={settingsDraft.transcendenceWarnThreshold}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, transcendenceWarnThreshold: event.target.value })}
                disabled={busy}
              />
            </div>
            <div className="grid grid-cols-5 gap-2">
              <input
                className="field-control-sm"
                value={settingsDraft.expeditionRunCap}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, expeditionRunCap: event.target.value })}
                disabled={busy}
                placeholder="远征上限"
              />
              <input
                className="field-control-sm"
                value={settingsDraft.transcendenceRunCap}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, transcendenceRunCap: event.target.value })}
                disabled={busy}
                placeholder="超越上限"
              />
              <input
                className="field-control-sm"
                value={settingsDraft.nightmareRunCap}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, nightmareRunCap: event.target.value })}
                disabled={busy}
                placeholder="恶梦上限"
              />
              <input
                className="field-control-sm"
                value={settingsDraft.awakeningRunCap}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, awakeningRunCap: event.target.value })}
                disabled={busy}
                placeholder="觉醒上限"
              />
              <input
                className="field-control-sm"
                value={settingsDraft.suppressionRunCap}
                onChange={(event) => onSettingsDraftChange({ ...settingsDraft, suppressionRunCap: event.target.value })}
                disabled={busy}
                placeholder="讨伐上限"
              />
            </div>
          </div>
        </section>

        <section className="section-card">
          <p className="panel-kicker !tracking-[0.08em]">Priority</p>
          <h4 className="panel-title !mt-1 !text-sm">优先级偏好</h4>
          <p className="summary-note mt-2">数值越高，在“优先级待办”里的排序越靠前。</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {PRIORITY_SETTING_FIELDS.map((item) => (
              <label key={item.key} className="space-y-1 text-xs text-slate-300">
                <span>{item.label}</span>
                <select
                  className="field-control-sm"
                  value={settingsDraft[item.key]}
                  onChange={(event) =>
                    onSettingsDraftChange({
                      ...settingsDraft,
                      [item.key]: event.target.value,
                    })
                  }
                  disabled={busy}
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={`${item.key}-${level}`} value={String(level)}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="section-card">
          <p className="panel-kicker !tracking-[0.08em]">Build</p>
          <h4 className="panel-title !mt-1 !text-sm">构建信息</h4>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="data-pill">版本: {buildInfo?.version ? `v${buildInfo.version}` : "--"}</div>
            <div className="data-pill">构建时间: {buildInfo?.buildTime ? formatBuildTime(buildInfo.buildTime) : "--"}</div>
            <div className="data-pill">作者: {buildInfo?.author ?? "--"}</div>
          </div>
        </section>

        <section className="section-card">
          <p className="panel-kicker !tracking-[0.08em]">Corridor</p>
          <h4 className="panel-title !mt-1 !text-sm">深渊回廊参数</h4>
          <p className="summary-note mt-2">统一在周二、周四、周六 21:00 刷新，这里只录入当前账号剩余数量和完成次数。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-xs text-slate-300">下层数量</p>
              <select
                className="field-control"
                value={corridorDraft.lowerAvailable}
                onChange={(event) => onCorridorDraftChange({ ...corridorDraft, lowerAvailable: event.target.value })}
                disabled={busy}
              >
                {Array.from({ length: 4 }, (_, i) => (
                  <option key={`lower-count-${i}`} value={String(i)}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-300">中层数量</p>
              <select
                className="field-control"
                value={corridorDraft.middleAvailable}
                onChange={(event) => onCorridorDraftChange({ ...corridorDraft, middleAvailable: event.target.value })}
                disabled={busy}
              >
                {Array.from({ length: 4 }, (_, i) => (
                  <option key={`middle-count-${i}`} value={String(i)}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <button className="task-btn w-full" onClick={onApplyCorridorSettings} disabled={busy}>
              同步到当前账号角色
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <select
              className="field-control"
              value={corridorDraft.completeLane}
              onChange={(event) =>
                onCorridorDraftChange({ ...corridorDraft, completeLane: event.target.value as "lower" | "middle" })
              }
              disabled={busy}
            >
              <option value="lower">完成层级: 下层</option>
              <option value="middle">完成层级: 中层</option>
            </select>
            <select
              className="field-control"
              value={corridorDraft.completeAmount}
              onChange={(event) => onCorridorDraftChange({ ...corridorDraft, completeAmount: event.target.value })}
              disabled={busy}
            >
              {buildCountOptions(1, COUNT_SELECT_MAX, corridorDraft.completeAmount).map((value) => (
                <option key={`corridor-complete-amount-${value}`} value={value}>
                  完成次数: {value}
                </option>
              ))}
            </select>
            <button className="pill-btn" onClick={onApplyCorridorCompletionFromSettings} disabled={busy}>
              录入完成
            </button>
          </div>
        </section>
      </div>
    </article>
  );
}
