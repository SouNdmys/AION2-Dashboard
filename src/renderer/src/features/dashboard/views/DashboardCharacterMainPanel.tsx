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
  weeklyExpeditionRuns: number;
  expeditionWarnThreshold: number;
  weeklyTransRuns: number;
  transcendenceWarnThreshold: number;
  cycleStartedAt: string;
  weeklyExpeditionCompletedInput: string;
  weeklyTranscendenceCompletedInput: string;
  expeditionOverRewardThreshold: boolean;
  transcendenceOverThreshold: boolean;
  corridorLowerAvailable: number;
  corridorLowerCap: number;
  corridorMiddleAvailable: number;
  corridorMiddleCap: number;
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
  selectedShopExpeditionChoiceBoxRemaining: number;
  selectedShopNightmareInstantRemaining: number;
  selectedShopAbyssReplenishRemaining: number;
  selectedTransformAodeRemaining: number;
  shopAodePurchaseUsedInput: string;
  shopUnknownChallengeTicketUsedInput: string;
  shopExpeditionChoiceBoxUsedInput: string;
  shopNightmareInstantUsedInput: string;
  shopAbyssReplenishUsedInput: string;
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
  onWeeklyExpeditionCompletedInputChange: (value: string) => void;
  onWeeklyTranscendenceCompletedInputChange: (value: string) => void;
  onSaveWeeklyCompletions: () => void;
  onShopAodePurchaseUsedInputChange: (value: string) => void;
  onShopUnknownChallengeTicketUsedInputChange: (value: string) => void;
  onShopExpeditionChoiceBoxUsedInputChange: (value: string) => void;
  onShopNightmareInstantUsedInputChange: (value: string) => void;
  onShopAbyssReplenishUsedInputChange: (value: string) => void;
  onTransformAodeUsedInputChange: (value: string) => void;
  onSaveShopPlan: () => void;
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
    weeklyExpeditionRuns,
    expeditionWarnThreshold,
    weeklyTransRuns,
    transcendenceWarnThreshold,
    cycleStartedAt,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    expeditionOverRewardThreshold,
    transcendenceOverThreshold,
    corridorLowerAvailable,
    corridorLowerCap,
    corridorMiddleAvailable,
    corridorMiddleCap,
    renameName,
    profileClassTagInput,
    profileGearScoreInput,
    canDeleteCharacter,
    selectedAodeLimits,
    selectedIsAodeExtra,
    selectedAccountExtraCharacterName,
    selectedShopAodePurchaseRemaining,
    selectedShopDailyDungeonTicketPurchaseRemaining,
    selectedShopExpeditionChoiceBoxRemaining,
    selectedShopNightmareInstantRemaining,
    selectedShopAbyssReplenishRemaining,
    selectedTransformAodeRemaining,
    shopAodePurchaseUsedInput,
    shopUnknownChallengeTicketUsedInput,
    shopExpeditionChoiceBoxUsedInput,
    shopNightmareInstantUsedInput,
    shopAbyssReplenishUsedInput,
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
    onWeeklyExpeditionCompletedInputChange,
    onWeeklyTranscendenceCompletedInputChange,
    onSaveWeeklyCompletions,
    onShopAodePurchaseUsedInputChange,
    onShopUnknownChallengeTicketUsedInputChange,
    onShopExpeditionChoiceBoxUsedInputChange,
    onShopNightmareInstantUsedInputChange,
    onShopAbyssReplenishUsedInputChange,
    onTransformAodeUsedInputChange,
    onSaveShopPlan,
    onSaveTransformPlan,
  } = props;

  if (!visible) {
    return null;
  }

  return (
    <article className="character-page-shell glass-panel rounded-3xl p-5">
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
        weeklyExpeditionRuns={weeklyExpeditionRuns}
        expeditionWarnThreshold={expeditionWarnThreshold}
        weeklyTransRuns={weeklyTransRuns}
        transcendenceWarnThreshold={transcendenceWarnThreshold}
        cycleStartedAt={cycleStartedAt}
        weeklyExpeditionCompletedInput={weeklyExpeditionCompletedInput}
        weeklyTranscendenceCompletedInput={weeklyTranscendenceCompletedInput}
        expeditionOverRewardThreshold={expeditionOverRewardThreshold}
        transcendenceOverThreshold={transcendenceOverThreshold}
        corridorLowerAvailable={corridorLowerAvailable}
        corridorLowerCap={corridorLowerCap}
        corridorMiddleAvailable={corridorMiddleAvailable}
        corridorMiddleCap={corridorMiddleCap}
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
        onSyncCorridorStatus={onSyncCorridorStatus}
        onApplyCorridorCompletion={onApplyCorridorCompletion}
        onResetWeeklyStats={onResetWeeklyStats}
        onWeeklyExpeditionCompletedInputChange={onWeeklyExpeditionCompletedInputChange}
        onWeeklyTranscendenceCompletedInputChange={onWeeklyTranscendenceCompletedInputChange}
        onSaveWeeklyCompletions={onSaveWeeklyCompletions}
      />
      <DashboardCharacterResourcePanels
        busy={busy}
        selected={selected}
        onOpenEnergyDialog={onOpenEnergyDialog}
        selectedAodeLimits={selectedAodeLimits}
        selectedIsAodeExtra={selectedIsAodeExtra}
        selectedAccountExtraCharacterName={selectedAccountExtraCharacterName}
        selectedShopAodePurchaseRemaining={selectedShopAodePurchaseRemaining}
        selectedShopDailyDungeonTicketPurchaseRemaining={selectedShopDailyDungeonTicketPurchaseRemaining}
        selectedShopExpeditionChoiceBoxRemaining={selectedShopExpeditionChoiceBoxRemaining}
        selectedShopNightmareInstantRemaining={selectedShopNightmareInstantRemaining}
        selectedShopAbyssReplenishRemaining={selectedShopAbyssReplenishRemaining}
        selectedTransformAodeRemaining={selectedTransformAodeRemaining}
        shopAodePurchaseUsedInput={shopAodePurchaseUsedInput}
        shopUnknownChallengeTicketUsedInput={shopUnknownChallengeTicketUsedInput}
        shopExpeditionChoiceBoxUsedInput={shopExpeditionChoiceBoxUsedInput}
        shopNightmareInstantUsedInput={shopNightmareInstantUsedInput}
        shopAbyssReplenishUsedInput={shopAbyssReplenishUsedInput}
        transformAodeUsedInput={transformAodeUsedInput}
        onShopAodePurchaseUsedInputChange={onShopAodePurchaseUsedInputChange}
        onShopUnknownChallengeTicketUsedInputChange={onShopUnknownChallengeTicketUsedInputChange}
        onShopExpeditionChoiceBoxUsedInputChange={onShopExpeditionChoiceBoxUsedInputChange}
        onShopNightmareInstantUsedInputChange={onShopNightmareInstantUsedInputChange}
        onShopAbyssReplenishUsedInputChange={onShopAbyssReplenishUsedInputChange}
        onTransformAodeUsedInputChange={onTransformAodeUsedInputChange}
        onSaveShopPlan={onSaveShopPlan}
        onSaveTransformPlan={onSaveTransformPlan}
      />
    </article>
  );
}

