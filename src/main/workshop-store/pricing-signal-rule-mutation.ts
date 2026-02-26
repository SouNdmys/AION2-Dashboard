import type { WorkshopPriceSignalRule, WorkshopState } from "../../shared/types";

export interface RunWorkshopSignalRuleMutationDeps {
  readState: () => WorkshopState;
  writeState: (next: WorkshopState) => WorkshopState;
  stateVersion: number;
  mergeRule: (current: WorkshopPriceSignalRule, payload: Partial<WorkshopPriceSignalRule>) => WorkshopPriceSignalRule;
}

export function runWorkshopSignalRuleMutation(
  payload: Partial<WorkshopPriceSignalRule>,
  deps: RunWorkshopSignalRuleMutationDeps,
): WorkshopState {
  const state = deps.readState();
  const nextRule = deps.mergeRule(state.signalRule, payload);
  return deps.writeState({
    ...state,
    version: deps.stateVersion,
    signalRule: nextRule,
  });
}
