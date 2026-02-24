import { getNextUnifiedCorridorRefresh } from "../../../../../shared/time";
import type { AppState } from "../../../../../shared/types";
import type { CorridorDraft } from "../dashboard-types";
import { toInt } from "../dashboard-utils";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;

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
    onError("回廊数量必须是 0-3");
    return;
  }
  const nextUnifiedAt = getNextUnifiedCorridorRefresh(new Date()).toISOString();
  await sync(appActions.updateArtifactStatus(selectedAccountId, lowerCount, nextUnifiedAt, middleCount, nextUnifiedAt), "已同步深渊回廊到当前账号角色");
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
  shopDailyDungeonTicketPurchaseUsedInput: string;
  purchaseLimit: number;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function saveShopPlanAction(params: SaveShopPlanParams): Promise<void> {
  const {
    selectedCharacterId,
    shopAodePurchaseUsedInput,
    shopDailyDungeonTicketPurchaseUsedInput,
    purchaseLimit,
    appActions,
    sync,
    onError,
  } = params;
  if (!selectedCharacterId) return;
  const shopAodePurchaseUsed = toInt(shopAodePurchaseUsedInput);
  const shopDailyDungeonTicketPurchaseUsed = toInt(shopDailyDungeonTicketPurchaseUsedInput);
  if (
    shopAodePurchaseUsed === null ||
    shopDailyDungeonTicketPurchaseUsed === null ||
    shopAodePurchaseUsed < 0 ||
    shopDailyDungeonTicketPurchaseUsed < 0
  ) {
    onError("微风商店次数必须是大于等于 0 的整数");
    return;
  }
  if (shopAodePurchaseUsed > purchaseLimit || shopDailyDungeonTicketPurchaseUsed > purchaseLimit) {
    onError(`超出本角色上限：微风商店每项最多 ${purchaseLimit}`);
    return;
  }
  await sync(
    appActions.updateAodePlan(selectedCharacterId, {
      shopAodePurchaseUsed,
      shopDailyDungeonTicketPurchaseUsed,
    }),
    "已保存微风商店记录",
  );
}

interface SaveTransformPlanParams {
  selectedCharacterId: string | null;
  transformAodeUsedInput: string;
  convertLimit: number;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function saveTransformPlanAction(params: SaveTransformPlanParams): Promise<void> {
  const { selectedCharacterId, transformAodeUsedInput, convertLimit, appActions, sync, onError } = params;
  if (!selectedCharacterId) return;
  const transformAodeUsed = toInt(transformAodeUsedInput);
  if (transformAodeUsed === null || transformAodeUsed < 0) {
    onError("变换次数必须是大于等于 0 的整数");
    return;
  }
  if (transformAodeUsed > convertLimit) {
    onError(`超出本角色上限：变换最多 ${convertLimit}`);
    return;
  }
  await sync(
    appActions.updateAodePlan(selectedCharacterId, {
      transformAodeUsed,
    }),
    "已保存变换记录",
  );
}

interface AssignExtraAodeCharacterParams {
  selectedCharacterId: string | null;
  assignExtra: boolean;
  appActions: AppActions;
  sync: SyncRunner;
}

export async function assignExtraAodeCharacterAction(params: AssignExtraAodeCharacterParams): Promise<void> {
  const { selectedCharacterId, assignExtra, appActions, sync } = params;
  if (!selectedCharacterId) return;
  await sync(
    appActions.updateAodePlan(selectedCharacterId, {
      assignExtra,
    }),
    assignExtra ? "已设为本账号微风商店额外角色" : "已取消本角色额外资格",
  );
}
