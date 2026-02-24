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
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <h3 className="text-sm font-semibold tracking-wide">设置页</h3>
      <p className="mt-2 text-xs text-slate-300">金币收益参数 / 次数上限参数（可选） / 提示阈值参数 / 优先级偏好 / 数据导入导出</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <p className="text-xs text-slate-300">远征单次金币（万）</p>
          <input
            className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={settingsDraft.expeditionGoldPerRun}
            onChange={(event) => onSettingsDraftChange({ ...settingsDraft, expeditionGoldPerRun: event.target.value })}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-300">超越单次金币（万）</p>
          <input
            className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={settingsDraft.transcendenceGoldPerRun}
            onChange={(event) => onSettingsDraftChange({ ...settingsDraft, transcendenceGoldPerRun: event.target.value })}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-300">远征阈值(如84)</p>
          <input
            className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={settingsDraft.expeditionWarnThreshold}
            onChange={(event) => onSettingsDraftChange({ ...settingsDraft, expeditionWarnThreshold: event.target.value })}
            disabled={busy}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={settingsDraft.expeditionRunCap}
          onChange={(event) => onSettingsDraftChange({ ...settingsDraft, expeditionRunCap: event.target.value })}
          disabled={busy}
          placeholder="远征上限(可空)"
        />
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={settingsDraft.transcendenceRunCap}
          onChange={(event) => onSettingsDraftChange({ ...settingsDraft, transcendenceRunCap: event.target.value })}
          disabled={busy}
          placeholder="超越上限(可空)"
        />
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={settingsDraft.nightmareRunCap}
          onChange={(event) => onSettingsDraftChange({ ...settingsDraft, nightmareRunCap: event.target.value })}
          disabled={busy}
          placeholder="恶梦上限(可空)"
        />
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={settingsDraft.awakeningRunCap}
          onChange={(event) => onSettingsDraftChange({ ...settingsDraft, awakeningRunCap: event.target.value })}
          disabled={busy}
          placeholder="觉醒上限(可空)"
        />
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={settingsDraft.suppressionRunCap}
          onChange={(event) => onSettingsDraftChange({ ...settingsDraft, suppressionRunCap: event.target.value })}
          disabled={busy}
          placeholder="讨伐上限(可空)"
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="space-y-2">
          <p className="text-xs text-slate-300">超越阈值</p>
          <input
            className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={settingsDraft.transcendenceWarnThreshold}
            onChange={(event) => onSettingsDraftChange({ ...settingsDraft, transcendenceWarnThreshold: event.target.value })}
            disabled={busy}
          />
        </div>
        <div className="col-span-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-semibold text-slate-200">优先级偏好(1-5，默认 3)</p>
          <p className="mt-1 text-xs text-slate-400">数值越高，在“优先级待办”里的排序越靠前。</p>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {PRIORITY_SETTING_FIELDS.map((item) => (
              <label key={item.key} className="space-y-1 text-xs text-slate-300">
                <span>{item.label}</span>
                <select
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
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
        </div>
        <button className="task-btn" onClick={onSaveSettings} disabled={busy}>
          保存设置
        </button>
        <button className="task-btn" onClick={() => void onExportData()} disabled={busy}>
          导出 JSON
        </button>
        <button className="task-btn" onClick={() => void onImportData()} disabled={busy}>
          导入 JSON
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <h4 className="text-sm font-semibold">构建信息</h4>
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
          <div className="data-pill">版本: {buildInfo?.version ? `v${buildInfo.version}` : "--"}</div>
          <div className="data-pill">构建时间: {buildInfo?.buildTime ? formatBuildTime(buildInfo.buildTime) : "--"}</div>
          <div className="data-pill">作者: {buildInfo?.author ?? "--"}</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <h4 className="text-sm font-semibold">深渊回廊参数（当前账号同步）</h4>
        <p className="mt-1 text-xs text-slate-300">规则: 回廊统一在每周二、周四、周六 21:00 刷新，这里只需录入当前可打数量并同步到当前账号。</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-xs text-slate-300">下层数量</p>
            <select
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
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
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
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
            同步中层/下层到当前账号角色
          </button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <p className="text-xs text-slate-300">完成层级</p>
            <select
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={corridorDraft.completeLane}
              onChange={(event) =>
                onCorridorDraftChange({ ...corridorDraft, completeLane: event.target.value as "lower" | "middle" })
              }
              disabled={busy}
            >
              <option value="lower">下层</option>
              <option value="middle">中层</option>
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-300">当前角色完成次数</p>
            <select
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={corridorDraft.completeAmount}
              onChange={(event) => onCorridorDraftChange({ ...corridorDraft, completeAmount: event.target.value })}
              disabled={busy}
            >
              {buildCountOptions(1, COUNT_SELECT_MAX, corridorDraft.completeAmount).map((value) => (
                <option key={`corridor-complete-amount-${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end col-span-2">
            <button className="task-btn w-full" onClick={onApplyCorridorCompletionFromSettings} disabled={busy}>
              录入当前角色完成（所选层级）
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
