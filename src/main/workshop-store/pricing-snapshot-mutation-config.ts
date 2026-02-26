import type { BuildWorkshopPriceSnapshotWithAnomalyDeps } from "./pricing-snapshot-create";
import type { ResolveWorkshopPriceSnapshotItemCategoryDeps } from "./pricing-snapshot-item";
import type { RunWorkshopPriceMutationDeps } from "./pricing-snapshot-mutation";

export interface WorkshopPriceSnapshotAddDeps {
  historyLimit: number;
  snapshotCreateDeps: Required<BuildWorkshopPriceSnapshotWithAnomalyDeps>;
  snapshotItemDeps: ResolveWorkshopPriceSnapshotItemCategoryDeps;
}

export interface WorkshopPriceSnapshotMutationContext {
  mutationDeps: RunWorkshopPriceMutationDeps;
  addDeps: WorkshopPriceSnapshotAddDeps;
}

export interface CreateWorkshopPriceSnapshotMutationContextInput {
  readState: RunWorkshopPriceMutationDeps["readState"];
  writeState: RunWorkshopPriceMutationDeps["writeState"];
  stateVersion: number;
  historyLimit: number;
  snapshotCreateDeps: Required<BuildWorkshopPriceSnapshotWithAnomalyDeps>;
  snapshotItemDeps: ResolveWorkshopPriceSnapshotItemCategoryDeps;
}

export function createWorkshopPriceSnapshotMutationContext(
  input: CreateWorkshopPriceSnapshotMutationContextInput,
): WorkshopPriceSnapshotMutationContext {
  return {
    mutationDeps: {
      readState: input.readState,
      writeState: input.writeState,
      stateVersion: input.stateVersion,
    },
    addDeps: {
      historyLimit: input.historyLimit,
      snapshotCreateDeps: input.snapshotCreateDeps,
      snapshotItemDeps: input.snapshotItemDeps,
    },
  };
}
