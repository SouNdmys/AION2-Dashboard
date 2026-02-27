import type { AccountState, AppState, CharacterState } from "../../../../../shared/types";
import type { CorridorDraft } from "../dashboard-types";
import {
  addAccountAction,
  addCharacterAction,
  applyCorridorCompletionFromSettingsAction,
  applyCorridorSettingsAction,
  assignExtraAodeCharacterAction,
  deleteAccountAction,
  deleteCharacterAction,
  renameAccountAction,
  renameCharacterAction,
  saveCharacterProfileAction,
  saveShopPlanAction,
  saveTransformPlanAction,
  selectAccountAction,
  selectCharacterAction,
  toggleCharacterStarAction,
} from "./dashboardAccountResourceActions";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;
type SetDashboardMode = (mode: "overview" | "character") => void;
type SetError = (message: string | null) => void;
type SetValue = (value: string) => void;

interface CreateDashboardAccountResourceHandlersParams {
  newAccountName: string;
  newAccountRegion: string;
  selectedAccount: AccountState | null;
  accountNameInput: string;
  accountRegionInput: string;
  canAddCharacterInSelectedAccount: boolean;
  newCharacterName: string;
  selectedCharacter: CharacterState | null;
  renameInput: string;
  profileClassTagInput: string;
  profileGearScoreInput: string;
  corridorDraft: CorridorDraft;
  selectedAodePurchaseLimit: number;
  selectedAodeConvertLimit: number;
  shopAodePurchaseUsedInput: string;
  shopDailyDungeonTicketPurchaseUsedInput: string;
  transformAodeUsedInput: string;
  appActions: AppActions;
  sync: SyncRunner;
  setDashboardMode: SetDashboardMode;
  setError: SetError;
  setNewAccountName: SetValue;
  setNewAccountRegion: SetValue;
  setNewCharacterName: SetValue;
  confirm: (message: string) => boolean;
}

interface AccountResourceHandlers {
  onAddAccount: () => void;
  onSelectAccount: (accountId: string) => void;
  onRenameAccount: () => void;
  onDeleteAccount: () => void;
  onAddCharacter: () => void;
  onRenameCharacter: () => void;
  onSaveCharacterProfile: () => void;
  onDeleteCharacter: () => void;
  onSelectCharacter: (characterId: string) => void;
  onToggleCharacterStar: (characterId: string, isStarred: boolean) => void;
  onApplyCorridorSettings: () => void;
  onApplyCorridorCompletionFromSettings: () => void;
  onSaveShopPlan: () => void;
  onSaveTransformPlan: () => void;
  onAssignExtraAodeCharacter: (assignExtra: boolean) => void;
}

export function createDashboardAccountResourceHandlers(
  params: CreateDashboardAccountResourceHandlersParams,
): AccountResourceHandlers {
  const {
    newAccountName,
    newAccountRegion,
    selectedAccount,
    accountNameInput,
    accountRegionInput,
    canAddCharacterInSelectedAccount,
    newCharacterName,
    selectedCharacter,
    renameInput,
    profileClassTagInput,
    profileGearScoreInput,
    corridorDraft,
    selectedAodePurchaseLimit,
    selectedAodeConvertLimit,
    shopAodePurchaseUsedInput,
    shopDailyDungeonTicketPurchaseUsedInput,
    transformAodeUsedInput,
    appActions,
    sync,
    setDashboardMode,
    setError,
    setNewAccountName,
    setNewAccountRegion,
    setNewCharacterName,
    confirm,
  } = params;

  function onAddAccount(): void {
    addAccountAction({
      newAccountName,
      newAccountRegion,
      appActions,
      sync,
      onInputCleared: () => {
        setNewAccountName("");
        setNewAccountRegion("");
      },
    });
  }

  function onSelectAccount(accountId: string): void {
    selectAccountAction({
      accountId,
      appActions,
      sync,
    });
  }

  function onRenameAccount(): void {
    renameAccountAction({
      selectedAccount,
      accountNameInput,
      accountRegionInput,
      appActions,
      sync,
    });
  }

  function onDeleteAccount(): void {
    deleteAccountAction({
      selectedAccount,
      appActions,
      sync,
      confirm,
    });
  }

  function onAddCharacter(): void {
    addCharacterAction({
      selectedAccount,
      canAddCharacterInSelectedAccount,
      newCharacterName,
      appActions,
      sync,
      onError: setError,
      onInputCleared: () => setNewCharacterName(""),
    });
  }

  function onRenameCharacter(): void {
    renameCharacterAction({
      selectedCharacter,
      renameInput,
      appActions,
      sync,
    });
  }

  function onSaveCharacterProfile(): void {
    saveCharacterProfileAction({
      selectedCharacter,
      profileClassTagInput,
      profileGearScoreInput,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onDeleteCharacter(): void {
    deleteCharacterAction({
      selectedCharacter,
      appActions,
      sync,
      confirm,
    });
  }

  function onSelectCharacter(characterId: string): void {
    selectCharacterAction({
      characterId,
      appActions,
      sync,
      onBeforeSelect: () => setDashboardMode("character"),
    });
  }

  function onToggleCharacterStar(characterId: string, isStarred: boolean): void {
    toggleCharacterStarAction({
      characterId,
      isStarred,
      appActions,
      sync,
    });
  }

  function onApplyCorridorSettings(): void {
    void applyCorridorSettingsAction({
      selectedAccountId: selectedAccount?.id ?? null,
      corridorDraft,
      appActions,
      sync,
      onError: (message) => setError(message),
    });
  }

  function onApplyCorridorCompletionFromSettings(): void {
    void applyCorridorCompletionFromSettingsAction({
      selectedCharacterId: selectedCharacter?.id ?? null,
      corridorDraft,
      appActions,
      sync,
      onError: (message) => setError(message),
    });
  }

  function onSaveShopPlan(): void {
    void saveShopPlanAction({
      selectedCharacterId: selectedCharacter?.id ?? null,
      shopAodePurchaseUsedInput,
      shopDailyDungeonTicketPurchaseUsedInput,
      purchaseLimit: selectedAodePurchaseLimit,
      appActions,
      sync,
      onError: (message) => setError(message),
    });
  }

  function onSaveTransformPlan(): void {
    void saveTransformPlanAction({
      selectedCharacterId: selectedCharacter?.id ?? null,
      transformAodeUsedInput,
      convertLimit: selectedAodeConvertLimit,
      appActions,
      sync,
      onError: (message) => setError(message),
    });
  }

  function onAssignExtraAodeCharacter(assignExtra: boolean): void {
    void assignExtraAodeCharacterAction({
      selectedCharacterId: selectedCharacter?.id ?? null,
      assignExtra,
      appActions,
      sync,
    });
  }

  return {
    onAddAccount,
    onSelectAccount,
    onRenameAccount,
    onDeleteAccount,
    onAddCharacter,
    onRenameCharacter,
    onSaveCharacterProfile,
    onDeleteCharacter,
    onSelectCharacter,
    onToggleCharacterStar,
    onApplyCorridorSettings,
    onApplyCorridorCompletionFromSettings,
    onSaveShopPlan,
    onSaveTransformPlan,
    onAssignExtraAodeCharacter,
  };
}
