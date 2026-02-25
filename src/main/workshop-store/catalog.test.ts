import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopState } from "../../shared/types";

const {
  mockReadFileSync,
  mockResolveCatalogImportFilePath,
  mockParseCatalogCsvText,
  mockReadWorkshopState,
  mockWriteWorkshopState,
  mockEnsureItemExists,
  mockToPositiveInt,
  mockNormalizeRecipeInputs,
  mockNormalizeIconCache,
  mockResolveItemIconWithCache,
  mockApplyCatalogData,
  mockStoreGet,
} = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockResolveCatalogImportFilePath: vi.fn(),
  mockParseCatalogCsvText: vi.fn(),
  mockReadWorkshopState: vi.fn(),
  mockWriteWorkshopState: vi.fn(),
  mockEnsureItemExists: vi.fn(),
  mockToPositiveInt: vi.fn(),
  mockNormalizeRecipeInputs: vi.fn(),
  mockNormalizeIconCache: vi.fn(),
  mockResolveItemIconWithCache: vi.fn(),
  mockApplyCatalogData: vi.fn(),
  mockStoreGet: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: { readFileSync: mockReadFileSync },
}));

vi.mock("./catalog-import-shared", () => ({
  resolveCatalogImportFilePath: mockResolveCatalogImportFilePath,
  parseCatalogCsvText: mockParseCatalogCsvText,
  normalizeCatalogLookupName: (name: string) => String(name).trim().toLocaleLowerCase().replace(/\s+/g, ""),
}));

vi.mock("./catalog-import-apply", () => ({
  applyCatalogData: mockApplyCatalogData,
}));

vi.mock("../workshop-store-core", () => ({
  WORKSHOP_ICON_CACHE_KEY: "iconCache",
  WORKSHOP_STATE_VERSION: 6,
  readWorkshopState: mockReadWorkshopState,
  writeWorkshopState: mockWriteWorkshopState,
  ensureItemExists: mockEnsureItemExists,
  toPositiveInt: mockToPositiveInt,
  normalizeRecipeInputs: mockNormalizeRecipeInputs,
  normalizeIconCache: mockNormalizeIconCache,
  resolveItemIconWithCache: mockResolveItemIconWithCache,
  workshopStore: { get: mockStoreGet },
}));

import {
  deleteWorkshopItem,
  importWorkshopCatalogFromFile,
  upsertWorkshopItem,
  upsertWorkshopRecipe,
} from "./catalog";

function createState(): WorkshopState {
  return {
    version: 6,
    items: [
      { id: "a", name: "A", category: "material", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", name: "B", category: "material", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    recipes: [
      {
        id: "r1",
        outputItemId: "a",
        outputQuantity: 1,
        inputs: [{ itemId: "b", quantity: 2 }],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    prices: [{ id: "p1", itemId: "a", unitPrice: 100, capturedAt: "2026-01-01T00:00:00.000Z", source: "manual" }],
    inventory: [{ itemId: "a", quantity: 3, updatedAt: "2026-01-01T00:00:00.000Z" }],
    signalRule: { enabled: true, lookbackDays: 30, dropBelowWeekdayAverageRatio: 0.15 },
  };
}

describe("workshop/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteWorkshopState.mockImplementation((next) => next);
    mockToPositiveInt.mockImplementation((value: number) => Math.floor(value));
    mockNormalizeRecipeInputs.mockImplementation((inputs) => inputs);
    mockNormalizeIconCache.mockReturnValue(new Map());
    mockResolveItemIconWithCache.mockReturnValue("icon-default");
    mockStoreGet.mockReturnValue({});
    mockResolveCatalogImportFilePath.mockReturnValue("C:/tmp/catalog.csv");
    mockReadFileSync.mockReturnValue("csv");
    mockParseCatalogCsvText.mockReturnValue({ items: [], recipes: [], warnings: [] });
  });

  it("upsertWorkshopItem rejects duplicate names case-insensitively", () => {
    mockReadWorkshopState.mockReturnValue(createState());
    expect(() => upsertWorkshopItem({ id: "a", name: "b" })).toThrow("物品名称重复");
  });

  it("deleteWorkshopItem cascades to recipes/prices/inventory", () => {
    mockReadWorkshopState.mockReturnValue(createState());

    const next = deleteWorkshopItem("a");

    expect(next.items.map((item) => item.id)).toEqual(["b"]);
    expect(next.recipes).toHaveLength(0);
    expect(next.prices).toHaveLength(0);
    expect(next.inventory).toHaveLength(0);
  });

  it("upsertWorkshopRecipe rejects output item in recipe inputs", () => {
    const state = createState();
    mockReadWorkshopState.mockReturnValue(state);
    mockNormalizeRecipeInputs.mockReturnValue([{ itemId: "a", quantity: 1 }]);

    expect(() =>
      upsertWorkshopRecipe({
        outputItemId: "a",
        outputQuantity: 1,
        inputs: [{ itemId: "a", quantity: 1 }],
      }),
    ).toThrow("配方输入不能包含成品本身");
  });

  it("importWorkshopCatalogFromFile parses file and writes imported state", () => {
    const state = createState();
    mockReadWorkshopState.mockReturnValue(state);
    const applied = {
      state,
      importedItemCount: 1,
      importedRecipeCount: 1,
      createdImplicitItemCount: 0,
      skippedRecipeCount: 0,
      warnings: [],
    };
    mockApplyCatalogData.mockReturnValue(applied);

    const result = importWorkshopCatalogFromFile({ filePath: "./catalog.csv" });

    expect(mockResolveCatalogImportFilePath).toHaveBeenCalledWith("./catalog.csv");
    expect(mockParseCatalogCsvText).toHaveBeenCalledWith("csv");
    expect(mockApplyCatalogData).toHaveBeenCalledWith(
      state,
      { items: [], recipes: [], warnings: [] },
      "catalog.csv",
      expect.objectContaining({
        stateVersion: 6,
        loadIconCache: expect.any(Function),
        resolveItemIconWithCache: expect.any(Function),
        cacheIconByName: expect.any(Function),
        normalizeState: expect.any(Function),
      }),
    );
    expect(mockWriteWorkshopState).toHaveBeenCalledWith(state);
    expect(result.state).toBe(state);
  });
});
