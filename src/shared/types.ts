export type TaskActionKind = "complete_once" | "use_ticket" | "set_completed";
export type TaskId =
  | "expedition"
  | "transcendence"
  | "mini_game"
  | "spirit_invasion"
  | "sanctum_box"
  | "daily_mission"
  | "weekly_order"
  | "abyss_lower"
  | "abyss_middle"
  | "nightmare"
  | "awakening"
  | "suppression"
  | "daily_dungeon"
  | "sanctum_raid";

export interface EnergyState {
  baseCurrent: number;
  bonusCurrent: number;
  baseCap: number;
  bonusCap: number;
}

export interface MissionState {
  dailyRemaining: number;
  weeklyRemaining: number;
  abyssLowerRemaining: number;
  abyssMiddleRemaining: number;
}

export interface ActivityState {
  nightmareRemaining: number;
  nightmareTicketBonus: number;
  awakeningRemaining: number;
  awakeningTicketBonus: number;
  suppressionRemaining: number;
  suppressionTicketBonus: number;
  dailyDungeonRemaining: number;
  dailyDungeonTicketStored: number;
  expeditionRemaining: number;
  expeditionTicketBonus: number;
  expeditionBossRemaining: number;
  transcendenceRemaining: number;
  transcendenceTicketBonus: number;
  transcendenceBossRemaining: number;
  sanctumRaidRemaining: number;
  sanctumBoxRemaining: number;
  miniGameRemaining: number;
  miniGameTicketBonus: number;
  spiritInvasionRemaining: number;
  corridorLowerAvailable: number;
  corridorLowerNextAt: string | null;
  corridorMiddleAvailable: number;
  corridorMiddleNextAt: string | null;
}

export interface ProgressMeta {
  lastSyncedAt: string;
}

export type MissionCounterKey = keyof MissionState;
export type ActivityCounterKey =
  | "nightmareRemaining"
  | "awakeningRemaining"
  | "suppressionRemaining"
  | "dailyDungeonRemaining"
  | "expeditionRemaining"
  | "expeditionBossRemaining"
  | "transcendenceRemaining"
  | "transcendenceBossRemaining"
  | "sanctumRaidRemaining"
  | "sanctumBoxRemaining"
  | "miniGameRemaining"
  | "spiritInvasionRemaining";

export type ActivityTicketKey =
  | "nightmareTicketBonus"
  | "awakeningTicketBonus"
  | "suppressionTicketBonus"
  | "dailyDungeonTicketStored"
  | "miniGameTicketBonus"
  | "expeditionTicketBonus"
  | "transcendenceTicketBonus";

export interface AccountState {
  id: string;
  name: string;
  regionTag?: string;
  extraAodeCharacterId?: string;
}

export interface AodeEnergyPlanState {
  shopAodePurchaseUsed: number;
  shopDailyDungeonTicketPurchaseUsed: number;
  transformAodeUsed: number;
}

export interface WeeklyStats {
  cycleStartedAt: string;
  goldEarned: number;
  completions: Record<TaskId, number>;
}

export interface CharacterState {
  id: string;
  accountId: string;
  name: string;
  classTag?: string;
  avatarSeed: string;
  energy: EnergyState;
  aodePlan: AodeEnergyPlanState;
  missions: MissionState;
  activities: ActivityState;
  stats: WeeklyStats;
  meta: ProgressMeta;
}

export interface AppSettings {
  expeditionGoldPerRun: number;
  transcendenceGoldPerRun: number;
  expeditionRunCap: number | null;
  transcendenceRunCap: number | null;
  nightmareRunCap: number | null;
  awakeningRunCap: number | null;
  suppressionRunCap: number | null;
  expeditionWarnThreshold: number;
  transcendenceWarnThreshold: number;
}

export interface AppStateSnapshot {
  selectedAccountId: string | null;
  selectedCharacterId: string | null;
  settings: AppSettings;
  accounts: AccountState[];
  characters: CharacterState[];
}

export interface OperationLogEntry {
  id: string;
  at: string;
  action: string;
  characterId: string | null;
  description?: string;
  before: AppStateSnapshot;
}

export interface ExportDataResult {
  cancelled: boolean;
  path: string | null;
}

export interface ImportDataResult {
  cancelled: boolean;
  path: string | null;
  state: AppState | null;
}

export interface AppBuildInfo {
  version: string;
  buildTime: string;
  author: string;
}

export type WorkshopItemCategory = "material" | "equipment" | "component" | "other";
export type WorkshopPriceSource = "manual" | "import";
export type WorkshopPriceMarket = "single" | "server" | "world";

export interface WorkshopItem {
  id: string;
  name: string;
  category: WorkshopItemCategory;
  icon?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopRecipeInput {
  itemId: string;
  quantity: number;
}

export interface WorkshopRecipe {
  id: string;
  outputItemId: string;
  outputQuantity: number;
  inputs: WorkshopRecipeInput[];
  updatedAt: string;
}

export interface WorkshopPriceSnapshot {
  id: string;
  itemId: string;
  unitPrice: number;
  capturedAt: string;
  source: WorkshopPriceSource;
  market?: WorkshopPriceMarket;
  note?: string;
}

export interface WorkshopPriceHistoryQuery {
  itemId: string;
  fromAt?: string;
  toAt?: string;
  days?: number;
  includeSuspect?: boolean;
  market?: WorkshopPriceMarket;
}

export interface WorkshopPriceHistoryPoint {
  id: string;
  itemId: string;
  unitPrice: number;
  capturedAt: string;
  weekday: number;
  ma7: number | null;
  market?: WorkshopPriceMarket;
  note?: string;
  isSuspect: boolean;
  suspectReason?: string;
}

export interface WorkshopWeekdayAverage {
  weekday: number;
  averagePrice: number | null;
  sampleCount: number;
}

export interface WorkshopPriceHistoryResult {
  itemId: string;
  market?: WorkshopPriceMarket;
  fromAt: string;
  toAt: string;
  sampleCount: number;
  suspectCount: number;
  latestPrice: number | null;
  latestCapturedAt: string | null;
  averagePrice: number | null;
  ma7Latest: number | null;
  points: WorkshopPriceHistoryPoint[];
  suspectPoints: WorkshopPriceHistoryPoint[];
  weekdayAverages: WorkshopWeekdayAverage[];
}

export interface WorkshopPriceSignalRule {
  enabled: boolean;
  lookbackDays: number;
  dropBelowWeekdayAverageRatio: number;
}

export interface WorkshopPriceSignalQuery {
  lookbackDays?: number;
  thresholdRatio?: number;
  market?: WorkshopPriceMarket;
}

export type WorkshopPriceTrendTag = "buy-zone" | "sell-zone" | "watch";

export interface WorkshopPriceSignalRow {
  itemId: string;
  itemName: string;
  market?: WorkshopPriceMarket;
  latestPrice: number | null;
  latestCapturedAt: string | null;
  latestWeekday: number | null;
  weekdayAveragePrice: number | null;
  deviationRatioFromWeekdayAverage: number | null;
  ma7Price: number | null;
  deviationRatioFromMa7: number | null;
  effectiveThresholdRatio: number;
  trendTag: WorkshopPriceTrendTag;
  confidenceScore: number;
  reasons: string[];
  sampleCount: number;
  triggered: boolean;
}

export interface WorkshopPriceSignalResult {
  generatedAt: string;
  market?: WorkshopPriceMarket;
  lookbackDays: number;
  thresholdRatio: number;
  effectiveThresholdRatio: number;
  ruleEnabled: boolean;
  triggeredCount: number;
  buyZoneCount: number;
  sellZoneCount: number;
  rows: WorkshopPriceSignalRow[];
}

export interface WorkshopOcrIconCaptureConfig {
  screenshotPath: string;
  firstRowTop: number;
  rowHeight: number;
  nameAnchorX: number;
  iconOffsetX: number;
  iconTopOffset: number;
  iconWidth: number;
  iconHeight: number;
}

export interface WorkshopOcrExtractTextInput {
  imagePath: string;
  language?: string;
  psm?: number;
  safeMode?: boolean;
  tradeBoardPreset?: WorkshopTradeBoardPreset | null;
}

export interface WorkshopOcrExtractTextResult {
  rawText: string;
  text: string;
  lineCount: number;
  warnings: string[];
  engine: string;
  tradeRows?: WorkshopOcrTradeRow[];
}

export type WorkshopOcrIconCaptureTemplate = Omit<WorkshopOcrIconCaptureConfig, "screenshotPath">;

export interface WorkshopOcrImportedEntry {
  lineNumber: number;
  itemId: string;
  itemName: string;
  unitPrice: number;
  market?: WorkshopPriceMarket;
  capturedAt: string;
  source: WorkshopPriceSource;
  createdItem: boolean;
}

export interface WorkshopOcrTradeRow {
  lineNumber: number;
  itemName: string;
  serverPrice: number | null;
  worldPrice: number | null;
}

export interface WorkshopOcrHotkeyConfig {
  enabled: boolean;
  shortcut: string;
  language?: string;
  psm?: number;
  safeMode?: boolean;
  captureDelayMs?: number;
  hideAppBeforeCapture?: boolean;
  autoCreateMissingItems?: boolean;
  defaultCategory?: WorkshopItemCategory;
  iconCapture?: WorkshopOcrIconCaptureTemplate | null;
  strictIconMatch?: boolean;
  tradeBoardPreset?: WorkshopTradeBoardPreset | null;
}

export interface WorkshopOcrHotkeyRunResult {
  at: string;
  success: boolean;
  message: string;
  screenshotPath: string | null;
  extractedLineCount: number;
  expectedLineCount?: number | null;
  importedCount: number;
  duplicateSkippedCount?: number;
  createdItemCount: number;
  unknownItemCount: number;
  invalidLineCount: number;
  iconCapturedCount: number;
  iconSkippedCount: number;
  warnings: string[];
  importedEntries: WorkshopOcrImportedEntry[];
}

export interface WorkshopOcrHotkeyState {
  enabled: boolean;
  registered: boolean;
  shortcut: string;
  language: string;
  psm: number;
  safeMode: boolean;
  autoCreateMissingItems: boolean;
  defaultCategory: WorkshopItemCategory;
  iconCaptureEnabled: boolean;
  strictIconMatch: boolean;
  lastResult: WorkshopOcrHotkeyRunResult | null;
}

export interface WorkshopOcrAutoRunConfig {
  enabled: boolean;
  intervalSeconds?: number;
  showOverlay?: boolean;
  safeMode?: boolean;
  captureDelayMs?: number;
  hideAppBeforeCapture?: boolean;
  maxConsecutiveFailures?: number;
  tradeBoardPreset?: WorkshopTradeBoardPreset | null;
}

export interface WorkshopOcrAutoRunState {
  enabled: boolean;
  running: boolean;
  intervalSeconds: number;
  showOverlay: boolean;
  toggleShortcut: string;
  maxConsecutiveFailures: number;
  consecutiveFailureCount: number;
  startedAt: string | null;
  nextRunAt: string | null;
  loopCount: number;
  successCount: number;
  failureCount: number;
  lastResultAt: string | null;
  lastMessage: string | null;
}

export interface WorkshopScreenPreviewResult {
  capturedAt: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface WorkshopScreenCaptureOptions {
  delayMs?: number;
  hideAppBeforeCapture?: boolean;
}

export interface WorkshopRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkshopTradeBoardPreset {
  enabled: boolean;
  rowCount: number;
  namesRect: WorkshopRect;
  pricesRect: WorkshopRect;
  priceMode?: "single" | "dual";
  priceColumn: "left" | "right";
  leftPriceRole?: "server" | "world";
  rightPriceRole?: "server" | "world";
}

export interface WorkshopOcrPriceImportInput {
  text: string;
  tradeRows?: WorkshopOcrTradeRow[];
  capturedAt?: string;
  source?: WorkshopPriceSource;
  dedupeWithinSeconds?: number;
  autoCreateMissingItems?: boolean;
  defaultCategory?: WorkshopItemCategory;
  iconCapture?: WorkshopOcrIconCaptureConfig;
  strictIconMatch?: boolean;
}

export interface WorkshopOcrPriceImportResult {
  state: WorkshopState;
  importedCount: number;
  duplicateSkippedCount: number;
  createdItemCount: number;
  parsedLineCount: number;
  unknownItemNames: string[];
  invalidLines: string[];
  iconCapturedCount: number;
  iconSkippedCount: number;
  iconCaptureWarnings: string[];
  importedEntries: WorkshopOcrImportedEntry[];
}

export interface WorkshopCatalogImportFromFileInput {
  filePath: string;
}

export interface WorkshopCatalogImportResult {
  state: WorkshopState;
  importedItemCount: number;
  importedRecipeCount: number;
  createdImplicitItemCount: number;
  skippedRecipeCount: number;
  warnings: string[];
}

export interface WorkshopInventoryItem {
  itemId: string;
  quantity: number;
  updatedAt: string;
}

export interface WorkshopState {
  version: number;
  items: WorkshopItem[];
  recipes: WorkshopRecipe[];
  prices: WorkshopPriceSnapshot[];
  inventory: WorkshopInventoryItem[];
  signalRule: WorkshopPriceSignalRule;
}

export interface UpsertWorkshopItemInput {
  id?: string;
  name: string;
  category?: WorkshopItemCategory;
  icon?: string;
  notes?: string;
}

export interface UpsertWorkshopRecipeInput {
  id?: string;
  outputItemId: string;
  outputQuantity: number;
  inputs: WorkshopRecipeInput[];
}

export interface AddWorkshopPriceSnapshotInput {
  itemId: string;
  unitPrice: number;
  capturedAt?: string;
  source?: WorkshopPriceSource;
  market?: WorkshopPriceMarket;
  note?: string;
}

export interface UpsertWorkshopInventoryInput {
  itemId: string;
  quantity: number;
}

export interface WorkshopSimulationMaterialRow {
  itemId: string;
  itemName: string;
  required: number;
  owned: number;
  missing: number;
  latestUnitPrice: number | null;
  latestPriceMarket?: WorkshopPriceMarket;
  requiredCost: number | null;
  missingCost: number | null;
}

export interface WorkshopSimulationCraftStep {
  itemId: string;
  itemName: string;
  runs: number;
}

export interface WorkshopCraftSimulationInput {
  recipeId: string;
  runs: number;
  taxRate?: number;
  materialMode?: "expanded" | "direct";
}

export interface WorkshopCraftSimulationResult {
  recipeId: string;
  outputItemId: string;
  outputItemName: string;
  outputQuantity: number;
  runs: number;
  totalOutputQuantity: number;
  taxRate: number;
  materialMode: "expanded" | "direct";
  materialRows: WorkshopSimulationMaterialRow[];
  craftSteps: WorkshopSimulationCraftStep[];
  craftableNow: boolean;
  unknownPriceItemIds: string[];
  requiredMaterialCost: number | null;
  missingPurchaseCost: number | null;
  outputUnitPrice: number | null;
  grossRevenue: number | null;
  netRevenueAfterTax: number | null;
  estimatedProfit: number | null;
  estimatedProfitRate: number | null;
}

export interface WorkshopCraftOption {
  recipeId: string;
  outputItemId: string;
  outputItemName: string;
  craftableCount: number;
  requiredMaterialCostPerRun: number | null;
  estimatedProfitPerRun: number | null;
  unknownPriceItemIds: string[];
  materialRowsForOneRun: WorkshopSimulationMaterialRow[];
  missingRowsForOneRun: WorkshopSimulationMaterialRow[];
}

export interface AppState {
  version: number;
  selectedAccountId: string | null;
  selectedCharacterId: string | null;
  settings: AppSettings;
  accounts: AccountState[];
  characters: CharacterState[];
  history: OperationLogEntry[];
}

export interface TaskCounterTarget {
  scope: "missions" | "activities";
  key: MissionCounterKey | ActivityCounterKey;
  decrement?: number;
}

export interface TaskTicketTarget {
  key: ActivityTicketKey;
  increment?: number;
}

export interface TaskDefinition {
  id: TaskId;
  title: string;
  description: string;
  category: "副本" | "使命" | "周常";
  energyCost: number;
  goldReward: number;
  goldRewardSettingKey?: "expeditionGoldPerRun" | "transcendenceGoldPerRun";
  counterTargets: TaskCounterTarget[];
  allowComplete: boolean;
  allowUseTicket: boolean;
  allowSetCompleted: boolean;
  setCompletedTotal?: number;
  ticketTarget?: TaskTicketTarget;
  baseCapDisplay?: number;
  useBonusDisplay?: boolean;
  consumeTicketFirst?: boolean;
}

export interface ApplyTaskActionInput {
  characterId: string;
  taskId: TaskId;
  action: TaskActionKind;
  amount?: number;
}

export interface CharacterSummary {
  characterId: string;
  name: string;
  canRunExpedition: boolean;
  estimatedGoldIfClearEnergy: number;
  weeklyGoldEarned: number;
  hasDailyMissionLeft: boolean;
  hasWeeklyMissionLeft: boolean;
  canRunNightmare: boolean;
  canRunAwakening: boolean;
  canRunSuppression: boolean;
  pendingLabels: string[];
}
