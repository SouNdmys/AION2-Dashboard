import { useEffect, useMemo, useState } from "react";
import { TASK_DEFINITIONS } from "../../shared/constants";
import type { AppBuildInfo, AppState, TaskActionKind, TaskId } from "../../shared/types";
import { useAppActions } from "./features/dashboard/actions/useAppActions";
import { useDashboardHandlers } from "./features/dashboard/actions/useDashboardHandlers";
import { useDashboardDerivedModels } from "./features/dashboard/hooks/useDashboardDerivedModels";
import {
  COUNT_SELECT_MAX,
  MAX_CHARACTERS_PER_ACCOUNT,
  QUICK_CORRIDOR_TASKS,
  type AccountEditorDraft,
  type CorridorDraft,
  type DashboardMode,
  type DialogState,
  type OverviewSortKey,
  type OverviewTaskFilter,
  type QuickTaskId,
  type SettingsDraft,
  type ViewMode,
} from "./features/dashboard/dashboard-types";
import {
  buildCorridorDraft,
  buildCountOptions,
  buildSettingsDraft,
  getQuickActionsForTask,
  toGoldText,
} from "./features/dashboard/dashboard-utils";
import { DashboardOverviewSummaryCards } from "./features/dashboard/views/DashboardOverviewSummaryCards";
import { DashboardCharacterMainPanel } from "./features/dashboard/views/DashboardCharacterMainPanel";
import { DashboardCharacterModePanels } from "./features/dashboard/views/DashboardCharacterModePanels";
import { DashboardDialogModal } from "./features/dashboard/views/DashboardDialogModal";
import { DashboardLeftSidebar } from "./features/dashboard/views/DashboardLeftSidebar";
import { DashboardOverviewPanel } from "./features/dashboard/views/DashboardOverviewPanel";
import { DashboardRightSidebar } from "./features/dashboard/views/DashboardRightSidebar";
import { DashboardSettingsPanel } from "./features/dashboard/views/DashboardSettingsPanel";
import { DashboardToolbar } from "./features/dashboard/views/DashboardToolbar";
import { WorkshopView } from "./WorkshopView";

export function App(): JSX.Element {
  const appActions = useAppActions();
  const [state, setState] = useState<AppState | null>(null);
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountRegion, setNewAccountRegion] = useState("");
  const [accountEditor, setAccountEditor] = useState<AccountEditorDraft>({ name: "", regionTag: "" });
  const [newCharacterName, setNewCharacterName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("overview");
  const [undoSteps, setUndoSteps] = useState("2");
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [corridorDraft, setCorridorDraft] = useState<CorridorDraft>(buildCorridorDraft(0, 0));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [overviewSortKey, setOverviewSortKey] = useState<OverviewSortKey>("manual");
  const [overviewTaskFilter, setOverviewTaskFilter] = useState<OverviewTaskFilter>("all");
  const [overviewAccountFilter, setOverviewAccountFilter] = useState<string>("all");
  const [overviewRegionFilter, setOverviewRegionFilter] = useState<string>("all");
  const [quickCharacterId, setQuickCharacterId] = useState("");
  const [quickTaskId, setQuickTaskId] = useState<QuickTaskId>("expedition");
  const [quickAction, setQuickAction] = useState<TaskActionKind>("complete_once");
  const [quickAmount, setQuickAmount] = useState("1");
  const [profileClassTagInput, setProfileClassTagInput] = useState("");
  const [profileGearScoreInput, setProfileGearScoreInput] = useState("");
  const [draggingCharacterId, setDraggingCharacterId] = useState<string | null>(null);
  const [dragOverCharacterId, setDragOverCharacterId] = useState<string | null>(null);
  const [weeklyExpeditionCompletedInput, setWeeklyExpeditionCompletedInput] = useState("0");
  const [weeklyTranscendenceCompletedInput, setWeeklyTranscendenceCompletedInput] = useState("0");
  const [shopAodePurchaseUsedInput, setShopAodePurchaseUsedInput] = useState("0");
  const [shopDailyDungeonTicketPurchaseUsedInput, setShopDailyDungeonTicketPurchaseUsedInput] = useState("0");
  const [transformAodeUsedInput, setTransformAodeUsedInput] = useState("0");
  const [workshopHistoryJumpItemId, setWorkshopHistoryJumpItemId] = useState<string | null>(null);
  const [workshopHistoryJumpSnapshotId, setWorkshopHistoryJumpSnapshotId] = useState<string | null>(null);
  const [workshopHistoryJumpNonce, setWorkshopHistoryJumpNonce] = useState(0);
  const [workshopPriceChangeNonce, setWorkshopPriceChangeNonce] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const [next, buildMeta] = await Promise.all([appActions.getState(), appActions.getBuildInfo()]);
        setState(next);
        setBuildInfo(buildMeta);
      } catch (err) {
        setError(err instanceof Error ? err.message : "初始化失败");
      }
    })();
  }, [appActions]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const {
    selected,
    selectedAccount,
    accountCharacters,
    selectedAodeLimits,
    selectedAccountExtraCharacterName,
    overviewRegionOptions,
    overviewRowsFiltered,
    groupedTasks,
    historyRows,
    characterNameById,
    accountNameById,
    countdownItems,
    priorityTodoItems,
    isWeeklyCriticalWindow,
    selectedEstimatedGold,
    selectedPendingLabels,
    readyCharacters,
    weeklyGold,
    pendingDaily,
    pendingWeekly,
    weeklyEarned,
    weeklyExpeditionRuns,
    weeklyTransRuns,
    expeditionWarnThreshold,
    transcendenceWarnThreshold,
    expeditionOverRewardThreshold,
    transcendenceOverThreshold,
    selectedAccountCharacterCount,
    selectedIsAodeExtra,
    selectedShopAodePurchaseRemaining,
    selectedShopDailyDungeonTicketPurchaseRemaining,
    selectedTransformAodeRemaining,
  } = useDashboardDerivedModels({
    state,
    nowMs,
    overviewSortKey,
    overviewTaskFilter,
    overviewAccountFilter,
    overviewRegionFilter,
  });

  useEffect(() => {
    setRenameName(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    setProfileClassTagInput(selected?.classTag ?? "");
    setProfileGearScoreInput(selected?.gearScore === undefined ? "" : String(selected.gearScore));
  }, [selected?.id, selected?.classTag, selected?.gearScore]);

  useEffect(() => {
    setAccountEditor({
      name: selectedAccount?.name ?? "",
      regionTag: selectedAccount?.regionTag ?? "",
    });
  }, [selectedAccount?.id, selectedAccount?.name, selectedAccount?.regionTag]);

  useEffect(() => {
    if (!state) return;
    setSettingsDraft(buildSettingsDraft(state.settings));
  }, [state?.settings]);

  useEffect(() => {
    if (!state) return;
    const fallback = selected?.id ?? state.characters[0]?.id ?? "";
    const exists = quickCharacterId ? state.characters.some((item) => item.id === quickCharacterId) : false;
    if (!exists) {
      setQuickCharacterId(fallback);
    }
  }, [state, selected?.id, quickCharacterId]);

  useEffect(() => {
    if (!selected) return;
    setCorridorDraft((prev) => ({
      ...prev,
      ...buildCorridorDraft(selected.activities.corridorLowerAvailable, selected.activities.corridorMiddleAvailable),
      completeAmount: prev.completeAmount,
    }));
  }, [
    selected?.id,
    selected?.activities.corridorLowerAvailable,
    selected?.activities.corridorMiddleAvailable,
  ]);

  useEffect(() => {
    if (!selected) return;
    setWeeklyExpeditionCompletedInput(String(selected.stats.completions.expedition));
    setWeeklyTranscendenceCompletedInput(String(selected.stats.completions.transcendence));
  }, [selected?.id, selected?.stats.completions.expedition, selected?.stats.completions.transcendence]);

  useEffect(() => {
    if (!selected) return;
    setShopAodePurchaseUsedInput(String(selected.aodePlan.shopAodePurchaseUsed));
    setShopDailyDungeonTicketPurchaseUsedInput(String(selected.aodePlan.shopDailyDungeonTicketPurchaseUsed));
    setTransformAodeUsedInput(String(selected.aodePlan.transformAodeUsed));
  }, [
    selected?.id,
    selected?.aodePlan.shopAodePurchaseUsed,
    selected?.aodePlan.shopDailyDungeonTicketPurchaseUsed,
    selected?.aodePlan.transformAodeUsed,
  ]);

  const taskById = useMemo(() => {
    return new Map(TASK_DEFINITIONS.map((task) => [task.id, task]));
  }, []);

  const quickTask = taskById.get(quickTaskId as TaskId) ?? null;
  const quickCorridorTask = quickTaskId === "corridor_lower" || quickTaskId === "corridor_middle" ? QUICK_CORRIDOR_TASKS[quickTaskId] : null;
  const quickActionOptions = useMemo(() => {
    if (quickCorridorTask) {
      return ["set_completed"] as TaskActionKind[];
    }
    if (!quickTask) return [] as TaskActionKind[];
    return getQuickActionsForTask(quickTask);
  }, [quickTask, quickCorridorTask]);

  const quickAmountOptions = useMemo(() => {
    const min = quickAction === "set_completed" ? 0 : 1;
    const setCompletedMax = quickCorridorTask ? 3 : quickTask?.setCompletedTotal ?? COUNT_SELECT_MAX;
    const max = quickAction === "set_completed" ? Math.min(COUNT_SELECT_MAX, setCompletedMax) : COUNT_SELECT_MAX;
    return buildCountOptions(min, max, quickAmount);
  }, [quickAction, quickTask?.setCompletedTotal, quickCorridorTask, quickAmount]);

  useEffect(() => {
    if (!quickTask && !quickCorridorTask) return;
    if (!quickActionOptions.includes(quickAction)) {
      const nextAction = quickActionOptions[0] ?? "complete_once";
      setQuickAction(nextAction);
      setQuickAmount(nextAction === "set_completed" ? "0" : "1");
    }
  }, [quickTask, quickCorridorTask, quickActionOptions, quickAction]);

  useEffect(() => {
    setDraggingCharacterId(null);
    setDragOverCharacterId(null);
  }, [overviewSortKey]);

  const sanctumRaidTask = taskById.get("sanctum_raid");
  const sanctumBoxTask = taskById.get("sanctum_box");

  const canAddCharacterInSelectedAccount = selectedAccountCharacterCount < MAX_CHARACTERS_PER_ACCOUNT;
  const {
    openCompleteDialog,
    openUseTicketDialog,
    openSetCompletedDialog,
    openEnergyDialog,
    openTaskEditDialog,
    openSanctumEditDialog,
    onSyncCorridorStatus,
    onApplyCorridorCompletion,
    onConfirmDialog,
    onOverviewCardDragStart,
    onOverviewCardDragOver,
    onOverviewCardDrop,
    onOverviewCardDragEnd,
    onSwitchToOverview,
    onApplyQuickAction,
    onCheckAppUpdate,
    onResetWeeklyStats,
    onSaveWeeklyCompletions,
    onUndoSingleStep,
    onUndoMultiStep,
    onClearHistory,
    onSaveSettings,
    onExportData,
    onImportData,
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
  } = useDashboardHandlers({
    appActions,
    state,
    dialog,
    settingsDraft,
    selectedCharacter: selected,
    selectedAccount,
    taskById,
    corridorDraft,
    overviewSortKey,
    busy,
    draggingCharacterId,
    dragOverCharacterId,
    quickCharacterId,
    quickTaskId,
    quickAction,
    quickAmountInput: quickAmount,
    quickCorridorTask,
    characterNameById,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    undoStepsInput: undoSteps,
    newAccountName,
    newAccountRegion,
    accountNameInput: accountEditor.name,
    accountRegionInput: accountEditor.regionTag,
    canAddCharacterInSelectedAccount,
    newCharacterName,
    renameInput: renameName,
    profileClassTagInput,
    profileGearScoreInput,
    selectedAodePurchaseLimit: selectedAodeLimits.purchaseLimit,
    selectedAodeConvertLimit: selectedAodeLimits.convertLimit,
    shopAodePurchaseUsedInput,
    shopDailyDungeonTicketPurchaseUsedInput,
    transformAodeUsedInput,
    setBusy,
    setError,
    setDialogError,
    setInfoMessage,
    setState,
    setDialog,
    setCorridorDraft,
    setDashboardMode,
    setDraggingCharacterId,
    setDragOverCharacterId,
    setNewAccountName,
    setNewAccountRegion,
    setNewCharacterName,
    confirm: window.confirm,
  });

  if (!state || !settingsDraft) {
    return (
      <main className="min-h-screen p-8 text-slate-900">
        <div className="glass-panel mx-auto mt-20 max-w-md rounded-[28px] p-7 text-center">
          <p className="text-sm text-slate-200">正在加载 AION 2 Dashboard...</p>
          {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  if (!selected) {
    return (
      <main className="min-h-screen p-8 text-slate-900">
        <div className="hero-strip mx-auto mt-16 max-w-xl rounded-[32px] p-7">
          <h1 className="text-xl font-semibold">AION 2 Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">当前没有任何账号或角色数据。请先创建你的第一个账号。</p>
          <div className="mt-4 space-y-2">
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="新账号名称"
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              disabled={busy}
            />
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="大区(可选)"
              value={newAccountRegion}
              onChange={(event) => setNewAccountRegion(event.target.value)}
              disabled={busy}
            />
            <button className="task-btn w-full" onClick={onAddAccount} disabled={busy || !newAccountName.trim()}>
              创建第一个账号
            </button>
          </div>
          {infoMessage ? <p className="mt-3 text-xs text-emerald-300">{infoMessage}</p> : null}
          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 text-slate-900">
      <div className="grid min-h-[calc(100vh-3rem)] w-full grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px] 2xl:grid-cols-[340px_minmax(0,1fr)_400px] 2xl:gap-6">
        <DashboardLeftSidebar
          busy={busy}
          state={state}
          selectedAccount={selectedAccount}
          selected={selected}
          newAccountName={newAccountName}
          newAccountRegion={newAccountRegion}
          onNewAccountNameChange={setNewAccountName}
          onNewAccountRegionChange={setNewAccountRegion}
          onAddAccount={onAddAccount}
          accountEditor={accountEditor}
          onAccountEditorChange={setAccountEditor}
          onRenameAccount={onRenameAccount}
          onDeleteAccount={onDeleteAccount}
          onSelectAccount={onSelectAccount}
          maxCharactersPerAccount={MAX_CHARACTERS_PER_ACCOUNT}
          selectedAccountCharacterCount={selectedAccountCharacterCount}
          newCharacterName={newCharacterName}
          onNewCharacterNameChange={setNewCharacterName}
          onAddCharacter={onAddCharacter}
          canAddCharacterInSelectedAccount={canAddCharacterInSelectedAccount}
          accountCharacters={accountCharacters}
          onSelectCharacter={onSelectCharacter}
          onToggleCharacterStar={onToggleCharacterStar}
        />

        <section className="min-w-0 w-full space-y-5">
          <DashboardToolbar
            busy={busy}
            viewMode={viewMode}
            dashboardMode={dashboardMode}
            buildVersion={buildInfo?.version ?? null}
            infoMessage={infoMessage}
            error={error}
            onCheckAppUpdate={onCheckAppUpdate}
            onSwitchOverview={() => {
              setViewMode("dashboard");
              setDashboardMode("overview");
            }}
            onSwitchCharacter={() => {
              setViewMode("dashboard");
              setDashboardMode("character");
            }}
            onSwitchSettings={() => setViewMode("settings")}
            onSwitchWorkshop={() => setViewMode("workshop")}
          />

          <DashboardOverviewSummaryCards
            visible={viewMode === "dashboard"}
            readyCharacters={readyCharacters}
            weeklyGoldText={toGoldText(weeklyGold)}
            pendingDaily={pendingDaily}
            pendingWeekly={pendingWeekly}
          />

          <DashboardOverviewPanel
            visible={viewMode === "dashboard" && dashboardMode === "overview"}
            busy={busy}
            state={state}
            accountNameById={accountNameById}
            quickCharacterId={quickCharacterId}
            onQuickCharacterIdChange={setQuickCharacterId}
            quickTaskId={quickTaskId}
            onQuickTaskIdChange={setQuickTaskId}
            quickAction={quickAction}
            onQuickActionChange={setQuickAction}
            quickAmount={quickAmount}
            onQuickAmountChange={setQuickAmount}
            quickActionOptions={quickActionOptions}
            quickAmountOptions={quickAmountOptions}
            onApplyQuickAction={onApplyQuickAction}
            quickTaskExists={Boolean(quickTask)}
            quickTaskSetCompletedTotal={quickTask?.setCompletedTotal ?? null}
            quickCorridorTask={quickCorridorTask}
            overviewSortKey={overviewSortKey}
            onOverviewSortKeyChange={setOverviewSortKey}
            overviewTaskFilter={overviewTaskFilter}
            onOverviewTaskFilterChange={setOverviewTaskFilter}
            overviewAccountFilter={overviewAccountFilter}
            onOverviewAccountFilterChange={setOverviewAccountFilter}
            overviewRegionFilter={overviewRegionFilter}
            onOverviewRegionFilterChange={setOverviewRegionFilter}
            overviewRegionOptions={overviewRegionOptions}
            overviewRowsFiltered={overviewRowsFiltered}
            draggingCharacterId={draggingCharacterId}
            dragOverCharacterId={dragOverCharacterId}
            onOverviewCardDragStart={onOverviewCardDragStart}
            onOverviewCardDragOver={onOverviewCardDragOver}
            onOverviewCardDrop={onOverviewCardDrop}
            onOverviewCardDragEnd={onOverviewCardDragEnd}
            isWeeklyCriticalWindow={isWeeklyCriticalWindow}
            onSelectCharacter={onSelectCharacter}
          />

          <DashboardCharacterMainPanel
            visible={viewMode === "dashboard" && dashboardMode === "character"}
            busy={busy}
            selected={selected}
            accountName={selectedAccount?.name ?? "--"}
            accountRegionTag={selectedAccount?.regionTag ?? null}
            estimatedGoldText={toGoldText(selectedEstimatedGold)}
            classTag={selected.classTag?.trim() || "未填写"}
            gearScore={selected.gearScore}
            weeklyGoldEarnedText={toGoldText(selected.stats.goldEarned)}
            corridorLowerAvailable={selected.activities.corridorLowerAvailable}
            corridorMiddleAvailable={selected.activities.corridorMiddleAvailable}
            renameName={renameName}
            profileClassTagInput={profileClassTagInput}
            profileGearScoreInput={profileGearScoreInput}
            canDeleteCharacter={selectedAccountCharacterCount > 1}
            selectedAodeLimits={selectedAodeLimits}
            selectedIsAodeExtra={selectedIsAodeExtra}
            selectedAccountExtraCharacterName={selectedAccountExtraCharacterName}
            selectedShopAodePurchaseRemaining={selectedShopAodePurchaseRemaining}
            selectedShopDailyDungeonTicketPurchaseRemaining={selectedShopDailyDungeonTicketPurchaseRemaining}
            selectedTransformAodeRemaining={selectedTransformAodeRemaining}
            shopAodePurchaseUsedInput={shopAodePurchaseUsedInput}
            shopDailyDungeonTicketPurchaseUsedInput={shopDailyDungeonTicketPurchaseUsedInput}
            transformAodeUsedInput={transformAodeUsedInput}
            onSwitchToOverview={onSwitchToOverview}
            onRenameNameChange={setRenameName}
            onProfileClassTagInputChange={setProfileClassTagInput}
            onProfileGearScoreInputChange={setProfileGearScoreInput}
            onSaveCharacterProfile={onSaveCharacterProfile}
            onRenameCharacter={onRenameCharacter}
            onDeleteCharacter={onDeleteCharacter}
            onOpenEnergyDialog={openEnergyDialog}
            onSyncCorridorStatus={onSyncCorridorStatus}
            onApplyCorridorCompletion={onApplyCorridorCompletion}
            onResetWeeklyStats={onResetWeeklyStats}
            onShopAodePurchaseUsedInputChange={setShopAodePurchaseUsedInput}
            onShopDailyDungeonTicketPurchaseUsedInputChange={setShopDailyDungeonTicketPurchaseUsedInput}
            onTransformAodeUsedInputChange={setTransformAodeUsedInput}
            onSaveShopPlan={onSaveShopPlan}
            onAssignExtraAodeCharacter={onAssignExtraAodeCharacter}
            onSaveTransformPlan={onSaveTransformPlan}
          />

          <DashboardCharacterModePanels
            weeklyVisible={viewMode === "dashboard"}
            characterVisible={viewMode === "dashboard" && dashboardMode === "character"}
            busy={busy}
            weeklyEarnedText={toGoldText(weeklyEarned)}
            weeklyExpeditionRuns={weeklyExpeditionRuns}
            expeditionWarnThreshold={expeditionWarnThreshold}
            weeklyTransRuns={weeklyTransRuns}
            transcendenceWarnThreshold={transcendenceWarnThreshold}
            cycleStartedAt={selected.stats.cycleStartedAt}
            weeklyExpeditionCompletedInput={weeklyExpeditionCompletedInput}
            weeklyTranscendenceCompletedInput={weeklyTranscendenceCompletedInput}
            onWeeklyExpeditionCompletedInputChange={setWeeklyExpeditionCompletedInput}
            onWeeklyTranscendenceCompletedInputChange={setWeeklyTranscendenceCompletedInput}
            onSaveWeeklyCompletions={onSaveWeeklyCompletions}
            expeditionOverRewardThreshold={expeditionOverRewardThreshold}
            transcendenceOverThreshold={transcendenceOverThreshold}
            state={state}
            selected={selected}
            groupedTasks={groupedTasks}
            sanctumRaidTask={sanctumRaidTask}
            sanctumBoxTask={sanctumBoxTask}
            onOpenSetCompletedDialog={openSetCompletedDialog}
            onOpenCompleteDialog={openCompleteDialog}
            onOpenUseTicketDialog={openUseTicketDialog}
            onOpenTaskEditDialog={openTaskEditDialog}
            onOpenSanctumEditDialog={openSanctumEditDialog}
          />

          {viewMode === "workshop" ? (
            <WorkshopView
              externalPriceChangeNonce={workshopPriceChangeNonce}
              onJumpToHistoryManager={({ itemId, snapshotId }) => {
                setViewMode("workshop");
                setWorkshopHistoryJumpItemId(itemId);
                setWorkshopHistoryJumpSnapshotId(snapshotId ?? null);
                setWorkshopHistoryJumpNonce((prev) => prev + 1);
              }}
            />
          ) : null}

          <DashboardSettingsPanel
            visible={viewMode === "settings"}
            busy={busy}
            settingsDraft={settingsDraft}
            corridorDraft={corridorDraft}
            buildInfo={buildInfo}
            onSettingsDraftChange={setSettingsDraft}
            onCorridorDraftChange={setCorridorDraft}
            onSaveSettings={onSaveSettings}
            onExportData={onExportData}
            onImportData={onImportData}
            onApplyCorridorSettings={onApplyCorridorSettings}
            onApplyCorridorCompletionFromSettings={onApplyCorridorCompletionFromSettings}
          />

        </section>

        <DashboardRightSidebar
          busy={busy}
          historyCount={state.history.length}
          undoSteps={undoSteps}
          onUndoStepsChange={setUndoSteps}
          onUndoSingleStep={onUndoSingleStep}
          onUndoMultiStep={onUndoMultiStep}
          onClearHistory={onClearHistory}
          viewMode={viewMode}
          dashboardMode={dashboardMode}
          workshopHistoryJumpItemId={workshopHistoryJumpItemId}
          workshopHistoryJumpSnapshotId={workshopHistoryJumpSnapshotId}
          workshopHistoryJumpNonce={workshopHistoryJumpNonce}
          onWorkshopPriceDataChanged={() => setWorkshopPriceChangeNonce((prev) => prev + 1)}
          countdownItems={countdownItems}
          nowMs={nowMs}
          priorityTodoItems={priorityTodoItems}
          historyRows={historyRows}
          characterNameById={characterNameById}
          pendingLabels={selectedPendingLabels}
        />
      </div>

      <DashboardDialogModal
        dialog={dialog}
        busy={busy}
        dialogError={dialogError}
        selected={selected}
        taskById={taskById}
        onDialogChange={(next) => setDialog(next)}
        onCancel={() => {
          setDialog(null);
          setDialogError(null);
        }}
        onConfirm={onConfirmDialog}
      />
    </main>
  );
}


