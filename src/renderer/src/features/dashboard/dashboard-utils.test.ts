import { describe, expect, it } from "vitest";
import { TASK_DEFINITIONS } from "../../../../shared/constants";
import { getQuickActionsForTask } from "./dashboard-utils";

describe("dashboard-utils", () => {
  it("offers incremental quick entry before direct set-completed for daily mission", () => {
    const task = TASK_DEFINITIONS.find((item) => item.id === "daily_mission");
    expect(task).toBeTruthy();
    expect(getQuickActionsForTask(task!)).toEqual(["complete_once", "set_completed"]);
  });
});
