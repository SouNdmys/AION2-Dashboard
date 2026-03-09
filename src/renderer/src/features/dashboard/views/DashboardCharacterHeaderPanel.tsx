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
  corridorLowerAvailable: number;
  corridorMiddleAvailable: number;
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
  onOpenEnergyDialog: () => void;
  onSyncCorridorStatus: () => void;
  onApplyCorridorCompletion: () => void;
  onResetWeeklyStats: () => void;
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
    corridorLowerAvailable,
    corridorMiddleAvailable,
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
    onOpenEnergyDialog,
    onSyncCorridorStatus,
    onApplyCorridorCompletion,
    onResetWeeklyStats,
  } = props;

  if (!visible) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-kicker">Current Character</p>
          <h2 className="panel-title !text-[1.55rem]">{characterName}</h2>
          <p className="panel-subtitle">
            所属账号: {accountName}
            {accountRegionTag ? ` (${accountRegionTag})` : ""}
          </p>
        </div>
        <button className="pill-btn" onClick={onSwitchToOverview} disabled={busy}>
          返回角色总览
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="mini-stat">
          <p className="mini-stat-label">清空奥德预估</p>
          <p className="mini-stat-value">{estimatedGoldText}</p>
        </div>
        <div className="mini-stat">
          <p className="mini-stat-label">职业 / 装分</p>
          <p className="mini-stat-value">
            {classTag} / {gearScore === undefined ? "未填写" : numberFormatter.format(gearScore)}
          </p>
        </div>
        <div className="mini-stat">
          <p className="mini-stat-label">本周收益</p>
          <p className="mini-stat-value">{weeklyGoldEarnedText}</p>
        </div>
        <div className="mini-stat">
          <p className="mini-stat-label">回廊剩余</p>
          <p className="mini-stat-value">
            下层 {corridorLowerAvailable} / 中层 {corridorMiddleAvailable}
          </p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="section-card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="panel-kicker !tracking-[0.08em]">Profile</p>
              <h3 className="panel-title !mt-1 !text-sm">角色资料</h3>
            </div>
            <button className="pill-btn" onClick={onSaveCharacterProfile} disabled={busy}>
              保存资料
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
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
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="pill-btn" onClick={onRenameCharacter} disabled={busy || !renameName.trim()}>
              重命名角色
            </button>
            <button className="pill-btn" onClick={onDeleteCharacter} disabled={busy || !canDeleteCharacter}>
              删除角色
            </button>
          </div>
        </section>

        <section className="section-card">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Actions</p>
            <h3 className="panel-title !mt-1 !text-sm">快捷操作</h3>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <button className="pill-btn w-full justify-center" onClick={onOpenEnergyDialog} disabled={busy}>
              手动改能量
            </button>
            <button className="pill-btn w-full justify-center" onClick={onSyncCorridorStatus} disabled={busy}>
              同步回廊
            </button>
            <button className="pill-btn w-full justify-center" onClick={onApplyCorridorCompletion} disabled={busy}>
              回廊录入完成
            </button>
            <button className="pill-btn w-full justify-center" onClick={onResetWeeklyStats} disabled={busy}>
              重置周收益
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
