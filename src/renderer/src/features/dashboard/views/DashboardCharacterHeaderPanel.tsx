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
    <div className="flex items-start justify-between gap-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Current Character</p>
        <h2 className="mt-1 text-2xl font-semibold">{characterName}</h2>
        <p className="mt-1 text-xs text-slate-300">
          所属账号: {accountName}
          {accountRegionTag ? ` (${accountRegionTag})` : ""}
        </p>
        <p className="mt-2 text-sm text-slate-300">当前清空奥德预估: {estimatedGoldText}</p>
        <p className="mt-1 text-sm text-slate-300">
          职业: {classTag} | 装分: {gearScore === undefined ? "未填写" : numberFormatter.format(gearScore)}
        </p>
        <p className="mt-1 text-sm text-slate-300">本周已记录收益: {weeklyGoldEarnedText}</p>
        <p className="mt-1 text-sm text-slate-300">
          下层回廊剩余: {corridorLowerAvailable} 次 | 中层回廊剩余: {corridorMiddleAvailable} 次
        </p>
      </div>
      <div className="w-56 space-y-2">
        <button className="pill-btn w-full" onClick={onSwitchToOverview} disabled={busy}>
          返回角色总览
        </button>
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={renameName}
          onChange={(event) => onRenameNameChange(event.target.value)}
          disabled={busy}
        />
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={profileClassTagInput}
          onChange={(event) => onProfileClassTagInputChange(event.target.value)}
          disabled={busy}
          placeholder="职业(示例: 剑星)"
        />
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={profileGearScoreInput}
          onChange={(event) => onProfileGearScoreInputChange(event.target.value)}
          disabled={busy}
          placeholder="装分(整数)"
        />
        <button className="pill-btn w-full" onClick={onSaveCharacterProfile} disabled={busy}>
          保存职业/装分
        </button>
        <button className="pill-btn w-full" onClick={onRenameCharacter} disabled={busy || !renameName.trim()}>
          重命名当前角色
        </button>
        <button className="pill-btn w-full" onClick={onDeleteCharacter} disabled={busy || !canDeleteCharacter}>
          删除当前角色
        </button>
        <button className="pill-btn w-full" onClick={onOpenEnergyDialog} disabled={busy}>
          手动改能量
        </button>
        <button className="pill-btn w-full" onClick={onSyncCorridorStatus} disabled={busy}>
          同步回廊(当前账号)
        </button>
        <button className="pill-btn w-full" onClick={onApplyCorridorCompletion} disabled={busy}>
          回廊录入完成
        </button>
        <button className="pill-btn w-full" onClick={onResetWeeklyStats} disabled={busy}>
          重置周收益
        </button>
      </div>
    </div>
  );
}
