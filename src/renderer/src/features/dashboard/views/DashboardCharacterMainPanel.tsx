import type { CharacterState } from "../../../../../shared/types";
import { DashboardCharacterHeaderPanel } from "./DashboardCharacterHeaderPanel";
import { DashboardCharacterResourcePanels } from "./DashboardCharacterResourcePanels";

interface DashboardCharacterMainPanelProps {
  visible: boolean;
  busy: boolean;
  selected: CharacterState;
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
  selectedAodeLimits: {
    purchaseLimit: number;
    convertLimit: number;
  };
  selectedIsAodeExtra: boolean;
  selectedAccountExtraCharacterName: string | null;
  selectedShopAodePurchaseRemaining: number;
  selectedShopDailyDungeonTicketPurchaseRemaining: number;
  selectedTransformAodeRemaining: number;
  shopAodePurchaseUsedInput: string;
  shopDailyDungeonTicketPurchaseUsedInput: string;
  transformAodeUsedInput: string;
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
  onShopAodePurchaseUsedInputChange: (value: string) => void;
  onShopDailyDungeonTicketPurchaseUsedInputChange: (value: string) => void;
  onTransformAodeUsedInputChange: (value: string) => void;
  onSaveShopPlan: () => void;
  onAssignExtraAodeCharacter: (enabled: boolean) => void;
  onSaveTransformPlan: () => void;
}

export function DashboardCharacterMainPanel(props: DashboardCharacterMainPanelProps): JSX.Element | null {
  const {
    visible,
    busy,
    selected,
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
    selectedAodeLimits,
    selectedIsAodeExtra,
    selectedAccountExtraCharacterName,
    selectedShopAodePurchaseRemaining,
    selectedShopDailyDungeonTicketPurchaseRemaining,
    selectedTransformAodeRemaining,
    shopAodePurchaseUsedInput,
    shopDailyDungeonTicketPurchaseUsedInput,
    transformAodeUsedInput,
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
    onShopAodePurchaseUsedInputChange,
    onShopDailyDungeonTicketPurchaseUsedInputChange,
    onTransformAodeUsedInputChange,
    onSaveShopPlan,
    onAssignExtraAodeCharacter,
    onSaveTransformPlan,
  } = props;

  if (!visible) {
    return null;
  }

  return (
    <article className="glass-panel rounded-3xl p-5">
      <DashboardCharacterHeaderPanel
        visible={true}
        busy={busy}
        characterName={selected.name}
        accountName={accountName}
        accountRegionTag={accountRegionTag}
        estimatedGoldText={estimatedGoldText}
        classTag={classTag}
        gearScore={gearScore}
        weeklyGoldEarnedText={weeklyGoldEarnedText}
        corridorLowerAvailable={corridorLowerAvailable}
        corridorMiddleAvailable={corridorMiddleAvailable}
        renameName={renameName}
        profileClassTagInput={profileClassTagInput}
        profileGearScoreInput={profileGearScoreInput}
        canDeleteCharacter={canDeleteCharacter}
        onSwitchToOverview={onSwitchToOverview}
        onRenameNameChange={onRenameNameChange}
        onProfileClassTagInputChange={onProfileClassTagInputChange}
        onProfileGearScoreInputChange={onProfileGearScoreInputChange}
        onSaveCharacterProfile={onSaveCharacterProfile}
        onRenameCharacter={onRenameCharacter}
        onDeleteCharacter={onDeleteCharacter}
        onOpenEnergyDialog={onOpenEnergyDialog}
        onSyncCorridorStatus={onSyncCorridorStatus}
        onApplyCorridorCompletion={onApplyCorridorCompletion}
        onResetWeeklyStats={onResetWeeklyStats}
      />
      <DashboardCharacterResourcePanels
        busy={busy}
        selected={selected}
        selectedAodeLimits={selectedAodeLimits}
        selectedIsAodeExtra={selectedIsAodeExtra}
        selectedAccountExtraCharacterName={selectedAccountExtraCharacterName}
        selectedShopAodePurchaseRemaining={selectedShopAodePurchaseRemaining}
        selectedShopDailyDungeonTicketPurchaseRemaining={selectedShopDailyDungeonTicketPurchaseRemaining}
        selectedTransformAodeRemaining={selectedTransformAodeRemaining}
        shopAodePurchaseUsedInput={shopAodePurchaseUsedInput}
        shopDailyDungeonTicketPurchaseUsedInput={shopDailyDungeonTicketPurchaseUsedInput}
        transformAodeUsedInput={transformAodeUsedInput}
        onShopAodePurchaseUsedInputChange={onShopAodePurchaseUsedInputChange}
        onShopDailyDungeonTicketPurchaseUsedInputChange={onShopDailyDungeonTicketPurchaseUsedInputChange}
        onTransformAodeUsedInputChange={onTransformAodeUsedInputChange}
        onSaveShopPlan={onSaveShopPlan}
        onAssignExtraAodeCharacter={onAssignExtraAodeCharacter}
        onSaveTransformPlan={onSaveTransformPlan}
      />
    </article>
  );
}

