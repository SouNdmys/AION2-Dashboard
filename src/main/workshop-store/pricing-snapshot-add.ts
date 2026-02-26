import type { AddWorkshopPriceSnapshotInput, WorkshopPriceSnapshot, WorkshopState } from "../../shared/types";
import { appendWorkshopPriceSnapshot } from "./pricing-history-window";
import type { BuildWorkshopPriceSnapshotWithAnomalyDeps } from "./pricing-snapshot-create";
import { buildWorkshopPriceSnapshotWithAnomaly } from "./pricing-snapshot-create";
import type { ResolveWorkshopPriceSnapshotItemCategoryDeps } from "./pricing-snapshot-item";
import { resolveWorkshopPriceSnapshotItemCategory } from "./pricing-snapshot-item";

export interface BuildWorkshopPricesWithAddedSnapshotInput {
  state: WorkshopState;
  payload: AddWorkshopPriceSnapshotInput;
  historyLimit: number;
  snapshotCreateDeps: Required<BuildWorkshopPriceSnapshotWithAnomalyDeps>;
  snapshotItemDeps: ResolveWorkshopPriceSnapshotItemCategoryDeps;
}

export interface BuildWorkshopPricesWithAddedSnapshotDeps {
  resolveItemCategory: typeof resolveWorkshopPriceSnapshotItemCategory;
  buildSnapshot: typeof buildWorkshopPriceSnapshotWithAnomaly;
  appendSnapshot: typeof appendWorkshopPriceSnapshot;
}

const DEFAULT_DEPS: BuildWorkshopPricesWithAddedSnapshotDeps = {
  resolveItemCategory: resolveWorkshopPriceSnapshotItemCategory,
  buildSnapshot: buildWorkshopPriceSnapshotWithAnomaly,
  appendSnapshot: appendWorkshopPriceSnapshot,
};

export function buildWorkshopPricesWithAddedSnapshot(
  input: BuildWorkshopPricesWithAddedSnapshotInput,
  deps: BuildWorkshopPricesWithAddedSnapshotDeps = DEFAULT_DEPS,
): WorkshopPriceSnapshot[] {
  const itemCategory = deps.resolveItemCategory(input.state, input.payload.itemId, input.snapshotItemDeps);
  const nextSnapshot = deps.buildSnapshot(
    {
      payload: input.payload,
      prices: input.state.prices,
      itemCategory,
    },
    input.snapshotCreateDeps,
  );
  return deps.appendSnapshot(input.state.prices, nextSnapshot, input.historyLimit);
}
