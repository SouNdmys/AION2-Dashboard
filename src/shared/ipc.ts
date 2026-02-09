export const IPC_CHANNELS = {
  getState: "app:get-state",
  resetWeeklyStats: "app:reset-weekly-stats",
  addCharacter: "character:add",
  renameCharacter: "character:rename",
  deleteCharacter: "character:delete",
  selectCharacter: "character:select",
  applyTaskAction: "task:apply-action",
  updateArtifactStatus: "character:update-artifact",
  updateEnergySegments: "character:update-energy-segments",
  updateRaidCounts: "character:update-raid-counts",
} as const;
