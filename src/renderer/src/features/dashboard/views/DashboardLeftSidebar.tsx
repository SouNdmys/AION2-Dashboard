import type { AppState, CharacterState } from "../../../../../shared/types";
import type { AccountEditorDraft } from "../dashboard-types";

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
  } = props;

  return (
    <aside className="glass-panel rounded-3xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <h1 className="mb-3 text-lg font-semibold tracking-wide">AION 2</h1>
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-3">
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
