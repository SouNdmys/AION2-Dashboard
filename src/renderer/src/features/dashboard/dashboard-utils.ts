import {
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  AODE_WEEKLY_EXTRA_CONVERT_MAX,
  AODE_WEEKLY_EXTRA_PURCHASE_MAX,
} from "../../../../shared/constants";
import type { AppSettings, AppState, TaskActionKind, TaskDefinition } from "../../../../shared/types";
import type { CorridorDraft, PriorityTone, PriorityWeightKey, SettingsDraft } from "./dashboard-types";

const numberFormatter = new Intl.NumberFormat("zh-CN");

export function getQuickActionsForTask(task: TaskDefinition): TaskActionKind[] {
  if (task.allowSetCompleted) {
    return ["set_completed"];
  }
  const actions: TaskActionKind[] = [];
  if (task.allowComplete) {
    actions.push("complete_once");
  }
  if (task.allowUseTicket) {
    actions.push("use_ticket");
  }
  return actions;
}

export function getPriorityWeightLevel(settings: AppSettings, key: PriorityWeightKey): number {
  if (key === "aode") return settings.priorityWeightAode;
  if (key === "sanctum") return settings.priorityWeightSanctum;
  if (key === "corridor") return settings.priorityWeightCorridor;
  if (key === "dungeon") return settings.priorityWeightDungeon;
  if (key === "weekly") return settings.priorityWeightWeekly;
  if (key === "mission") return settings.priorityWeightMission;
  return settings.priorityWeightLeisure;
}

export function getPriorityWeightFactor(level: number): number {
  if (level <= 1) return 0.7;
  if (level === 2) return 0.85;
  if (level === 3) return 1;
  if (level === 4) return 1.2;
  return 1.45;
}

export function toGoldText(value: number): string {
  const wanValue = value / 10_000;
  const text = Number.isInteger(wanValue) ? numberFormatter.format(wanValue) : wanValue.toFixed(1);
  return `${text} 万金币`;
}

export function toInt(raw: string): number | null {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function toNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseOptionalCap(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = toInt(trimmed);
  if (value === null || value <= 0) {
    return "invalid";
  }
  return value;
}

export function buildSettingsDraft(settings: AppSettings): SettingsDraft {
  return {
    expeditionGoldPerRun: String(settings.expeditionGoldPerRun / 10_000),
    transcendenceGoldPerRun: String(settings.transcendenceGoldPerRun / 10_000),
    expeditionRunCap: settings.expeditionRunCap === null ? "" : String(settings.expeditionRunCap),
    transcendenceRunCap: settings.transcendenceRunCap === null ? "" : String(settings.transcendenceRunCap),
    nightmareRunCap: settings.nightmareRunCap === null ? "" : String(settings.nightmareRunCap),
    awakeningRunCap: settings.awakeningRunCap === null ? "" : String(settings.awakeningRunCap),
    suppressionRunCap: settings.suppressionRunCap === null ? "" : String(settings.suppressionRunCap),
    expeditionWarnThreshold: String(settings.expeditionWarnThreshold),
    transcendenceWarnThreshold: String(settings.transcendenceWarnThreshold),
    priorityWeightAode: String(settings.priorityWeightAode),
    priorityWeightSanctum: String(settings.priorityWeightSanctum),
    priorityWeightCorridor: String(settings.priorityWeightCorridor),
    priorityWeightDungeon: String(settings.priorityWeightDungeon),
    priorityWeightWeekly: String(settings.priorityWeightWeekly),
    priorityWeightMission: String(settings.priorityWeightMission),
    priorityWeightLeisure: String(settings.priorityWeightLeisure),
  };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "00:00:00";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getCharacterAodeLimits(state: AppState, characterId: string): { purchaseLimit: number; convertLimit: number } {
  const character = state.characters.find((item) => item.id === characterId);
  if (!character) {
    return {
      purchaseLimit: AODE_WEEKLY_BASE_PURCHASE_MAX,
      convertLimit: AODE_WEEKLY_BASE_CONVERT_MAX,
    };
  }
  const account = state.accounts.find((item) => item.id === character.accountId);
  const isExtra = account?.extraAodeCharacterId === character.id;
  return {
    purchaseLimit: AODE_WEEKLY_BASE_PURCHASE_MAX + (isExtra ? AODE_WEEKLY_EXTRA_PURCHASE_MAX : 0),
    convertLimit: AODE_WEEKLY_BASE_CONVERT_MAX + (isExtra ? AODE_WEEKLY_EXTRA_CONVERT_MAX : 0),
  };
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatBuildTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("zh-CN");
}

export function buildCorridorDraft(lowerAvailable: number, middleAvailable: number): CorridorDraft {
  return {
    lowerAvailable: String(lowerAvailable),
    middleAvailable: String(middleAvailable),
    completeLane: "lower",
    completeAmount: "1",
  };
}

export function formatCounter(current: number, total: number): string {
  const safeCurrent = Math.max(0, Math.floor(current));
  const safeTotal = Math.max(0, Math.floor(total));
  return `${safeCurrent}/${safeTotal}`;
}

export function getBoardToneClass(current: number, total: number): string {
  if (current <= 0) {
    return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  }
  const ratio = total > 0 ? current / total : 0;
  if (ratio >= 0.5) {
    return "border-cyan-300/45 bg-cyan-400/15 text-cyan-100";
  }
  return "border-amber-300/45 bg-amber-400/15 text-amber-100";
}

export function getUrgentBoardToneClass(current: number, total: number, urgent: boolean): string {
  if (urgent && current > 0) {
    return "border-rose-300/55 bg-rose-500/20 text-rose-100";
  }
  return getBoardToneClass(current, total);
}

export function getPriorityToneClass(tone: PriorityTone): string {
  if (tone === "high") {
    return "border-rose-300/45 bg-rose-400/15 text-rose-100";
  }
  if (tone === "medium") {
    return "border-amber-300/45 bg-amber-400/15 text-amber-100";
  }
  return "border-cyan-300/45 bg-cyan-400/15 text-cyan-100";
}

export function buildCountOptions(min: number, max: number, currentValue?: string): string[] {
  let safeMin = Math.max(0, Math.floor(min));
  let safeMax = Math.max(safeMin, Math.floor(max));
  const current = currentValue === undefined ? null : toInt(currentValue);
  if (current !== null && current > safeMax) {
    safeMax = current;
  }
  if (current !== null && current < safeMin) {
    safeMin = current;
  }
  return Array.from({ length: safeMax - safeMin + 1 }, (_, index) => String(safeMin + index));
}

export function computePriorityScore(baseScore: number, settings: AppSettings, key: PriorityWeightKey): number {
  return baseScore * getPriorityWeightFactor(getPriorityWeightLevel(settings, key));
}
