import type { WorkshopPriceSnapshot, WorkshopState } from "../../shared/types";

export interface RunWorkshopPriceMutationDeps {
  readState: () => WorkshopState;
  writeState: (next: WorkshopState) => WorkshopState;
  stateVersion: number;
}

export function runWorkshopPriceMutation(
  buildNextPrices: (state: WorkshopState) => WorkshopPriceSnapshot[] | null,
  deps: RunWorkshopPriceMutationDeps,
): WorkshopState {
  const state = deps.readState();
  const nextPrices = buildNextPrices(state);
  if (nextPrices === null) {
    return state;
  }
  return deps.writeState({
    ...state,
    version: deps.stateVersion,
    prices: nextPrices,
  });
}
