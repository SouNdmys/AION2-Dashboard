import type { WorkshopCraftOption, WorkshopPriceMarket } from "../../../../../shared/types";
import {
  formatDateTime,
  formatGold,
  toPercent,
  type ClassifiedItemOption,
  type LatestPriceMetaByMarket,
  type ReverseCraftSuggestionRow,
  type ReverseScoreMode,
} from "../workshop-view-helpers";

interface WorkshopInventoryPanelProps {
  busy: boolean;
  loadCraftOptions: () => Promise<void>;
  itemKeyword: string;
  setItemKeyword: (value: string) => void;
  itemMainCategory: string;
  setItemMainCategory: (value: string) => void;
  itemMainCategoryOptions: string[];
  itemSubCategory: "all" | string;
  setItemSubCategory: (value: "all" | string) => void;
  itemSubCategoryOptions: string[];
  selectedItemId: string;
  setSelectedItemId: (value: string) => void;
  filteredItems: ClassifiedItemOption[];
  selectedItemPriceMarket: "server" | "world";
  setSelectedItemPriceMarket: (value: "server" | "world") => void;
  selectedItemPrice: string;
  setSelectedItemPrice: (value: string) => void;
  selectedItemInventory: string;
  setSelectedItemInventory: (value: string) => void;
  onSaveSelectedPrice: () => void;
  onSaveSelectedInventory: () => void;
  latestPriceMetaByItemId: Map<string, LatestPriceMetaByMarket>;
  inventoryByItemId: Map<string, number>;
  onPickItemForCorrection: (itemId: string) => void;
  reverseMaterialKeyword: string;
  setReverseMaterialKeyword: (value: string) => void;
  reverseFocusMaterialId: string;
  setReverseFocusMaterialId: (value: string) => void;
  reverseMaterialOptions: ClassifiedItemOption[];
  reverseCraftBudgetInput: string;
  setReverseCraftBudgetInput: (value: string) => void;
  reverseScoreMode: ReverseScoreMode;
  setReverseScoreMode: (value: ReverseScoreMode) => void;
  reverseFocusMaterialName: string | null;
  reverseCraftBudget: number;
  reverseScoreModeLabel: string;
  craftOptions: WorkshopCraftOption[];
  reverseCraftSuggestions: ReverseCraftSuggestionRow[];
  isStarredItem: (itemId: string) => boolean;
  onToggleStarItem: (itemId: string) => void;
  onViewHistoryCurveForItem: (itemId: string, options?: { scroll?: boolean; market?: WorkshopPriceMarket }) => void;
  onJumpSimulationRecipe: (recipeId: string) => void;
}

export function WorkshopInventoryPanel(props: WorkshopInventoryPanelProps): JSX.Element {
  const {
    busy,
    loadCraftOptions,
    itemKeyword,
    setItemKeyword,
    itemMainCategory,
    setItemMainCategory,
    itemMainCategoryOptions,
    itemSubCategory,
    setItemSubCategory,
    itemSubCategoryOptions,
    selectedItemId,
    setSelectedItemId,
    filteredItems,
    selectedItemPriceMarket,
    setSelectedItemPriceMarket,
    selectedItemPrice,
    setSelectedItemPrice,
    selectedItemInventory,
    setSelectedItemInventory,
    onSaveSelectedPrice,
    onSaveSelectedInventory,
    latestPriceMetaByItemId,
    inventoryByItemId,
    onPickItemForCorrection,
    reverseMaterialKeyword,
    setReverseMaterialKeyword,
    reverseFocusMaterialId,
    setReverseFocusMaterialId,
    reverseMaterialOptions,
    reverseCraftBudgetInput,
    setReverseCraftBudgetInput,
    reverseScoreMode,
    setReverseScoreMode,
    reverseFocusMaterialName,
    reverseCraftBudget,
    reverseScoreModeLabel,
    craftOptions,
    reverseCraftSuggestions,
    isStarredItem,
    onToggleStarItem,
    onViewHistoryCurveForItem,
    onJumpSimulationRecipe,
  } = props;

  return (
      <article className="order-4 glass-panel rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">库存管理</h4>
          <button className="pill-btn" onClick={() => void loadCraftOptions()} disabled={busy}>
            刷新建议
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemKeyword}
              onChange={(event) => setItemKeyword(event.target.value)}
              disabled={busy}
              placeholder="搜索物品名（全局）"
            />
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemMainCategory}
              onChange={(event) => setItemMainCategory(event.target.value)}
              disabled={busy || itemMainCategoryOptions.length === 0}
            >
              {itemMainCategoryOptions.map((category) => (
                <option key={`item-main-category-${category}`} value={category}>
                  大类: {category}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemSubCategory}
              onChange={(event) => setItemSubCategory(event.target.value)}
              disabled={busy}
            >
              <option value="all">下级分类: 全部</option>
              {itemSubCategoryOptions.map((category) => (
                <option key={`item-sub-category-${category}`} value={category}>
                  下级分类: {category}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
              disabled={busy || filteredItems.length === 0}
            >
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.subCategory}] {item.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-300">提示：输入关键词后，将在全物品范围搜索并忽略大类/下级分类筛选。</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={selectedItemPriceMarket}
              onChange={(event) => setSelectedItemPriceMarket(event.target.value as "server" | "world")}
              disabled={busy || !selectedItemId}
            >
              <option value="server">价格市场: 伺服器</option>
              <option value="world">价格市场: 世界</option>
            </select>
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="录入价格"
              value={selectedItemPrice}
              onChange={(event) => setSelectedItemPrice(event.target.value)}
              disabled={busy || !selectedItemId}
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="库存数量"
              value={selectedItemInventory}
              onChange={(event) => setSelectedItemInventory(event.target.value)}
              disabled={busy || !selectedItemId}
            />
            <div className="flex gap-2">
              <button className="task-btn px-3" onClick={onSaveSelectedPrice} disabled={busy || !selectedItemId}>
                记价格
              </button>
              <button className="task-btn px-3" onClick={onSaveSelectedInventory} disabled={busy || !selectedItemId}>
                记库存
              </button>
            </div>
          </div>
          {selectedItemId ? (
            <p className="mt-2 text-xs text-slate-300">
              当前值: 伺服器 {formatGold(latestPriceMetaByItemId.get(selectedItemId)?.server?.price ?? null)}（
              {formatDateTime(latestPriceMetaByItemId.get(selectedItemId)?.server?.capturedAt ?? null)}） / 世界{" "}
              {formatGold(latestPriceMetaByItemId.get(selectedItemId)?.world?.price ?? null)}（
              {formatDateTime(latestPriceMetaByItemId.get(selectedItemId)?.world?.capturedAt ?? null)}） / 单列{" "}
              {formatGold(latestPriceMetaByItemId.get(selectedItemId)?.single?.price ?? null)}（
              {formatDateTime(latestPriceMetaByItemId.get(selectedItemId)?.single?.capturedAt ?? null)}） / 库存{" "}
              {inventoryByItemId.get(selectedItemId) ?? 0}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-300">当前分类下没有物品。</p>
          )}
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-2 py-1">物品</th>
                  <th className="px-2 py-1">分类</th>
                  <th className="px-2 py-1">伺服器价格</th>
                  <th className="px-2 py-1">世界价格</th>
                  <th className="px-2 py-1">库存</th>
                  <th className="px-2 py-1">选择</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-2 py-1">{item.name}</td>
                    <td className="px-2 py-1">{`${item.mainCategory} / ${item.subCategory}`}</td>
                    <td className="px-2 py-1">
                      <div>{formatGold(latestPriceMetaByItemId.get(item.id)?.server?.price ?? null)}</div>
                      <div className="text-[10px] text-slate-400">{formatDateTime(latestPriceMetaByItemId.get(item.id)?.server?.capturedAt ?? null)}</div>
                    </td>
                    <td className="px-2 py-1">
                      <div>{formatGold(latestPriceMetaByItemId.get(item.id)?.world?.price ?? null)}</div>
                      <div className="text-[10px] text-slate-400">{formatDateTime(latestPriceMetaByItemId.get(item.id)?.world?.capturedAt ?? null)}</div>
                    </td>
                    <td className="px-2 py-1">{inventoryByItemId.get(item.id) ?? 0}</td>
                    <td className="px-2 py-1">
                      <button className="pill-btn" onClick={() => onPickItemForCorrection(item.id)} disabled={busy}>
                        选择
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h5 className="mt-4 text-xs font-semibold text-slate-200">材料逆向推导制造推荐工具</h5>
        <p className="mt-2 text-xs text-slate-300">
          输入一个材料可反推关联配方；留空则按你当前背包的综合材料覆盖率自动推荐。系统会同步给出补差材料和预算内建议次数。
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseMaterialKeyword}
            onChange={(event) => setReverseMaterialKeyword(event.target.value)}
            disabled={busy}
            placeholder="材料关键词（如 奥里哈康）"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseFocusMaterialId}
            onChange={(event) => setReverseFocusMaterialId(event.target.value)}
            disabled={busy}
          >
            <option value="">材料筛选: 综合背包（全部）</option>
            {reverseMaterialOptions.map((item) => (
              <option key={`reverse-material-${item.id}`} value={item.id}>
                {item.name}（库存 {inventoryByItemId.get(item.id) ?? 0}）
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseCraftBudgetInput}
            onChange={(event) => setReverseCraftBudgetInput(event.target.value)}
            disabled={busy}
            placeholder="补差预算（金币）"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseScoreMode}
            onChange={(event) => setReverseScoreMode(event.target.value as ReverseScoreMode)}
            disabled={busy}
          >
            <option value="balanced">关联偏好: 平衡模式</option>
            <option value="coverage">关联偏好: 覆盖率优先</option>
            <option value="profit">关联偏好: 利润优先</option>
            <option value="craftable">关联偏好: 可直接制作优先</option>
          </select>
          <button className="task-btn px-4" onClick={() => void loadCraftOptions()} disabled={busy}>
            刷新建议
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-300">
          当前模式: {reverseFocusMaterialName ? `按材料「${reverseFocusMaterialName}」反推` : "综合背包关联推荐"} | 当前预算:{" "}
          {formatGold(reverseCraftBudget)} 金币 | 评分偏好: {reverseScoreModeLabel}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-emerald-200">可直接制作</span>
          <span className="rounded border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-cyan-200">补差后可做</span>
          <span className="rounded border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-amber-200">缺价格待补</span>
          <span className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-rose-200">低利润/风险</span>
        </div>
        <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 text-xs">
          {craftOptions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">暂无可分析配方。</p>
          ) : reverseCraftSuggestions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">
              {reverseFocusMaterialName ? `没有找到使用「${reverseFocusMaterialName}」的可推荐配方。` : "当前背包材料不足，暂时没有可推荐配方。"}
            </p>
          ) : (
            reverseCraftSuggestions.slice(0, 30).map((entry) => {
              const hasUnknownPrice = entry.unknownPriceRows.length > 0;
              const hasGap = entry.missingRows.length > 0;
              const positiveProfit = (entry.estimatedProfitPerRun ?? 0) >= 0;
              const directCraftable = entry.craftableCount > 0;
              const coverageTone =
                entry.coverageRatio >= 0.75 ? "text-emerald-300" : entry.coverageRatio >= 0.4 ? "text-amber-300" : "text-rose-300";
              let statusLabel = "补差后可做";
              let statusClass = "border-cyan-300/35 bg-cyan-500/10 text-cyan-200";
              if (hasUnknownPrice) {
                statusLabel = "缺价格待补";
                statusClass = "border-amber-300/35 bg-amber-500/10 text-amber-200";
              } else if (directCraftable && positiveProfit) {
                statusLabel = "可直接制作";
                statusClass = "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
              } else if (!positiveProfit) {
                statusLabel = "低利润/风险";
                statusClass = "border-rose-300/35 bg-rose-500/10 text-rose-200";
              }
              const cardToneClass = hasUnknownPrice
                ? "border-amber-300/35"
                : !positiveProfit
                  ? "border-rose-300/35"
                  : directCraftable
                    ? "border-emerald-300/30"
                    : "border-cyan-300/25";

              return (
                <div
                  key={`reverse-${entry.recipeId}`}
                  className={`mb-2 rounded-lg border bg-white/5 p-2 ${cardToneClass} ${
                    isStarredItem(entry.outputItemId) ? "ring-1 ring-amber-300/35" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-slate-100">
                      成品: {entry.outputItemName}
                      {entry.relatedByFocusMaterial ? "（命中材料）" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-2 py-1 text-[11px] ${statusClass}`}>{statusLabel}</span>
                      <span className="data-pill !px-2 !py-1">关联分 {entry.relevanceScore.toFixed(1)}</span>
                      <button
                        className="pill-btn !border-amber-300/40 !text-amber-200"
                        onClick={() => onToggleStarItem(entry.outputItemId)}
                        disabled={busy}
                      >
                        {isStarredItem(entry.outputItemId) ? "★" : "☆"}
                      </button>
                      <button className="pill-btn" onClick={() => onViewHistoryCurveForItem(entry.outputItemId)} disabled={busy}>
                        曲线
                      </button>
                      <button className="pill-btn" onClick={() => onJumpSimulationRecipe(entry.recipeId)} disabled={busy}>
                        定位模拟器
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className={`data-pill ${coverageTone}`}>覆盖率: {toPercent(entry.coverageRatio)}</div>
                    <div className="data-pill">
                      已命中材料: {entry.matchedOwnedMaterialCount}/{entry.totalMaterialCount}
                    </div>
                    <div className={`data-pill ${directCraftable ? "text-emerald-300" : "text-slate-300"}`}>可直接制作: {entry.craftableCount}</div>
                    <div className="data-pill">单次总材料成本: {formatGold(entry.requiredMaterialCostPerRun)}</div>
                    <div className={`data-pill ${hasGap ? "text-amber-300" : "text-emerald-300"}`}>单次补差: {formatGold(entry.missingPurchaseCostPerRun)}</div>
                    <div className="data-pill">预算建议次数: {entry.suggestedRunsByBudget}</div>
                    <div className={`data-pill ${positiveProfit ? "text-emerald-300" : "text-rose-300"}`}>单次利润: {formatGold(entry.estimatedProfitPerRun)}</div>
                    <div className={`data-pill ${entry.estimatedBudgetProfit !== null && entry.estimatedBudgetProfit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      预算潜在利润: {formatGold(entry.estimatedBudgetProfit)}
                    </div>
                  </div>

                  {entry.relatedByFocusMaterial ? (
                    <p className="mt-2 text-slate-300">
                      目标材料占比: 需求 {entry.focusMaterialRequired} / 现有 {entry.focusMaterialOwned}
                    </p>
                  ) : null}

                  {entry.unknownPriceRows.length > 0 ? (
                    <p className="mt-2 text-amber-300">缺价格材料: {entry.unknownPriceRows.map((row) => row.itemName).join("、")}</p>
                  ) : entry.missingRows.length > 0 ? (
                    <p className="mt-2 text-slate-300">补差材料: {entry.missingRows.map((row) => `${row.itemName}(${row.missing})`).join("、")}</p>
                  ) : (
                    <p className="mt-2 text-emerald-300">当前库存可直接开做，无需补差材料。</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </article>
  );
}

