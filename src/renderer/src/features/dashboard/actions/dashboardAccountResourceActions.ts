import { getNextUnifiedCorridorRefresh } from "../../../../../shared/time";
import {
  ABYSS_REPLENISH_TICKET_SERVER_LIMIT,
  AODE_CONVERT_SERVER_LIMIT,
  AODE_SHOP_SERVER_LIMIT,
  EXPEDITION_CHOICE_BOX_SERVER_LIMIT,
  NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT,
  UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT,
} from "../../../../../shared/constants";
import type { AccountState, AppState, CharacterState } from "../../../../../shared/types";
import { MAX_CHARACTERS_PER_ACCOUNT, type CorridorDraft } from "../dashboard-types";
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

interface ToggleCharacterStarParams {
  characterId: string;
  isStarred: boolean;
  appActions: AppActions;
  sync: SyncRunner;
}

export function toggleCharacterStarAction(params: ToggleCharacterStarParams): void {
  const { characterId, isStarred, appActions, sync } = params;
  void sync(appActions.setCharacterStar(characterId, isStarred), isStarred ? "已星标角色" : "已取消角色星标");
}

interface ApplyCorridorSettingsParams {
  selectedAccountId: string | null;
  corridorDraft: CorridorDraft;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function applyCorridorSettingsAction(params: ApplyCorridorSettingsParams): Promise<void> {
  const { selectedAccountId, corridorDraft, appActions, sync, onError } = params;
  if (!selectedAccountId) return;
  const lowerCount = toInt(corridorDraft.lowerAvailable);
  const middleCount = toInt(corridorDraft.middleAvailable);
  if (lowerCount === null || lowerCount < 0 || lowerCount > 3 || middleCount === null || middleCount < 0 || middleCount > 3) {
    onError("回廊上限必须是 0-3");
    return;
  }
  const nextUnifiedAt = getNextUnifiedCorridorRefresh(new Date()).toISOString();
  await sync(appActions.updateArtifactStatus(selectedAccountId, lowerCount, nextUnifiedAt, middleCount, nextUnifiedAt), "已同步深渊回廊上限到当前账号角色");
}

interface ApplyCorridorCompletionFromSettingsParams {
  selectedCharacterId: string | null;
  corridorDraft: CorridorDraft;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function applyCorridorCompletionFromSettingsAction(params: ApplyCorridorCompletionFromSettingsParams): Promise<void> {
  const { selectedCharacterId, corridorDraft, appActions, sync, onError } = params;
  if (!selectedCharacterId) return;
  const completed = toInt(corridorDraft.completeAmount);
  if (completed === null || completed <= 0) {
    onError("完成次数必须大于 0");
    return;
  }
  await sync(appActions.applyCorridorCompletion(selectedCharacterId, corridorDraft.completeLane, completed), "已录入深渊回廊完成次数");
}

interface SaveShopPlanParams {
  selectedCharacterId: string | null;
  shopAodePurchaseUsedInput: string;
  shopUnknownChallengeTicketUsedInput: string;
  shopExpeditionChoiceBoxUsedInput: string;
  shopNightmareInstantUsedInput: string;
  shopAbyssReplenishUsedInput: string;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function saveShopPlanAction(params: SaveShopPlanParams): Promise<void> {
  const {
    selectedCharacterId,
    shopAodePurchaseUsedInput,
    shopUnknownChallengeTicketUsedInput,
    shopExpeditionChoiceBoxUsedInput,
    shopNightmareInstantUsedInput,
    shopAbyssReplenishUsedInput,
    appActions,
    sync,
    onError,
  } = params;
  if (!selectedCharacterId) return;
  const shopAodePurchaseUsed = toInt(shopAodePurchaseUsedInput);
  const shopUnknownChallengeTicketUsed = toInt(shopUnknownChallengeTicketUsedInput);
  const shopExpeditionChoiceBoxUsed = toInt(shopExpeditionChoiceBoxUsedInput);
  const shopNightmareInstantUsed = toInt(shopNightmareInstantUsedInput);
  const shopAbyssReplenishUsed = toInt(shopAbyssReplenishUsedInput);
  if (
    shopAodePurchaseUsed === null ||
    shopUnknownChallengeTicketUsed === null ||
    shopExpeditionChoiceBoxUsed === null ||
    shopNightmareInstantUsed === null ||
    shopAbyssReplenishUsed === null ||
    shopAodePurchaseUsed < 0 ||
    shopUnknownChallengeTicketUsed < 0 ||
    shopExpeditionChoiceBoxUsed < 0 ||
    shopNightmareInstantUsed < 0 ||
    shopAbyssReplenishUsed < 0
  ) {
    onError("微风商店次数必须是大于等于 0 的整数");
    return;
  }
  if (shopAodePurchaseUsed > AODE_SHOP_SERVER_LIMIT) {
    onError(`奥德能量(刻印) 每周最多 ${AODE_SHOP_SERVER_LIMIT}`);
    return;
  }
  if (shopUnknownChallengeTicketUsed > UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT) {
    onError(`未知键队挑战券(刻印) 每周最多 ${UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT}`);
    return;
  }
  if (shopExpeditionChoiceBoxUsed > EXPEDITION_CHOICE_BOX_SERVER_LIMIT) {
    onError(`远征/超越挑战券选择箱(刻印) 每周最多 ${EXPEDITION_CHOICE_BOX_SERVER_LIMIT}`);
    return;
  }
  if (shopNightmareInstantUsed > NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT) {
    onError(`立即完成券: 恶梦(刻印) 每周最多 ${NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT}`);
    return;
  }
  if (shopAbyssReplenishUsed > ABYSS_REPLENISH_TICKET_SERVER_LIMIT) {
    onError(`深渊重镇补充券(刻印) 每周最多 ${ABYSS_REPLENISH_TICKET_SERVER_LIMIT}`);
    return;
  }
  await sync(
    appActions.updateAodePlan(selectedCharacterId, {
      shopAodePurchaseUsed,
      shopUnknownChallengeTicketUsed,
      shopExpeditionChoiceBoxUsed,
      shopNightmareInstantUsed,
      shopAbyssReplenishUsed,
    }),
    "已保存微风商店记录",
  );
}

interface SaveTransformPlanParams {
  selectedCharacterId: string | null;
  transformAodeUsedInput: string;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function saveTransformPlanAction(params: SaveTransformPlanParams): Promise<void> {
  const { selectedCharacterId, transformAodeUsedInput, appActions, sync, onError } = params;
  if (!selectedCharacterId) return;
  const transformAodeUsed = toInt(transformAodeUsedInput);
  if (transformAodeUsed === null || transformAodeUsed < 0) {
    onError("物资兑换次数必须是大于等于 0 的整数");
    return;
  }
  if (transformAodeUsed > AODE_CONVERT_SERVER_LIMIT) {
    onError(`物资兑换最多 ${AODE_CONVERT_SERVER_LIMIT}`);
    return;
  }
  await sync(
    appActions.updateAodePlan(selectedCharacterId, {
      transformAodeUsed,
    }),
    "已保存物资兑换记录",
  );
}
