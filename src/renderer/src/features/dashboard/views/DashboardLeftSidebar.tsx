import type { AppState, CharacterState } from "../../../../../shared/types";
import type { AccountEditorDraft, DashboardMode, ViewMode } from "../dashboard-types";

interface DashboardLeftSidebarProps {
  busy: boolean;
  state: AppState;
  selectedAccount: AppState["accounts"][number] | null;
  selected: CharacterState;
  collapsed: boolean;
  onToggleSidebar: () => void;
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
    collapsed,
    onToggleSidebar,
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
  const compactManagement = viewMode !== "dashboard";

  if (collapsed) {
    return (
      <aside className="sidebar-shell rounded-[30px] p-3">
        <div className="flex flex-col items-center gap-3">
          <button className="icon-btn" onClick={onToggleSidebar} disabled={busy} title="展开侧栏" aria-label="展开侧栏">
            {'>>'}
          </button>
          <button
            className={`nav-item h-10 w-10 !justify-center !rounded-2xl !px-0 ${viewMode === "dashboard" && dashboardMode === "overview" ? "nav-item-active" : ""}`}
            onClick={onSwitchOverview}
            disabled={busy}
            title="角色总览"
          >
            总
          </button>
          <button
            className={`nav-item h-10 w-10 !justify-center !rounded-2xl !px-0 ${viewMode === "dashboard" && dashboardMode === "character" ? "nav-item-active" : ""}`}
            onClick={onSwitchCharacter}
            disabled={busy}
            title="角色操作"
          >
            角
          </button>
          <button
            className={`nav-item h-10 w-10 !justify-center !rounded-2xl !px-0 ${viewMode === "workshop" ? "nav-item-active" : ""}`}
            onClick={onSwitchWorkshop}
            disabled={busy}
            title="做装模拟"
          >
            工
          </button>
          <button
            className={`nav-item h-10 w-10 !justify-center !rounded-2xl !px-0 ${viewMode === "settings" ? "nav-item-active" : ""}`}
            onClick={onSwitchSettings}
            disabled={busy}
            title="设置页"
          >
            设
          </button>
          <div className="context-card w-full px-2 py-3 text-center">
            <p className="context-label">账号</p>
            <p className="mt-1 truncate text-xs font-semibold">{selectedAccount?.name ?? "--"}</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar-shell rounded-[30px] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="app-identity">
          <p className="panel-kicker">Dashboard</p>
          <h1 className="app-identity-title">AION2 Dashboard</h1>
          <p className="app-identity-subtitle">任务管理与做装工作台</p>
        </div>
        <button className="icon-btn" onClick={onToggleSidebar} disabled={busy} title="收起侧栏" aria-label="收起侧栏">
          {'<<'}
        </button>
      </div>

      <div className="workbench-panel mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Workspace</p>
            <h2 className="panel-title !mt-1 !text-sm">主导航</h2>
          </div>
          <span className="pill-btn pill-static whitespace-nowrap">v{buildVersion ?? "--"}</span>
        </div>

        <div className="nav-stack mt-3">
          <button
            className={`nav-item ${viewMode === "dashboard" && dashboardMode === "overview" ? "nav-item-active" : ""}`}
            onClick={onSwitchOverview}
            disabled={busy}
          >
            <span className="nav-item-label">角色总览</span>
            <span className="nav-item-meta">Overview</span>
          </button>
          <button
            className={`nav-item ${viewMode === "dashboard" && dashboardMode === "character" ? "nav-item-active" : ""}`}
            onClick={onSwitchCharacter}
            disabled={busy}
          >
            <span className="nav-item-label">角色操作</span>
            <span className="nav-item-meta">Character</span>
          </button>
          <button className={`nav-item ${viewMode === "workshop" ? "nav-item-active" : ""}`} onClick={onSwitchWorkshop} disabled={busy}>
            <span className="nav-item-label">做装模拟</span>
            <span className="nav-item-meta">Craft</span>
          </button>
          <button className={`nav-item ${viewMode === "settings" ? "nav-item-active" : ""}`} onClick={onSwitchSettings} disabled={busy}>
            <span className="nav-item-label">设置页</span>
            <span className="nav-item-meta">Settings</span>
          </button>
        </div>

        <div className="section-rule mt-3">
          <div className="toolbar-inline">
          <button className="pill-btn" onClick={onCheckAppUpdate} disabled={busy}>
            检查更新
          </button>
          <span className="summary-note">安装版支持启动即静默更新</span>
          </div>
        </div>
        {infoMessage ? <p className="banner-positive mt-3 rounded-xl px-3 py-2 text-xs">{infoMessage}</p> : null}
        {error ? <p className="banner-danger mt-3 rounded-xl px-3 py-2 text-xs">{error}</p> : null}
      </div>
      <div className="soft-card mb-4 p-4">
        <p className="panel-kicker !tracking-[0.08em]">Context</p>
        <h2 className="panel-title !mt-1 !text-sm">当前账号</h2>
        <div className="mt-3">
          <div className="context-card">
            <p className="context-label">账号</p>
            <p className="context-value">{selectedAccount?.name ?? "--"}</p>
            <p className="context-meta">{selectedAccount?.regionTag ? `${selectedAccount.regionTag} · ` : ""}角色 {selectedAccountCharacterCount}/{maxCharactersPerAccount}</p>
          </div>
        </div>
      </div>

      <details key={compactManagement ? "account-compact" : "account-open"} className="mb-4 group" open={!compactManagement}>
        <summary className="details-summary soft-card px-4 py-3">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Accounts</p>
            <h2 className="panel-title !mt-1 !text-sm">账号管理</h2>
          </div>
          <span className="pill-btn">
            <span className="group-open:hidden">展开</span>
            <span className="hidden group-open:inline">收起</span>
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            <input className="field-control" placeholder="新账号名称" value={newAccountName} onChange={(event) => onNewAccountNameChange(event.target.value)} disabled={busy} />
            <input className="field-control" placeholder="大区(可选)" value={newAccountRegion} onChange={(event) => onNewAccountRegionChange(event.target.value)} disabled={busy} />
            <button className="pill-btn w-full" onClick={onAddAccount} disabled={busy || !newAccountName.trim()}>
              新增账号
            </button>
          </div>

          <div className="max-h-40 space-y-2 overflow-auto pr-1">
            {state.accounts.map((account) => {
              const active = selectedAccount?.id === account.id;
              const count = state.characters.filter((item) => item.accountId === account.id).length;
              return (
                <button key={account.id} onClick={() => onSelectAccount(account.id)} className={`context-list-item ${active ? "context-list-item-active" : ""}`} disabled={busy}>
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {account.regionTag ? `${account.regionTag} | ` : ""}
                    角色 {count}/{maxCharactersPerAccount}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedAccount ? (
            <div className="space-y-2">
              <input className="field-control" value={accountEditor.name} onChange={(event) => onAccountEditorChange({ ...accountEditor, name: event.target.value })} disabled={busy} placeholder="账号名称" />
              <input className="field-control" value={accountEditor.regionTag} onChange={(event) => onAccountEditorChange({ ...accountEditor, regionTag: event.target.value })} disabled={busy} placeholder="大区(可选)" />
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
      </details>

      <details key={compactManagement ? "character-compact" : "character-open"} className="group" open={!compactManagement}>
        <summary className="details-summary soft-card px-4 py-3">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Characters</p>
            <h2 className="panel-title !mt-1 !text-sm">角色列表</h2>
          </div>
          <span className="pill-btn pill-static">
            {selectedAccountCharacterCount}/{maxCharactersPerAccount}
          </span>
        </summary>
        <div className="mt-3">
          <div className="mb-3 space-y-2">
            <input
              className="field-control"
              placeholder={selectedAccount ? `新增到 ${selectedAccount.name}` : "新角色名称"}
              value={newCharacterName}
              onChange={(event) => onNewCharacterNameChange(event.target.value)}
              disabled={busy || !selectedAccount}
            />
            <button className="pill-btn w-full" onClick={onAddCharacter} disabled={busy || !selectedAccount || !newCharacterName.trim() || !canAddCharacterInSelectedAccount}>
              新增角色
            </button>
          </div>
          <div className="space-y-2">
            {accountCharacters.map((item) => {
              const active = item.id === selected.id;
              return (
                <div key={item.id} className={`flex items-center gap-2 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[rgba(250,250,246,0.88)] px-3 py-2 transition ${active ? "border-[rgba(15,143,111,0.18)] bg-[rgba(15,143,111,0.06)]" : ""}`}>
                  <button onClick={() => onSelectCharacter(item.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={busy}>
                    <div className="avatar-ring">
                      <span className="avatar-dot">{item.name.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        奥德 {item.energy.baseCurrent}(+{item.energy.bonusCurrent})/{item.energy.baseCap}
                      </p>
                    </div>
                  </button>
                  <button
                    className={`icon-btn ${item.isStarred ? "!text-amber-500" : ""}`}
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
        </div>
      </details>
    </aside>
  );
}
