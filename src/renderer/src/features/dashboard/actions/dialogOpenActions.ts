import type { CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { CorridorDraft, DialogState } from "../dashboard-types";
import {
  buildCompleteDialog,
  buildCorridorCompleteDialog,
  buildCorridorSyncDialog,
  buildEnergyDialog,
  buildSanctumEditDialog,
  buildSetCompletedDialog,
  buildTaskEditDialog,
  buildUseTicketDialog,
} from "./dialogStateBuilders";

type OpenDialog = (dialog: DialogState) => void;
type ResetDialogError = () => void;
type TaskEditId = "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game";

interface OpenCompleteTaskDialogParams {
  taskId: TaskId;
  title: string;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openCompleteTaskDialogAction(params: OpenCompleteTaskDialogParams): void {
  const { taskId, title, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildCompleteDialog(taskId, title));
}

interface OpenUseTicketTaskDialogParams {
  taskId: TaskId;
  title: string;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openUseTicketTaskDialogAction(params: OpenUseTicketTaskDialogParams): void {
  const { taskId, title, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildUseTicketDialog(taskId, title));
}

interface OpenSetCompletedTaskDialogParams {
  task: TaskDefinition;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openSetCompletedTaskDialogAction(params: OpenSetCompletedTaskDialogParams): void {
  const { task, onDialogOpen, onDialogErrorReset } = params;
  const nextDialog = buildSetCompletedDialog(task);
  if (!nextDialog) return;
  onDialogErrorReset();
  onDialogOpen(nextDialog);
}

interface OpenEnergyDialogParams {
  selectedCharacter: CharacterState | null;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openEnergyDialogAction(params: OpenEnergyDialogParams): void {
  const { selectedCharacter, onDialogOpen, onDialogErrorReset } = params;
  if (!selectedCharacter) return;
  onDialogErrorReset();
  onDialogOpen(buildEnergyDialog(selectedCharacter));
}

interface OpenTaskEditDialogParams {
  selectedCharacter: CharacterState | null;
  taskId: TaskEditId;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openTaskEditDialogAction(params: OpenTaskEditDialogParams): void {
  const { selectedCharacter, taskId, onDialogOpen, onDialogErrorReset } = params;
  if (!selectedCharacter) return;
  onDialogErrorReset();
  onDialogOpen(buildTaskEditDialog(selectedCharacter, taskId));
}

interface OpenSanctumEditDialogParams {
  selectedCharacter: CharacterState | null;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openSanctumEditDialogAction(params: OpenSanctumEditDialogParams): void {
  const { selectedCharacter, onDialogOpen, onDialogErrorReset } = params;
  if (!selectedCharacter) return;
  onDialogErrorReset();
  onDialogOpen(buildSanctumEditDialog(selectedCharacter));
}

interface OpenCorridorSyncDialogParams {
  corridorDraft: CorridorDraft;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openCorridorSyncDialogAction(params: OpenCorridorSyncDialogParams): void {
  const { corridorDraft, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildCorridorSyncDialog(corridorDraft));
}

interface OpenCorridorCompleteDialogParams {
  corridorDraft: CorridorDraft;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openCorridorCompleteDialogAction(params: OpenCorridorCompleteDialogParams): void {
  const { corridorDraft, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildCorridorCompleteDialog(corridorDraft));
}
