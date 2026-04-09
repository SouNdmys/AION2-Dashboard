import type { AppState, CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import { DashboardCharacterTasksPanel } from "./DashboardCharacterTasksPanel";
import { WeeklyStatsPanel } from "./WeeklyStatsPanel";

interface DashboardCharacterModePanelsProps {
  weeklyVisible: boolean;
  characterVisible: boolean;
  busy: boolean;
  weeklyEarnedText: string;
  weeklyExpeditionRuns: number;
  expeditionWarnThreshold: number;
  weeklyTransRuns: number;
  transcendenceWarnThreshold: number;
  cycleStartedAt: string;
  weeklyExpeditionCompletedInput: string;
  weeklyTranscendenceCompletedInput: string;
  onWeeklyExpeditionCompletedInputChange: (value: string) => void;
  onWeeklyTranscendenceCompletedInputChange: (value: string) => void;
  onSaveWeeklyCompletions: () => void;
  expeditionOverRewardThreshold: boolean;
  transcendenceOverThreshold: boolean;
  state: AppState;
  selected: CharacterState;
  groupedTasks: Record<TaskDefinition["category"], TaskDefinition[]>;
  sanctumRaidTask?: TaskDefinition;
  sanctumBoxTask?: TaskDefinition;
  onOpenSetCompletedDialog: (task: TaskDefinition) => void;
  onOpenCompleteDialog: (taskId: TaskId, title: string) => void;
  onOpenUseTicketDialog: (taskId: TaskId, title: string) => void;
  onOpenTaskEditDialog: (
    taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "daily_dungeon" | "mini_game",
  ) => void;
  onOpenSanctumEditDialog: () => void;
}

export function DashboardCharacterModePanels(props: DashboardCharacterModePanelsProps): JSX.Element {
  const {
    weeklyVisible,
    characterVisible,
    busy,
    weeklyEarnedText,
    weeklyExpeditionRuns,
    expeditionWarnThreshold,
    weeklyTransRuns,
    transcendenceWarnThreshold,
    cycleStartedAt,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    onWeeklyExpeditionCompletedInputChange,
    onWeeklyTranscendenceCompletedInputChange,
    onSaveWeeklyCompletions,
    expeditionOverRewardThreshold,
    transcendenceOverThreshold,
    state,
    selected,
    groupedTasks,
    sanctumRaidTask,
    sanctumBoxTask,
    onOpenSetCompletedDialog,
    onOpenCompleteDialog,
    onOpenUseTicketDialog,
    onOpenTaskEditDialog,
    onOpenSanctumEditDialog,
  } = props;

  return (
    <>
      <WeeklyStatsPanel
        visible={weeklyVisible}
        busy={busy}
        weeklyEarnedText={weeklyEarnedText}
        weeklyExpeditionRuns={weeklyExpeditionRuns}
        expeditionWarnThreshold={expeditionWarnThreshold}
        weeklyTransRuns={weeklyTransRuns}
        transcendenceWarnThreshold={transcendenceWarnThreshold}
        cycleStartedAt={cycleStartedAt}
        weeklyExpeditionCompletedInput={weeklyExpeditionCompletedInput}
        weeklyTranscendenceCompletedInput={weeklyTranscendenceCompletedInput}
        onWeeklyExpeditionCompletedInputChange={onWeeklyExpeditionCompletedInputChange}
        onWeeklyTranscendenceCompletedInputChange={onWeeklyTranscendenceCompletedInputChange}
        onSaveWeeklyCompletions={onSaveWeeklyCompletions}
        expeditionOverRewardThreshold={expeditionOverRewardThreshold}
        transcendenceOverThreshold={transcendenceOverThreshold}
      />

      <DashboardCharacterTasksPanel
        visible={characterVisible}
        busy={busy}
        state={state}
        selected={selected}
        groupedTasks={groupedTasks}
        sanctumRaidTask={sanctumRaidTask}
        sanctumBoxTask={sanctumBoxTask}
        onOpenSetCompletedDialog={onOpenSetCompletedDialog}
        onOpenCompleteDialog={onOpenCompleteDialog}
        onOpenUseTicketDialog={onOpenUseTicketDialog}
        onOpenTaskEditDialog={onOpenTaskEditDialog}
        onOpenSanctumEditDialog={onOpenSanctumEditDialog}
      />
    </>
  );
}
