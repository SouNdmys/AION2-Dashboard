import type { Dispatch, SetStateAction } from "react";
import type { WorkshopCraftSimulationResult, WorkshopPriceMarket } from "../../../../../shared/types";
import { formatGold, formatMarketLabel, toPercent, type SimulationRecipeOption } from "../workshop-view-helpers";

interface WorkshopSimulationPanelProps {
  busy: boolean;
  simulation: WorkshopCraftSimulationResult | null;
  simulateMainCategory: string;
  setSimulateMainCategory: (value: string) => void;
  simulationMainCategoryOptions: string[];
  simulateSubCategory: "all" | string;
  setSimulateSubCategory: (value: "all" | string) => void;
  simulationSubCategoryOptions: string[];
  simulateRecipeId: string;
  setSimulateRecipeId: (value: string) => void;
  filteredSimulationRecipes: SimulationRecipeOption[];
  simulateRuns: string;
  setSimulateRuns: (value: string) => void;
  simulationOutputPriceDraft: string;
  setSimulationOutputPriceDraft: (value: string) => void;
  taxMode: "0.1" | "0.2";
  setTaxMode: (value: "0.1" | "0.2") => void;
  onSimulate: () => Promise<void>;
  onFocusSimulationMaterial: (itemId: string, market?: WorkshopPriceMarket) => void;
  resolveItemName: (itemId: string) => string;
  simulationMaterialDraft: Record<string, { unitPrice: string; owned: string }>;
  setSimulationMaterialDraft: Dispatch<SetStateAction<Record<string, { unitPrice: string; owned: string }>>>;
}

export function WorkshopSimulationPanel(props: WorkshopSimulationPanelProps): JSX.Element {
  const {
    busy,
    simulation,
    simulateMainCategory,
    setSimulateMainCategory,
    simulationMainCategoryOptions,
    simulateSubCategory,
    setSimulateSubCategory,
    simulationSubCategoryOptions,
    simulateRecipeId,
    setSimulateRecipeId,
    filteredSimulationRecipes,
    simulateRuns,
    setSimulateRuns,
    simulationOutputPriceDraft,
    setSimulationOutputPriceDraft,
    taxMode,
    setTaxMode,
    onSimulate,
    onFocusSimulationMaterial,
    resolveItemName,
    simulationMaterialDraft,
    setSimulationMaterialDraft,
  } = props;

  const recommendationTone = !simulation
    ? "text-slate-200"
    : simulation.unknownPriceItemIds.length > 0
      ? "text-amber-300"
      : (simulation.estimatedProfit ?? 0) > 0
        ? "text-emerald-300"
        : "text-rose-300";
  const recommendationLabel = !simulation
    ? "等待模拟"
    : simulation.unknownPriceItemIds.length > 0
      ? "缺价待补"
      : (simulation.estimatedProfit ?? 0) > 0
        ? "值得做"
        : "建议观察";
  const recommendationDetail = !simulation
    ? "先选择配方并运行模拟。"
    : simulation.unknownPriceItemIds.length > 0
      ? `还有 ${simulation.unknownPriceItemIds.length} 项材料缺少价格，先补完再判断利润。`
      : simulation.craftableNow
        ? "当前库存可直接启动制作。"
        : "库存不足，需要先补材料再制作。";

  return (
    <article className="order-1 glass-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">做装模拟器</h4>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <select
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={simulateMainCategory}
          onChange={(event) => setSimulateMainCategory(event.target.value)}
          disabled={busy || simulationMainCategoryOptions.length === 0}
        >
          {simulationMainCategoryOptions.map((category) => (
            <option key={`sim-main-category-${category}`} value={category}>
              大类: {category}
            </option>
          ))}
        </select>
        <select
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={simulateSubCategory}
          onChange={(event) => setSimulateSubCategory(event.target.value)}
          disabled={busy}
        >
          <option value="all">下级分类: 全部</option>
          {simulationSubCategoryOptions.map((category) => (
            <option key={`sim-sub-category-${category}`} value={category}>
              下级分类: {category}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_auto]">
        <select
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={simulateRecipeId}
          onChange={(event) => setSimulateRecipeId(event.target.value)}
          disabled={busy || filteredSimulationRecipes.length === 0}
        >
          {filteredSimulationRecipes.map((recipe) => (
            <option key={`sim-recipe-${recipe.id}`} value={recipe.id}>
              [{recipe.subCategory}] {recipe.outputName}
            </option>
          ))}
        </select>
        <input
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={simulateRuns}
          onChange={(event) => setSimulateRuns(event.target.value)}
          disabled={busy}
          placeholder="制作次数"
        />
        <input
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={simulationOutputPriceDraft}
          onChange={(event) => setSimulationOutputPriceDraft(event.target.value)}
          disabled={busy || !simulation}
          placeholder="成品售价(可改)"
        />
        <select
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
          value={taxMode}
          onChange={(event) => setTaxMode(event.target.value as "0.1" | "0.2")}
          disabled={busy}
        >
          <option value="0.1">服务器拍卖行税 10%</option>
          <option value="0.2">世界交易行税 20%</option>
        </select>
        <button className="task-btn px-4" onClick={() => void onSimulate()} disabled={busy || !simulateRecipeId}>
          运行模拟
        </button>
      </div>
      {filteredSimulationRecipes.length === 0 ? <p className="mt-2 text-xs text-amber-300">当前分类下没有可模拟的配方。</p> : null}

      {simulation ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-400">模拟结论</p>
                <p className={`mt-1 text-base font-semibold ${recommendationTone}`}>{recommendationLabel}</p>
                <p className="mt-1 text-[11px] text-slate-300">
                  {simulation.outputItemName} x {simulation.totalOutputQuantity} | 制作 {simulation.runs} 次
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400">库存状态</p>
                <p className={`mt-1 text-sm ${simulation.craftableNow ? "text-emerald-300" : "text-amber-300"}`}>
                  {simulation.craftableNow ? "库存可直接制作" : "库存不足，需补材料"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-300">{recommendationDetail}</p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="data-pill">
              <p className="text-[11px] text-slate-400">材料成本</p>
              <p className="mt-1 text-sm text-slate-100">{formatGold(simulation.requiredMaterialCost)}</p>
            </div>
            <div className="data-pill">
              <p className="text-[11px] text-slate-400">税后收入</p>
              <p className="mt-1 text-sm text-slate-100">{formatGold(simulation.netRevenueAfterTax)}</p>
            </div>
            <div className="data-pill">
              <p className="text-[11px] text-slate-400">净利润</p>
              <p className={`mt-1 text-sm ${(simulation.estimatedProfit ?? 0) > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {formatGold(simulation.estimatedProfit)}
              </p>
            </div>
            <div className="data-pill">
              <p className="text-[11px] text-slate-400">利润率</p>
              <p className={`mt-1 text-sm ${(simulation.estimatedProfitRate ?? 0) > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {toPercent(simulation.estimatedProfitRate)}
              </p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="data-pill">成品单价: {formatGold(simulation.outputUnitPrice)}</div>
            <div className="data-pill">缺口补齐成本: {formatGold(simulation.missingPurchaseCost)}</div>
            <div className="data-pill">产物总量: {simulation.totalOutputQuantity}</div>
          </div>
          {simulation.unknownPriceItemIds.length > 0 ? (
            <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-300">
              以下材料缺少价格，利润结果不完整:
              {simulation.unknownPriceItemIds.map((itemId) => resolveItemName(itemId)).join("、")}
            </p>
          ) : null}
          <details className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
            <summary className="details-summary text-slate-200">
              查看材料明细与库存修正（{simulation.materialRows.length} 项）
            </summary>
            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-2 py-1">材料</th>
                    <th className="px-2 py-1">需求</th>
                    <th className="px-2 py-1">库存(可改)</th>
                    <th className="px-2 py-1">缺口</th>
                    <th className="px-2 py-1">单价(可改)</th>
                    <th className="px-2 py-1">取价来源</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.materialRows.map((row) => (
                    <tr key={`sim-material-${row.itemId}`} className="border-t border-white/10">
                      <td className="px-2 py-1">
                        <button
                          className="text-left text-cyan-200 hover:underline disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => onFocusSimulationMaterial(row.itemId, row.latestPriceMarket)}
                          disabled={busy}
                          title="联动显示该材料的历史价格与市场分析"
                        >
                          {row.itemName}
                        </button>
                      </td>
                      <td className="px-2 py-1">{row.required}</td>
                      <td className="px-2 py-1">
                        <input
                          className="w-24 rounded border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                          value={simulationMaterialDraft[row.itemId]?.owned ?? String(row.owned)}
                          onChange={(event) =>
                            setSimulationMaterialDraft((prev) => ({
                              ...prev,
                              [row.itemId]: {
                                unitPrice: prev[row.itemId]?.unitPrice ?? (row.latestUnitPrice === null ? "" : String(row.latestUnitPrice)),
                                owned: event.target.value,
                              },
                            }))
                          }
                          disabled={busy}
                        />
                      </td>
                      <td className={`px-2 py-1 ${row.missing > 0 ? "text-rose-300" : "text-emerald-300"}`}>{row.missing}</td>
                      <td className="px-2 py-1">
                        <input
                          className="w-28 rounded border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                          value={simulationMaterialDraft[row.itemId]?.unitPrice ?? (row.latestUnitPrice === null ? "" : String(row.latestUnitPrice))}
                          onChange={(event) =>
                            setSimulationMaterialDraft((prev) => ({
                              ...prev,
                              [row.itemId]: {
                                unitPrice: event.target.value,
                                owned: prev[row.itemId]?.owned ?? String(row.owned),
                              },
                            }))
                          }
                          disabled={busy}
                          placeholder="留空=不改"
                        />
                      </td>
                      <td className="px-2 py-1 text-slate-300">{formatMarketLabel(row.latestPriceMarket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ) : null}
    </article>
  );
}

