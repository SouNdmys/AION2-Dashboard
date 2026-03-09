import type { AppState, CharacterState } from "../../../../../shared/types";
import type { AccountEditorDraft, DashboardMode, ViewMode } from "../dashboard-types";

interface DashboardLeftSidebarProps {
  busy: boolean;
  state: AppState;
  selectedAccount: AppState["accounts"][number] | null;
  selected: CharacterState;
  newAccountName: string;
  newAccountRegion: string;
  onNewAccountNameChange: (value: string) => void;
  onNewAccountRegionChange: (value: string) => void;
  onAddAccount: () => void;
  accountEditor: AccountEditorDraft;
  onAccountEditorChange: (next: AccountEditorDraft) => void;
  onRenameAccount: () => void;
  onDeleteAccount: () => void;
  onSelectAccount: (accountId: string) => void;
  maxCharactersPerAccount: number;
  selectedAccountCharacterCount: number;
  newCharacterName: string;
  onNewCharacterNameChange: (value: string) => void;
  onAddCharacter: () => void;
  canAddCharacterInSelectedAccount: boolean;
  accountCharacters: CharacterState[];
  onSelectCharacter: (characterId: string) => void;
  onToggleCharacterStar: (characterId: string, isStarred: boolean) => void;
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

export function DashboardLeftSidebar(props: DashboardLeftSidebarProps): JSX.Element {
  const {
    busy,
    state,
    selectedAccount,
    selected,
    newAccountName,
    newAccountRegion,
    onNewAccountNameChange,
    onNewAccountRegionChange,
    onAddAccount,
    accountEditor,
    onAccountEditorChange,
    onRenameAccount,
    onDeleteAccount,
    onSelectAccount,
    maxCharactersPerAccount,
    selectedAccountCharacterCount,
    newCharacterName,
    onNewCharacterNameChange,
    onAddCharacter,
    canAddCharacterInSelectedAccount,
    accountCharacters,
    onSelectCharacter,
    onToggleCharacterStar,
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
    <aside className="glass-panel rounded-[30px] p-5">
      <div className="mb-4">
        <p className="panel-kicker">Roster</p>
        <h1 className="panel-title !mt-1 !text-[1.18rem]">AION 2</h1>
        <p className="panel-subtitle">左侧只做账号和角色上下文，避免把操作入口堆在这里。</p>
      </div>
      <div className="soft-card mb-4 p-4">
        <p className="panel-kicker !tracking-[0.08em]">Workspace</p>
        <h2 className="panel-title !mt-1 !text-sm">目录导航</h2>
        <div className="mt-3 space-y-2">
          <button
            className={`pill-btn w-full justify-start ${viewMode === "dashboard" && dashboardMode === "overview" ? "pill-btn-active" : ""}`}
            onClick={onSwitchOverview}
            disabled={busy}
          >
            角色总览
          </button>
          <button
            className={`pill-btn w-full justify-start ${viewMode === "dashboard" && dashboardMode === "character" ? "pill-btn-active" : ""}`}
            onClick={onSwitchCharacter}
            disabled={busy}
          >
            角色操作
          </button>
          <button className={`pill-btn w-full justify-start ${viewMode === "workshop" ? "pill-btn-active" : ""}`} onClick={onSwitchWorkshop} disabled={busy}>
            工坊
          </button>
          <button className={`pill-btn w-full justify-start ${viewMode === "settings" ? "pill-btn-active" : ""}`} onClick={onSwitchSettings} disabled={busy}>
            设置页
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="pill-btn pill-static">版本: {buildVersion ? `v${buildVersion}` : "--"}</span>
          <button className="pill-btn" onClick={onCheckAppUpdate} disabled={busy}>
            检查更新
          </button>
        </div>
        {infoMessage ? <p className="mt-3 text-xs text-emerald-300">{infoMessage}</p> : null}
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      </div>
      <div className="soft-card mb-4 p-4">
        <p className="text-xs font-semibold tracking-wide text-slate-200">账号管理</p>
        <div className="mt-2 space-y-2">
          <input
            className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            placeholder="新账号名称"
            value={newAccountName}
            onChange={(event) => onNewAccountNameChange(event.target.value)}
            disabled={busy}
          />
          <input
            className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            placeholder="大区(可选)"
            value={newAccountRegion}
            onChange={(event) => onNewAccountRegionChange(event.target.value)}
            disabled={busy}
          />
          <button className="pill-btn w-full" onClick={onAddAccount} disabled={busy || !newAccountName.trim()}>
            新增账号
          </button>
        </div>

        <div className="mt-3 max-h-40 space-y-2 overflow-auto pr-1">
          {state.accounts.map((account) => {
            const active = selectedAccount?.id === account.id;
            const count = state.characters.filter((item) => item.accountId === account.id).length;
            return (
              <button
                key={account.id}
                onClick={() => onSelectAccount(account.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  active ? "border-white/25 bg-white/15" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/10"
                }`}
                disabled={busy}
              >
                <p className="truncate font-medium">{account.name}</p>
                <p className="truncate text-xs text-slate-300">
                  {account.regionTag ? `${account.regionTag} | ` : ""}
                  角色 {count}/{maxCharactersPerAccount}
                </p>
              </button>
            );
          })}
        </div>

        {selectedAccount ? (
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={accountEditor.name}
              onChange={(event) => onAccountEditorChange({ ...accountEditor, name: event.target.value })}
              disabled={busy}
              placeholder="账号名称"
            />
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={accountEditor.regionTag}
              onChange={(event) => onAccountEditorChange({ ...accountEditor, regionTag: event.target.value })}
              disabled={busy}
              placeholder="大区(可选)"
            />
            <div className="grid grid-cols-2 gap-2">
              <button className="pill-btn w-full" onClick={onRenameAccount} disabled={busy || !accountEditor.name.trim()}>
                保存账号
              </button>
              <button className="pill-btn w-full" onClick={onDeleteAccount} disabled={busy || state.accounts.length <= 1}>
                删除账号
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-slate-200">角色管理</p>
        <p className="text-xs text-slate-300">
          {selectedAccountCharacterCount}/{maxCharactersPerAccount}
        </p>
      </div>
      <div className="mb-4 space-y-2">
        <input
          className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          placeholder={selectedAccount ? `新增到 ${selectedAccount.name}` : "新角色名称"}
          value={newCharacterName}
          onChange={(event) => onNewCharacterNameChange(event.target.value)}
          disabled={busy || !selectedAccount}
        />
        <button
          className="pill-btn w-full"
          onClick={onAddCharacter}
          disabled={busy || !selectedAccount || !newCharacterName.trim() || !canAddCharacterInSelectedAccount}
        >
          新增角色
        </button>
      </div>

      <div className="space-y-2">
        {accountCharacters.map((item) => {
          const active = item.id === selected.id;
          return (
            <div
              key={item.id}
              className={`group flex items-center gap-2 rounded-2xl border px-3 py-2 transition ${
                active ? "border-white/25 bg-white/15" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <button onClick={() => onSelectCharacter(item.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={busy}>
                <div className="avatar-ring">
                  <span className="avatar-dot">{item.name.slice(0, 1).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-slate-300">
                    奥德 {item.energy.baseCurrent}(+{item.energy.bonusCurrent})/{item.energy.baseCap}
                  </p>
                </div>
              </button>
              <button
                className={`rounded-md px-2 py-1 text-sm ${item.isStarred ? "text-amber-300" : "text-slate-400 hover:text-slate-200"}`}
                title={item.isStarred ? "取消星标" : "设为星标"}
                onClick={() => onToggleCharacterStar(item.id, !item.isStarred)}
                disabled={busy}
              >
                {item.isStarred ? "★" : "☆"}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
