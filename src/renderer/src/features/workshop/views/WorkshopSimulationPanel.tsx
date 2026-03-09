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
    ? "text-slate-900"
    : simulation.unknownPriceItemIds.length > 0
      ? "tone-warning"
      : (simulation.estimatedProfit ?? 0) > 0
        ? "tone-positive"
        : "tone-danger";
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
    <article className="order-1 glass-panel rounded-[30px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="panel-kicker">Craft Assistant</p>
          <h4 className="panel-title !mt-1">做装模拟器</h4>
          <p className="panel-subtitle">只保留制作目标、售价和税率三个判断入口，先得到结论，再决定要不要展开专业工具。</p>
        </div>
        <span className="pill-btn pill-static">装备制作</span>
      </div>
      <div className="section-card mt-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <select
            className="field-control"
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
          <select className="field-control" value={simulateSubCategory} onChange={(event) => setSimulateSubCategory(event.target.value)} disabled={busy}>
            <option value="all">下级分类: 全部</option>
            {simulationSubCategoryOptions.map((category) => (
              <option key={`sim-sub-category-${category}`} value={category}>
                下级分类: {category}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.58fr)_minmax(0,0.72fr)_minmax(0,0.8fr)_auto]">
          <select
            className="field-control"
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
          <input className="field-control" value={simulateRuns} onChange={(event) => setSimulateRuns(event.target.value)} disabled={busy} placeholder="制作次数" />
          <input
            className="field-control"
            value={simulationOutputPriceDraft}
            onChange={(event) => setSimulationOutputPriceDraft(event.target.value)}
            disabled={busy || !simulation}
            placeholder="成品售价(可改)"
          />
          <select className="field-control" value={taxMode} onChange={(event) => setTaxMode(event.target.value as "0.1" | "0.2")} disabled={busy}>
            <option value="0.1">服务器拍卖行税 10%</option>
            <option value="0.2">世界交易行税 20%</option>
          </select>
          <button className="task-btn task-btn-soft px-4" onClick={() => void onSimulate()} disabled={busy || !simulateRecipeId}>
            运行模拟
          </button>
        </div>
        {filteredSimulationRecipes.length === 0 ? <p className="banner-warning mt-3 rounded-xl px-3 py-2 text-xs">当前分类下没有可模拟的配方。</p> : null}
      </div>

      {simulation ? (
        <div className="section-card mt-4 text-xs">
          <div className="soft-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-500">模拟结论</p>
                <p className={`mt-1 text-base font-semibold ${recommendationTone}`}>{recommendationLabel}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {simulation.outputItemName} x {simulation.totalOutputQuantity} | 制作 {simulation.runs} 次
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500">库存状态</p>
                <p className={`mt-1 text-sm ${simulation.craftableNow ? "tone-positive" : "tone-warning"}`}>
                  {simulation.craftableNow ? "库存可直接制作" : "库存不足，需补材料"}
                </p>
              </div>
            </div>
            <p className="mt-2 inline-note">{recommendationDetail}</p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="data-pill">
              <p className="text-[11px] text-slate-500">材料成本</p>
              <p className="mt-1 text-sm text-slate-900">{formatGold(simulation.requiredMaterialCost)}</p>
            </div>
            <div className="data-pill">
              <p className="text-[11px] text-slate-500">税后收入</p>
              <p className="mt-1 text-sm text-slate-900">{formatGold(simulation.netRevenueAfterTax)}</p>
            </div>
            <div className="data-pill">
              <p className="text-[11px] text-slate-500">净利润</p>
              <p className={`mt-1 text-sm ${(simulation.estimatedProfit ?? 0) > 0 ? "tone-positive" : "tone-danger"}`}>
                {formatGold(simulation.estimatedProfit)}
              </p>
            </div>
            <div className="data-pill">
              <p className="text-[11px] text-slate-500">利润率</p>
              <p className={`mt-1 text-sm ${(simulation.estimatedProfitRate ?? 0) > 0 ? "tone-positive" : "tone-danger"}`}>
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
            <p className="banner-warning mt-2 rounded-lg px-3 py-2">
              以下材料缺少价格，利润结果不完整:
              {simulation.unknownPriceItemIds.map((itemId) => resolveItemName(itemId)).join("、")}
            </p>
          ) : null}
          <div className="mt-3">
            <p className="text-[11px] font-medium text-slate-500">材料明细与库存修正（{simulation.materialRows.length} 项）</p>
            <div className="surface-table mt-2 max-h-64 overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>材料</th>
                    <th>需求</th>
                    <th>库存(可改)</th>
                    <th>缺口</th>
                    <th>单价(可改)</th>
                    <th>取价来源</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.materialRows.map((row) => (
                    <tr key={`sim-material-${row.itemId}`}>
                      <td>
                        <button
                          className="text-left text-[color:var(--accent-1)] hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                          onClick={() => onFocusSimulationMaterial(row.itemId, row.latestPriceMarket)}
                          disabled={busy}
                          title="联动显示该材料的历史价格与市场分析"
                        >
                          {row.itemName}
                        </button>
                      </td>
                      <td>{row.required}</td>
                      <td>
                        <input
                          className="field-control-inline w-24"
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
                      <td className={row.missing > 0 ? "tone-danger" : "tone-positive"}>{row.missing}</td>
                      <td>
                        <input
                          className="field-control-inline w-28"
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
                      <td className="text-slate-500">{formatMarketLabel(row.latestPriceMarket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

