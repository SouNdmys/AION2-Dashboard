import type { WorkshopPriceHistoryQuery, WorkshopPriceHistoryResult, WorkshopState } from "../../shared/types";

export interface GetWorkshopPriceHistoryDeps {
  readState: () => WorkshopState;
  ensureItemExists: (state: WorkshopState, itemId: string) => void;
  buildHistoryResult: (state: WorkshopState, payload: WorkshopPriceHistoryQuery) => WorkshopPriceHistoryResult;
}

export function getWorkshopPriceHistoryByQuery(
  payload: WorkshopPriceHistoryQuery,
  deps: GetWorkshopPriceHistoryDeps,
): WorkshopPriceHistoryResult {
  const state = deps.readState();
  deps.ensureItemExists(state, payload.itemId);
  return deps.buildHistoryResult(state, payload);
}
