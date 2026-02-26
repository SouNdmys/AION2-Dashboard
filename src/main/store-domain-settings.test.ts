import { describe, expect, it } from "vitest";
import { createDefaultCharacter, DEFAULT_SETTINGS } from "../shared/constants";
import { applyConfiguredActivityCaps, mergeAppSettings, normalizeAppSettings } from "./store-domain-settings";

describe("store/store-domain-settings", () => {
  it("normalizes invalid values with defaults and clamps bounds", () => {
    const normalized = normalizeAppSettings({
      expeditionGoldPerRun: -10,
      expeditionRunCap: 99_999,
      transcendenceWarnThreshold: 0,
      priorityWeightAode: 99,
    });

    expect(normalized.expeditionGoldPerRun).toBe(0);
    expect(normalized.expeditionRunCap).toBe(9_999);
    expect(normalized.transcendenceWarnThreshold).toBe(1);
    expect(normalized.priorityWeightAode).toBe(5);
    expect(normalized.priorityWeightMission).toBe(DEFAULT_SETTINGS.priorityWeightMission);
  });

  it("merges payload then re-normalizes settings", () => {
    const merged = mergeAppSettings(DEFAULT_SETTINGS, {
      priorityWeightWeekly: 0,
      nightmareRunCap: 2,
    });

    expect(merged.priorityWeightWeekly).toBe(1);
    expect(merged.nightmareRunCap).toBe(2);
  });

  it("applies configured activity caps to character counters", () => {
    const character = createDefaultCharacter("Tester", "2026-02-26T00:00:00.000Z", "char-1", "acc-1");
    character.activities.expeditionRemaining = 21;
    character.activities.nightmareRemaining = 14;
    character.activities.awakeningRemaining = 3;

    const capped = applyConfiguredActivityCaps(character, {
      ...DEFAULT_SETTINGS,
      expeditionRunCap: 5,
      nightmareRunCap: 2,
      awakeningRunCap: 1,
    });

    expect(capped.activities.expeditionRemaining).toBe(5);
    expect(capped.activities.nightmareRemaining).toBe(2);
    expect(capped.activities.awakeningRemaining).toBe(1);
  });
});
