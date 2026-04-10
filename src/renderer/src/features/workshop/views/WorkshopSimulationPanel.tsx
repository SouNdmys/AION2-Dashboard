import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { WorkshopCraftSimulationResult, WorkshopPriceMarket } from "../../../../../shared/types";
import { formatGold, formatMarketLabel, toPercent, type SimulationRecipeOption } from "../workshop-view-helpers";

interface WorkshopSimulationPanelProps {
  busy: boolean;
  message: string | null;
  error: string | null;
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
    message,
    error,
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
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [goldPerRmbDraft, setGoldPerRmbDraft] = useState("53");
  const [rmbPerTenThousandGoldDraft, setRmbPerTenThousandGoldDraft] = useState("0.0189");
  const [tradeTaxCorrectionDraft, setTradeTaxCorrectionDraft] = useState("10");

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
  const missingRows = useMemo(() => simulation?.materialRows.filter((row) => row.missing > 0) ?? [], [simulation]);
  const missingItemCount = missingRows.length;
  const missingTotalQuantity = missingRows.reduce((acc, row) => acc + row.missing, 0);
  const missingRowsWithUnknownPrice = missingRows.filter((row) => row.latestUnitPrice === null);
  const missingRowsUnknownPriceCount = missingRowsWithUnknownPrice.length;
  const purchaseListCostLabel =
    missingItemCount === 0
      ? formatGold(0)
      : missingRowsUnknownPriceCount > 0
        ? `待补价 ${missingRowsUnknownPriceCount} 项`
        : formatGold(missingRows.reduce((acc, row) => acc + (row.missingCost ?? 0), 0));
  const goldPerRmbValue = Number(goldPerRmbDraft);
  const rmbPerTenThousandGoldValue = Number(rmbPerTenThousandGoldDraft);
  const tradeTaxCorrectionValue = Number(tradeTaxCorrectionDraft);
  const normalizedGoldPerRmb =
    Number.isFinite(goldPerRmbValue) && goldPerRmbValue > 0
      ? goldPerRmbValue
      : Number.isFinite(rmbPerTenThousandGoldValue) && rmbPerTenThousandGoldValue > 0
        ? 1 / rmbPerTenThousandGoldValue
        : null;
  const normalizedTradeTaxCorrection =
    Number.isFinite(tradeTaxCorrectionValue) && tradeTaxCorrectionValue >= 0 && tradeTaxCorrectionValue < 100 ? tradeTaxCorrectionValue / 100 : null;
  const netGoldPerRmb =
    normalizedGoldPerRmb === null || normalizedTradeTaxCorrection === null ? null : normalizedGoldPerRmb * (1 - normalizedTradeTaxCorrection);
  const netRmbPerTenThousandGold = netGoldPerRmb === null || netGoldPerRmb <= 0 ? null : 1 / netGoldPerRmb;
  const estimatedRmbForMissingPurchase =
    simulation?.missingPurchaseCost === null || netGoldPerRmb === null || netGoldPerRmb <= 0
      ? null
      : (simulation?.missingPurchaseCost ?? 0) / (netGoldPerRmb * 10000);
  const goldValueFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const currencyFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const formatRatioDraft = (value: number, digits = 4): string => {
    const fixed = value.toFixed(digits);
    return fixed.replace(/\.?0+$/u, "");
  };

  const handleGoldPerRmbChange = (value: string): void => {
    setGoldPerRmbDraft(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setRmbPerTenThousandGoldDraft(formatRatioDraft(1 / parsed));
    }
  };

  const handleRmbPerTenThousandGoldChange = (value: string): void => {
    setRmbPerTenThousandGoldDraft(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setGoldPerRmbDraft(formatRatioDraft(1 / parsed));
    }
  };

  const handleCopyPurchaseList = async (): Promise<void> => {
    if (missingRows.length === 0) {
      setCopyMessage("当前没有缺口材料。");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyMessage("当前环境不支持复制，请手动查看采购清单。");
      return;
    }
    const lines = [
      `${simulation?.outputItemName ?? "当前配方"} 采购清单`,
      `制作 ${simulation?.runs ?? 0} 次 / 缺料 ${missingItemCount} 项 / 缺口总量 ${missingTotalQuantity}`,
      ...missingRows.map((row) => {
        const priceLabel = row.latestUnitPrice === null ? "待补价" : formatGold(row.latestUnitPrice);
        const costLabel = row.missingCost === null ? "待补价" : formatGold(row.missingCost);
        return `${row.itemName} | 缺口 ${row.missing} | 单价 ${priceLabel} | 采购成本 ${costLabel}`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyMessage("采购清单已复制。");
    } catch {
      setCopyMessage("复制失败，请稍后再试。");
    }
  };

  return (
    <article className="order-1 glass-panel rounded-[30px] p-5">
      <div className="section-card-heading">
        <div>
          <p className="panel-kicker">Craft Assistant</p>
          <h4 className="panel-title !mt-1">做装模拟器</h4>
          <p className="panel-subtitle">选择配方后直接运行模拟；修改材料价格与库存会立即参与结果计算，点击材料名可联动查看历史价格与市场分析。</p>
        </div>
        <div className="toolbar-inline">
          <span className="pill-btn pill-static !px-3">{simulation ? `${simulation.outputItemName} x${simulation.totalOutputQuantity}` : "等待选择配方"}</span>
          <span className="pill-btn pill-static !px-3">{simulation ? `制作 ${simulation.runs} 次` : "输入后可直接运行"}</span>
        </div>
      </div>
      {message ? <p className="banner-positive mt-4 rounded-xl px-3 py-2 text-xs">{message}</p> : null}
      {error ? <p className="banner-danger mt-3 rounded-xl px-3 py-2 text-xs">{error}</p> : null}
      <div className="section-card mt-4">
        <div className="section-card-heading">
          <div>
            <p className="section-card-title">Recipe Setup</p>
            <p className="section-card-lead">先选配方与售价，再进入材料规划。</p>
          </div>
        </div>
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
          <div>
            <div className="table-title-row">
              <p className="section-card-title">Material Planner</p>
              <span className="pill-btn pill-static !px-3">材料 {simulation.materialRows.length} 项</span>
            </div>
            <p className="section-card-lead">材料明细与库存修正</p>
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
          {simulation.unknownPriceItemIds.length > 0 ? (
            <p className="banner-warning mt-2 rounded-lg px-3 py-2">
              以下材料缺少价格，利润结果不完整:
              {simulation.unknownPriceItemIds.map((itemId) => resolveItemName(itemId)).join("、")}
            </p>
          ) : null}

          <div className="soft-card p-3">
            <div className="section-card-heading">
              <div>
                <p className="section-card-title">Purchase Plan</p>
                <p className="section-card-lead">材料缺口与采购清单</p>
                <p className="mt-1 inline-note">先看缺多少，再决定是否补价或直接采购。点击材料名仍可联动到市场工具。</p>
              </div>
              <button className="task-btn task-btn-soft task-btn-compact px-3" onClick={() => void handleCopyPurchaseList()} disabled={busy || missingItemCount === 0}>
                复制采购清单
              </button>
            </div>
            <div className="metric-grid-refined mt-3">
              <div className="metric-card-refined">
                <p className="metric-card-refined-label">缺料种类</p>
                <p className="metric-card-refined-value">{missingItemCount} 项</p>
              </div>
              <div className="metric-card-refined">
                <p className="metric-card-refined-label">总缺口数量</p>
                <p className="metric-card-refined-value">{missingTotalQuantity}</p>
              </div>
              <div className="metric-card-refined">
                <p className="metric-card-refined-label">预计采购成本</p>
                <p className={`metric-card-refined-value ${missingRowsUnknownPriceCount > 0 ? "tone-warning" : ""}`}>{purchaseListCostLabel}</p>
              </div>
            </div>
            {copyMessage ? <p className="mt-2 inline-note">{copyMessage}</p> : null}
            {missingItemCount === 0 ? (
              <p className="banner-positive mt-3 rounded-lg px-3 py-2">当前库存已满足本次制作，不需要额外采购材料。</p>
            ) : (
              <div className="surface-table mt-3 overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>材料</th>
                      <th>需求</th>
                      <th>库存</th>
                      <th>缺口</th>
                      <th>参考单价</th>
                      <th>采购成本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingRows.map((row) => (
                      <tr key={`purchase-row-${row.itemId}`}>
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
                        <td>{row.owned}</td>
                        <td className="tone-danger">{row.missing}</td>
                        <td className={row.latestUnitPrice === null ? "tone-warning" : "text-slate-500"}>
                          {row.latestUnitPrice === null ? "待补价" : formatGold(row.latestUnitPrice)}
                        </td>
                        <td className={row.missingCost === null ? "tone-warning" : "text-slate-900"}>
                          {row.missingCost === null ? "待补价" : formatGold(row.missingCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="soft-card p-3">
            <div className="section-card-heading">
              <div>
                <p className="section-card-title">Recommendation</p>
                <p className={`section-card-lead ${recommendationTone}`}>{recommendationLabel}</p>
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

          <div className="metric-grid-refined mt-2">
            <div className="metric-card-refined">
              <p className="metric-card-refined-label">材料成本</p>
              <p className="metric-card-refined-value">{formatGold(simulation.requiredMaterialCost)}</p>
            </div>
            <div className="metric-card-refined">
              <p className="metric-card-refined-label">税后收入</p>
              <p className="metric-card-refined-value">{formatGold(simulation.netRevenueAfterTax)}</p>
            </div>
            <div className="metric-card-refined">
              <p className="metric-card-refined-label">净利润</p>
              <p className={`metric-card-refined-value ${(simulation.estimatedProfit ?? 0) > 0 ? "tone-positive" : "tone-danger"}`}>
                {formatGold(simulation.estimatedProfit)}
              </p>
            </div>
            <div className="metric-card-refined">
              <p className="metric-card-refined-label">利润率</p>
              <p className={`metric-card-refined-value ${(simulation.estimatedProfitRate ?? 0) > 0 ? "tone-positive" : "tone-danger"}`}>
                {toPercent(simulation.estimatedProfitRate)}
              </p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="data-pill">成品单价: {formatGold(simulation.outputUnitPrice)}</div>
            <div className="data-pill">缺口补齐成本: {formatGold(simulation.missingPurchaseCost)}</div>
            <div className="data-pill">产物总量: {simulation.totalOutputQuantity}</div>
          </div>
          <div className="mt-3 soft-card p-3">
            <div className="section-card-heading">
              <div>
                <p className="section-card-title">RMB Ratio</p>
                <p className="section-card-lead">金价换算辅助</p>
                <p className="mt-1 inline-note">按你的收金比例估算，补齐当前材料缺口大约还要收多少 RMB。</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]">
              <input
                className="field-control"
                value={goldPerRmbDraft}
                onChange={(event) => handleGoldPerRmbChange(event.target.value)}
                disabled={busy}
                placeholder="1元=XX万基纳"
              />
              <input
                className="field-control"
                value={rmbPerTenThousandGoldDraft}
                onChange={(event) => handleRmbPerTenThousandGoldChange(event.target.value)}
                disabled={busy}
                placeholder="1万基纳=XX元"
              />
              <input
                className="field-control"
                value={tradeTaxCorrectionDraft}
                onChange={(event) => setTradeTaxCorrectionDraft(event.target.value)}
                disabled={busy}
                placeholder="交易行税后修正 %"
              />
              <div className="metric-card-refined">
                <p className="metric-card-refined-label">税后 1 元可到手</p>
                <p className="metric-card-refined-value">
                  {netGoldPerRmb === null ? "--" : `${goldValueFormatter.format(netGoldPerRmb)} 万金币`}
                </p>
              </div>
              <div className="metric-card-refined">
                <p className="metric-card-refined-label">税后 1 万基纳约合</p>
                <p className="metric-card-refined-value">
                  {netRmbPerTenThousandGold === null ? "--" : `¥${currencyFormatter.format(netRmbPerTenThousandGold)}`}
                </p>
              </div>
              <div className="metric-card-refined">
                <p className="metric-card-refined-label">补齐缺口约需 RMB</p>
                <p className={`metric-card-refined-value ${estimatedRmbForMissingPurchase === null ? "tone-warning" : ""}`}>
                  {estimatedRmbForMissingPurchase === null ? "--" : `¥${currencyFormatter.format(estimatedRmbForMissingPurchase)}`}
                </p>
              </div>
            </div>
            <p className="mt-2 inline-note">
              两个换算输入可以互相推导；税后修正会把显示结果改成实际到手金币口径，再估算补齐材料缺口大约还要收多少 RMB。
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

