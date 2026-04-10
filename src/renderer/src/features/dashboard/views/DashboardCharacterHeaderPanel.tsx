import { COUNT_SELECT_MAX } from "../dashboard-types";
import { buildCountOptions } from "../dashboard-utils";

const numberFormatter = new Intl.NumberFormat("zh-CN");

interface DashboardCharacterHeaderPanelProps {
  visible: boolean;
  busy: boolean;
  characterName: string;
  accountName: string;
  accountRegionTag: string | null;
  estimatedGoldText: string;
  classTag: string;
  gearScore: number | undefined;
  weeklyGoldEarnedText: string;
  weeklyExpeditionRuns: number;
  expeditionWarnThreshold: number;
  weeklyTransRuns: number;
  transcendenceWarnThreshold: number;
  cycleStartedAt: string;
  weeklyExpeditionCompletedInput: string;
  weeklyTranscendenceCompletedInput: string;
  expeditionOverRewardThreshold: boolean;
  transcendenceOverThreshold: boolean;
  corridorLowerAvailable: number;
  corridorLowerCap: number;
  corridorMiddleAvailable: number;
  corridorMiddleCap: number;
  renameName: string;
  profileClassTagInput: string;
  profileGearScoreInput: string;
  canDeleteCharacter: boolean;
  onSwitchToOverview: () => void;
  onRenameNameChange: (value: string) => void;
  onProfileClassTagInputChange: (value: string) => void;
  onProfileGearScoreInputChange: (value: string) => void;
  onSaveCharacterProfile: () => void;
  onRenameCharacter: () => void;
  onDeleteCharacter: () => void;
  onSyncCorridorStatus: () => void;
  onApplyCorridorCompletion: () => void;
  onResetWeeklyStats: () => void;
  onWeeklyExpeditionCompletedInputChange: (value: string) => void;
  onWeeklyTranscendenceCompletedInputChange: (value: string) => void;
  onSaveWeeklyCompletions: () => void;
}

export function DashboardCharacterHeaderPanel(props: DashboardCharacterHeaderPanelProps): JSX.Element | null {
  const {
    visible,
    busy,
    characterName,
    accountName,
    accountRegionTag,
    estimatedGoldText,
    classTag,
    gearScore,
    weeklyGoldEarnedText,
    weeklyExpeditionRuns,
    expeditionWarnThreshold,
    weeklyTransRuns,
    transcendenceWarnThreshold,
    cycleStartedAt,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    expeditionOverRewardThreshold,
    transcendenceOverThreshold,
    corridorLowerAvailable,
    corridorLowerCap,
    corridorMiddleAvailable,
    corridorMiddleCap,
    renameName,
    profileClassTagInput,
    profileGearScoreInput,
    canDeleteCharacter,
    onSwitchToOverview,
    onRenameNameChange,
    onProfileClassTagInputChange,
    onProfileGearScoreInputChange,
    onSaveCharacterProfile,
    onRenameCharacter,
    onDeleteCharacter,
    onSyncCorridorStatus,
    onApplyCorridorCompletion,
    onResetWeeklyStats,
    onWeeklyExpeditionCompletedInputChange,
    onWeeklyTranscendenceCompletedInputChange,
    onSaveWeeklyCompletions,
  } = props;

  if (!visible) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      <section className="character-hero-shell workbench-panel rounded-[28px] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="panel-kicker">Current Character</p>
            <h2 className="panel-title !text-[1.45rem]">{characterName}</h2>
            <p className="panel-subtitle">
              所属账号: {accountName}
              {accountRegionTag ? ` (${accountRegionTag})` : ""}
            </p>
          </div>
          <button className="pill-btn" onClick={onSwitchToOverview} disabled={busy}>
            返回角色总览
          </button>
        </div>

        <div className="character-summary-strip mt-3">
          <div className="mini-stat mini-stat-compact">
            <p className="mini-stat-label">清空奥德预估</p>
            <p className="mini-stat-value">{estimatedGoldText}</p>
          </div>
          <div className="mini-stat mini-stat-compact">
            <p className="mini-stat-label">职业 / 装分</p>
            <p className="mini-stat-value">
              {classTag} / {gearScore === undefined ? "未填写" : numberFormatter.format(gearScore)}
            </p>
          </div>
          <div className="mini-stat mini-stat-compact">
            <p className="mini-stat-label">本周收益</p>
            <p className="mini-stat-value">{weeklyGoldEarnedText}</p>
          </div>
          <div className="mini-stat mini-stat-compact">
            <p className="mini-stat-label">回廊剩余</p>
            <p className="mini-stat-value">
              下层 {corridorLowerAvailable}/{corridorLowerCap} / 中层 {corridorMiddleAvailable}/{corridorMiddleCap}
            </p>
          </div>
        </div>
      </section>

      <section className="toolbar-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Character Tools</p>
            <h3 className="panel-title !mt-1 !text-sm">角色工具</h3>
          </div>
          <div className="toolbar-meta summary-note">
            <span>全角色远征 {weeklyExpeditionRuns}</span>
            <span>全角色超越 {weeklyTransRuns}</span>
            <span>起点 {new Date(cycleStartedAt).toLocaleString()}</span>
          </div>
        </div>

        <div className="character-tools-grid mt-3">
          <div className="character-tool-column">
            <div className="character-tool-title">周统计校准</div>
            <div className="toolbar-grid md:grid-cols-[minmax(0,0.86fr)_minmax(0,0.86fr)_auto_auto]">
              <select
                className="field-control"
                value={weeklyExpeditionCompletedInput}
                onChange={(event) => onWeeklyExpeditionCompletedInputChange(event.target.value)}
                disabled={busy}
              >
                {buildCountOptions(0, COUNT_SELECT_MAX, weeklyExpeditionCompletedInput).map((value) => (
                  <option key={`header-weekly-expedition-${value}`} value={value}>
                    当前角色远征 {value}
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
                  <option key={`header-weekly-transcendence-${value}`} value={value}>
                    当前角色超越 {value}
                  </option>
                ))}
              </select>
              <button className="task-btn task-btn-soft task-btn-compact character-action-btn character-action-btn-primary px-4" onClick={onSaveWeeklyCompletions} disabled={busy}>
                保存校准
              </button>
              <button className="pill-btn character-action-btn" onClick={onResetWeeklyStats} disabled={busy}>
                重置周收益
              </button>
            </div>
            {expeditionOverRewardThreshold || transcendenceOverThreshold ? (
              <div className="toolbar-meta mt-2">
                {expeditionOverRewardThreshold ? (
                  <span className="banner-warning rounded-lg px-3 py-2 text-xs">远征已超过阈值 {expeditionWarnThreshold}</span>
                ) : null}
                {transcendenceOverThreshold ? (
                  <span className="banner-warning rounded-lg px-3 py-2 text-xs">超越已超过阈值 {transcendenceWarnThreshold}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="character-tool-column">
            <div className="character-tool-title">资料与快捷操作</div>
            <div className="toolbar-grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.82fr)_minmax(0,0.82fr)]">
              <input
                className="field-control"
                value={renameName}
                onChange={(event) => onRenameNameChange(event.target.value)}
                disabled={busy}
                placeholder="角色名称"
              />
              <input
                className="field-control"
                value={profileClassTagInput}
                onChange={(event) => onProfileClassTagInputChange(event.target.value)}
                disabled={busy}
                placeholder="职业(示例: 剑星)"
              />
              <input
                className="field-control"
                value={profileGearScoreInput}
                onChange={(event) => onProfileGearScoreInputChange(event.target.value)}
                disabled={busy}
                placeholder="装分(整数)"
              />
            </div>
            <div className="toolbar-actions mt-2">
              <button className="task-btn task-btn-soft task-btn-compact character-action-btn character-action-btn-primary px-4" onClick={onSaveCharacterProfile} disabled={busy}>
                保存资料
              </button>
              <button className="pill-btn character-action-btn" onClick={onRenameCharacter} disabled={busy || !renameName.trim()}>
                重命名
              </button>
              <button className="pill-btn character-action-btn" onClick={onDeleteCharacter} disabled={busy || !canDeleteCharacter}>
                删除
              </button>
              <button className="pill-btn character-action-btn" onClick={onSyncCorridorStatus} disabled={busy}>
                同步回廊
              </button>
              <button className="pill-btn character-action-btn" onClick={onApplyCorridorCompletion} disabled={busy}>
                回廊录入完成
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
