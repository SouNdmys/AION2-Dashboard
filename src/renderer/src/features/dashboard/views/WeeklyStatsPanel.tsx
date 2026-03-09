import { COUNT_SELECT_MAX } from "../dashboard-types";
import { buildCountOptions } from "../dashboard-utils";

interface WeeklyStatsPanelProps {
  visible: boolean;
  busy: boolean;
  weeklyEarnedText: string;
  weeklyExpeditionRuns: number;
  expeditionWarnThreshold: number;
  weeklyTransRuns: number;
  transcendenceWarnThreshold: number;
  cycleStartedAt: string;
  weeklyExpeditionCompletedInput: string;
  weeklyTranscendenceCompletedInput: string;
  onWeeklyExpeditionCompletedInputChange: (value: string) => void;
  onWeeklyTranscendenceCompletedInputChange: (value: string) => void;
  onSaveWeeklyCompletions: () => void;
  expeditionOverRewardThreshold: boolean;
  transcendenceOverThreshold: boolean;
}

export function WeeklyStatsPanel(props: WeeklyStatsPanelProps): JSX.Element | null {
  const {
    visible,
    busy,
    weeklyEarnedText,
    weeklyExpeditionRuns,
    expeditionWarnThreshold,
    weeklyTransRuns,
    transcendenceWarnThreshold,
    cycleStartedAt,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    onWeeklyExpeditionCompletedInputChange,
    onWeeklyTranscendenceCompletedInputChange,
    onSaveWeeklyCompletions,
    expeditionOverRewardThreshold,
    transcendenceOverThreshold,
  } = props;

  if (!visible) {
    return null;
  }

  return (
    <article className="glass-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-kicker">Weekly Summary</p>
          <h3 className="panel-title !mt-1 !text-sm">本周金币统计</h3>
        </div>
        <p className="summary-note">周收益统计每周三 05:00 自动重置，也可手动校准。</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm 2xl:grid-cols-4">
        <div className="data-pill">全角色本周收益: {weeklyEarnedText}</div>
        <div className="data-pill">全角色远征次数: {weeklyExpeditionRuns} (阈值 {expeditionWarnThreshold})</div>
        <div className="data-pill">全角色超越次数: {weeklyTransRuns} (阈值 {transcendenceWarnThreshold})</div>
        <div className="data-pill">本轮统计起点: {new Date(cycleStartedAt).toLocaleString()}</div>
      </div>
      <div className="subtle-panel mt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-700">当前角色周次数校准</p>
          <p className="summary-note">用于误清空后回填真实次数。</p>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
          <select
            className="field-control"
            value={weeklyExpeditionCompletedInput}
            onChange={(event) => onWeeklyExpeditionCompletedInputChange(event.target.value)}
            disabled={busy}
          >
            {buildCountOptions(0, COUNT_SELECT_MAX, weeklyExpeditionCompletedInput).map((value) => (
              <option key={`weekly-expedition-${value}`} value={value}>
                远征 {value}
              </option>
            ))}
          </select>
          <select
            className="field-control"
            value={weeklyTranscendenceCompletedInput}
            onChange={(event) => onWeeklyTranscendenceCompletedInputChange(event.target.value)}
            disabled={busy}
          >
            {buildCountOptions(0, COUNT_SELECT_MAX, weeklyTranscendenceCompletedInput).map((value) => (
              <option key={`weekly-transcendence-${value}`} value={value}>
                超越 {value}
              </option>
            ))}
          </select>
          <button className="task-btn task-btn-soft task-btn-compact px-4" onClick={onSaveWeeklyCompletions} disabled={busy}>
            保存校准
          </button>
        </div>
      </div>
      {expeditionOverRewardThreshold ? (
        <p className="banner-warning mt-3 rounded-xl px-3 py-2 text-xs">
          警示: 远征已超过阈值 {expeditionWarnThreshold}，后续副本奖励将进入折扣区间（金币收益会下降）。
        </p>
      ) : null}
      {transcendenceOverThreshold ? (
        <p className="banner-warning mt-2 rounded-xl px-3 py-2 text-xs">
          提醒: 超越次数已超过阈值 {transcendenceWarnThreshold}，请按你的策略确认是否继续投入。
        </p>
      ) : null}
    </article>
  );
}

