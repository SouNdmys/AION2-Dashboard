import type { AccountState, AppState, CharacterState } from "../../../../../shared/types";
import { MAX_CHARACTERS_PER_ACCOUNT } from "../dashboard-types";
import { toInt } from "../dashboard-utils";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;

interface AddAccountParams {
  newAccountName: string;
  newAccountRegion: string;
  appActions: AppActions;
  sync: SyncRunner;
  onInputCleared: () => void;
}

export function addAccountAction(params: AddAccountParams): void {
  const { newAccountName, newAccountRegion, appActions, sync, onInputCleared } = params;
  const name = newAccountName.trim();
  if (!name) return;
  const regionTag = newAccountRegion.trim();
  void sync(appActions.addAccount(name, regionTag || undefined));
  onInputCleared();
}

interface SelectAccountParams {
  accountId: string;
  appActions: AppActions;
  sync: SyncRunner;
}

export function selectAccountAction(params: SelectAccountParams): void {
  const { accountId, appActions, sync } = params;
  void sync(appActions.selectAccount(accountId));
}

interface RenameAccountParams {
  selectedAccount: AccountState | null;
  accountNameInput: string;
  accountRegionInput: string;
  appActions: AppActions;
  sync: SyncRunner;
}

export function renameAccountAction(params: RenameAccountParams): void {
  const { selectedAccount, accountNameInput, accountRegionInput, appActions, sync } = params;
  if (!selectedAccount) return;
  const name = accountNameInput.trim();
  if (!name) return;
  const regionTag = accountRegionInput.trim();
  void sync(appActions.renameAccount(selectedAccount.id, name, regionTag || undefined), "账号信息已更新");
}

interface DeleteAccountParams {
  selectedAccount: AccountState | null;
  appActions: AppActions;
  sync: SyncRunner;
  confirm: (message: string) => boolean;
}

export function deleteAccountAction(params: DeleteAccountParams): void {
  const { selectedAccount, appActions, sync, confirm } = params;
  if (!selectedAccount) return;
  const ok = confirm(`确认删除账号「${selectedAccount.name}」及其所有角色？`);
  if (!ok) return;
  void sync(appActions.deleteAccount(selectedAccount.id));
}

interface AddCharacterParams {
  selectedAccount: AccountState | null;
  canAddCharacterInSelectedAccount: boolean;
  newCharacterName: string;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
  onInputCleared: () => void;
}

export function addCharacterAction(params: AddCharacterParams): void {
  const {
    selectedAccount,
    canAddCharacterInSelectedAccount,
    newCharacterName,
    appActions,
    sync,
    onError,
    onInputCleared,
  } = params;
  if (!selectedAccount) return;
  if (!canAddCharacterInSelectedAccount) {
    onError(`当前账号最多 ${MAX_CHARACTERS_PER_ACCOUNT} 个角色`);
    return;
  }
  const name = newCharacterName.trim();
  if (!name) return;
  void sync(appActions.addCharacter(name, selectedAccount.id));
  onInputCleared();
}

interface RenameCharacterParams {
  selectedCharacter: CharacterState | null;
  renameInput: string;
  appActions: AppActions;
  sync: SyncRunner;
}

export function renameCharacterAction(params: RenameCharacterParams): void {
  const { selectedCharacter, renameInput, appActions, sync } = params;
  if (!selectedCharacter) return;
  const next = renameInput.trim();
  if (!next) return;
  void sync(appActions.renameCharacter(selectedCharacter.id, next));
}

interface SaveCharacterProfileParams {
  selectedCharacter: CharacterState | null;
  profileClassTagInput: string;
  profileGearScoreInput: string;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export function saveCharacterProfileAction(params: SaveCharacterProfileParams): void {
  const { selectedCharacter, profileClassTagInput, profileGearScoreInput, appActions, sync, onError } = params;
  if (!selectedCharacter) return;
  const classTag = profileClassTagInput.trim();
  const gearScoreText = profileGearScoreInput.trim();
  const gearScoreRaw = gearScoreText ? toInt(gearScoreText) : null;
  if (gearScoreText && (gearScoreRaw === null || gearScoreRaw < 0)) {
    onError("装分必须为大于等于 0 的整数");
    return;
  }
  void sync(
    appActions.updateCharacterProfile(selectedCharacter.id, {
      classTag: classTag || null,
      gearScore: gearScoreRaw === null ? null : gearScoreRaw,
    }),
    "已更新角色职业与装分",
  );
}

interface DeleteCharacterParams {
  selectedCharacter: CharacterState | null;
  appActions: AppActions;
  sync: SyncRunner;
  confirm: (message: string) => boolean;
}

export function deleteCharacterAction(params: DeleteCharacterParams): void {
  const { selectedCharacter, appActions, sync, confirm } = params;
  if (!selectedCharacter) return;
  const ok = confirm(`确认删除角色「${selectedCharacter.name}」？`);
  if (!ok) return;
  void sync(appActions.deleteCharacter(selectedCharacter.id));
}

interface SelectCharacterParams {
  characterId: string;
  appActions: AppActions;
  sync: SyncRunner;
  onBeforeSelect: () => void;
}

export function selectCharacterAction(params: SelectCharacterParams): void {
  const { characterId, appActions, sync, onBeforeSelect } = params;
  onBeforeSelect();
  void sync(appActions.selectCharacter(characterId));
}
