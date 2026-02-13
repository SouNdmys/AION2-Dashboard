import { useEffect, useMemo, useState } from "react";
import type {
  WorkshopCraftOption,
  WorkshopCraftSimulationResult,
  WorkshopItemCategory,
  WorkshopRecipeInput,
  WorkshopState,
} from "../../shared/types";

const goldFormatter = new Intl.NumberFormat("zh-CN");

function formatGold(value: number | null): string {
  if (value === null) {
    return "--";
  }
  return goldFormatter.format(Math.floor(value));
}

function toInt(raw: string): number | null {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function toPercent(value: number | null): string {
  if (value === null) {
    return "--";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function categoryLabel(category: WorkshopItemCategory): string {
  if (category === "material") return "材料";
  if (category === "equipment") return "装备";
  if (category === "component") return "中间件";
  return "其他";
}

export function WorkshopView(): JSX.Element {
  const [state, setState] = useState<WorkshopState | null>(null);
  const [craftOptions, setCraftOptions] = useState<WorkshopCraftOption[]>([]);
  const [simulation, setSimulation] = useState<WorkshopCraftSimulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState<WorkshopItemCategory>("material");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemPrice, setSelectedItemPrice] = useState("0");
  const [selectedItemInventory, setSelectedItemInventory] = useState("0");

  const [recipeOutputItemId, setRecipeOutputItemId] = useState("");
  const [recipeOutputQuantity, setRecipeOutputQuantity] = useState("1");
  const [recipeInputItemId, setRecipeInputItemId] = useState("");
  const [recipeInputQuantity, setRecipeInputQuantity] = useState("1");
  const [recipeDraftInputs, setRecipeDraftInputs] = useState<WorkshopRecipeInput[]>([]);

  const [simulateRecipeId, setSimulateRecipeId] = useState("");
  const [simulateRuns, setSimulateRuns] = useState("1");
  const [taxMode, setTaxMode] = useState<"0.1" | "0.2">("0.1");
  const [nearCraftBudgetInput, setNearCraftBudgetInput] = useState("50000");
  const [nearCraftSortMode, setNearCraftSortMode] = useState<"max_budget_profit" | "min_gap_cost">("max_budget_profit");

  const taxRate = Number(taxMode);

  const itemById = useMemo(() => {
    if (!state) return new Map<string, { name: string }>();
    return new Map(state.items.map((item) => [item.id, { name: item.name }]));
  }, [state]);

  const latestPriceByItemId = useMemo(() => {
    if (!state) return new Map<string, number>();
    const map = new Map<string, { price: number; capturedAt: number }>();
    state.prices.forEach((snapshot) => {
      const ts = new Date(snapshot.capturedAt).getTime();
      const prev = map.get(snapshot.itemId);
      if (!prev || ts >= prev.capturedAt) {
        map.set(snapshot.itemId, { price: snapshot.unitPrice, capturedAt: ts });
      }
    });
    return new Map(Array.from(map.entries()).map(([itemId, value]) => [itemId, value.price]));
  }, [state]);

  const inventoryByItemId = useMemo(() => {
    if (!state) return new Map<string, number>();
    return new Map(state.inventory.map((row) => [row.itemId, row.quantity]));
  }, [state]);

  const nearCraftBudget = useMemo(() => {
    const parsed = toInt(nearCraftBudgetInput);
    if (parsed === null || parsed < 0) {
      return 0;
    }
    return parsed;
  }, [nearCraftBudgetInput]);

  const nearCraftSuggestions = useMemo(() => {
    return craftOptions
      .map((option) => {
        const missingRows = option.missingRowsForOneRun.filter((row) => row.missing > 0);
        if (missingRows.length === 0) {
          return null;
        }
        const unknownPriceRows = missingRows.filter((row) => row.missingCost === null || row.latestUnitPrice === null);
        const missingPurchaseCostPerRun =
          unknownPriceRows.length > 0 ? null : missingRows.reduce((acc, row) => acc + (row.missingCost ?? 0), 0);
        const affordableRuns =
          missingPurchaseCostPerRun === null || missingPurchaseCostPerRun <= 0
            ? 0
            : Math.max(0, Math.floor(nearCraftBudget / missingPurchaseCostPerRun));
        const estimatedProfitPerRun = option.estimatedProfitPerRun;
        const estimatedBudgetProfit =
          estimatedProfitPerRun === null || affordableRuns <= 0 ? null : estimatedProfitPerRun * affordableRuns;
        return {
          ...option,
          missingRows,
          missingPurchaseCostPerRun,
          affordableRuns,
          estimatedBudgetProfit,
          unknownPriceRows,
        };
      })
      .filter((entry) => entry !== null)
      .filter((entry) => entry.affordableRuns > 0 || entry.unknownPriceRows.length > 0)
      .sort((left, right) => {
        const leftCost = left.missingPurchaseCostPerRun ?? Number.MAX_SAFE_INTEGER;
        const rightCost = right.missingPurchaseCostPerRun ?? Number.MAX_SAFE_INTEGER;
        const leftProfit = left.estimatedBudgetProfit ?? Number.NEGATIVE_INFINITY;
        const rightProfit = right.estimatedBudgetProfit ?? Number.NEGATIVE_INFINITY;
        const leftPerRunProfit = left.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
        const rightPerRunProfit = right.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;

        if (nearCraftSortMode === "min_gap_cost") {
          if (leftCost !== rightCost) {
            return leftCost - rightCost;
          }
          if (right.affordableRuns !== left.affordableRuns) {
            return right.affordableRuns - left.affordableRuns;
          }
          if (rightProfit !== leftProfit) {
            return rightProfit - leftProfit;
          }
          if (rightPerRunProfit !== leftPerRunProfit) {
            return rightPerRunProfit - leftPerRunProfit;
          }
          return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
        }

        if (rightProfit !== leftProfit) {
          return rightProfit - leftProfit;
        }
        if (rightPerRunProfit !== leftPerRunProfit) {
          return rightPerRunProfit - leftPerRunProfit;
        }
        if (leftCost !== rightCost) {
          return leftCost - rightCost;
        }
        return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
      });
  }, [craftOptions, nearCraftBudget, nearCraftSortMode]);

  async function loadState(): Promise<void> {
    const next = await window.aionApi.getWorkshopState();
    setState(next);
  }

  async function loadCraftOptions(): Promise<void> {
    const next = await window.aionApi.getWorkshopCraftOptions({ taxRate });
    setCraftOptions(next);
  }

  async function bootstrap(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await Promise.all([loadState(), loadCraftOptions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "工坊初始化失败");
    } finally {
      setBusy(false);
    }
  }

  async function commit(action: () => Promise<WorkshopState>, successText: string): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await action();
      setState(next);
      setMessage(successText);
      await loadCraftOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "工坊操作失败");
    } finally {
      setBusy(false);
    }
  }

  function onSeedSampleData(): void {
    const api = window.aionApi as unknown as { seedWorkshopSampleData?: () => Promise<WorkshopState> };
    if (typeof api.seedWorkshopSampleData !== "function") {
      setError("当前运行实例未加载到最新 preload。请完全退出应用后重启，再点“一键导入样例”。");
      return;
    }
    void commit(() => api.seedWorkshopSampleData!(), "样例数据已导入，可直接在“制作模拟器”验证");
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!state) return;
    const exists = selectedItemId && state.items.some((item) => item.id === selectedItemId);
    if (!exists) {
      const fallback = state.items[0]?.id ?? "";
      setSelectedItemId(fallback);
    }
  }, [state, selectedItemId]);

  useEffect(() => {
    if (!state) return;
    const exists = recipeOutputItemId && state.items.some((item) => item.id === recipeOutputItemId);
    if (!exists) {
      const fallback = state.items[0]?.id ?? "";
      setRecipeOutputItemId(fallback);
    }
  }, [state, recipeOutputItemId]);

  useEffect(() => {
    if (!state) return;
    const exists = recipeInputItemId && state.items.some((item) => item.id === recipeInputItemId);
    if (!exists) {
      const fallback = state.items[0]?.id ?? "";
      setRecipeInputItemId(fallback);
    }
  }, [state, recipeInputItemId]);

  useEffect(() => {
    if (!state) return;
    const exists = simulateRecipeId && state.recipes.some((recipe) => recipe.id === simulateRecipeId);
    if (!exists) {
      const fallback = state.recipes[0]?.id ?? "";
      setSimulateRecipeId(fallback);
      setSimulation(null);
    }
  }, [state, simulateRecipeId]);

  useEffect(() => {
    if (!selectedItemId) return;
    const price = latestPriceByItemId.get(selectedItemId) ?? 0;
    const inventory = inventoryByItemId.get(selectedItemId) ?? 0;
    setSelectedItemPrice(String(price));
    setSelectedItemInventory(String(inventory));
  }, [selectedItemId, latestPriceByItemId, inventoryByItemId]);

  useEffect(() => {
    if (!state) return;
    void loadCraftOptions();
  }, [taxMode]);

  function onAddItem(): void {
    const name = itemName.trim();
    if (!name) {
      setError("请先输入物品名称。");
      return;
    }
    void commit(
      () =>
        window.aionApi.upsertWorkshopItem({
          name,
          category: itemCategory,
        }),
      `已新增物品: ${name}`,
    );
    setItemName("");
  }

  function onDeleteItem(itemId: string): void {
    const itemNameText = itemById.get(itemId)?.name ?? itemId;
    const confirmed = window.confirm(`删除物品「${itemNameText}」后，关联配方/价格/库存会一起删除，是否继续？`);
    if (!confirmed) {
      return;
    }
    void commit(() => window.aionApi.deleteWorkshopItem(itemId), `已删除物品: ${itemNameText}`);
  }

  function onSaveSelectedPrice(): void {
    if (!selectedItemId) {
      setError("请先选择物品。");
      return;
    }
    const unitPrice = toInt(selectedItemPrice);
    if (unitPrice === null || unitPrice < 0) {
      setError("价格必须是大于等于 0 的整数。");
      return;
    }
    void commit(
      () =>
        window.aionApi.addWorkshopPriceSnapshot({
          itemId: selectedItemId,
          unitPrice,
          source: "manual",
        }),
      "已记录价格快照",
    );
  }

  function onSaveSelectedInventory(): void {
    if (!selectedItemId) {
      setError("请先选择物品。");
      return;
    }
    const quantity = toInt(selectedItemInventory);
    if (quantity === null || quantity < 0) {
      setError("库存必须是大于等于 0 的整数。");
      return;
    }
    void commit(() => window.aionApi.upsertWorkshopInventory({ itemId: selectedItemId, quantity }), "已更新库存");
  }

  function onAddRecipeInput(): void {
    if (!recipeInputItemId) {
      setError("请先选择材料物品。");
      return;
    }
    const quantity = toInt(recipeInputQuantity);
    if (quantity === null || quantity <= 0) {
      setError("材料数量必须是正整数。");
      return;
    }
    setRecipeDraftInputs((prev) => {
      const existing = prev.find((entry) => entry.itemId === recipeInputItemId);
      if (existing) {
        return prev.map((entry) =>
          entry.itemId === recipeInputItemId ? { ...entry, quantity: entry.quantity + quantity } : entry,
        );
      }
      return [...prev, { itemId: recipeInputItemId, quantity }];
    });
  }

  function onRemoveRecipeInput(itemId: string): void {
    setRecipeDraftInputs((prev) => prev.filter((entry) => entry.itemId !== itemId));
  }

  function onSaveRecipe(): void {
    if (!recipeOutputItemId) {
      setError("请先选择成品物品。");
      return;
    }
    const outputQuantity = toInt(recipeOutputQuantity);
    if (outputQuantity === null || outputQuantity <= 0) {
      setError("成品数量必须是正整数。");
      return;
    }
    if (recipeDraftInputs.length === 0) {
      setError("配方至少需要一个材料。");
      return;
    }
    if (recipeDraftInputs.some((entry) => entry.itemId === recipeOutputItemId)) {
      setError("配方输入不能包含成品本身。");
      return;
    }
    void commit(
      () =>
        window.aionApi.upsertWorkshopRecipe({
          outputItemId: recipeOutputItemId,
          outputQuantity,
          inputs: recipeDraftInputs,
        }),
      "已保存配方",
    );
    setRecipeDraftInputs([]);
    setRecipeOutputQuantity("1");
  }

  function onDeleteRecipe(recipeId: string): void {
    const confirmed = window.confirm("确认删除该配方？");
    if (!confirmed) {
      return;
    }
    void commit(() => window.aionApi.deleteWorkshopRecipe(recipeId), "已删除配方");
  }

  async function onSimulate(): Promise<void> {
    if (!simulateRecipeId) {
      setError("请先选择要模拟的配方。");
      return;
    }
    const runs = toInt(simulateRuns);
    if (runs === null || runs <= 0) {
      setError("制作次数必须是正整数。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await window.aionApi.simulateWorkshopCraft({
        recipeId: simulateRecipeId,
        runs,
        taxRate,
      });
      setSimulation(result);
      setMessage("模拟完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模拟失败");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <p className="text-sm text-slate-300">工坊模块加载中...</p>
      </article>
    );
  }

  return (
    <div className="space-y-4">
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">工坊 Phase 1（MVP）</h3>
          <button className="pill-btn" onClick={onSeedSampleData} disabled={busy}>
            一键导入样例
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-300">当前已支持: 物品/价格/库存录入，配方录入，制作模拟，背包可制作推荐。</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div className="data-pill">物品数: {state.items.length}</div>
          <div className="data-pill">配方数: {state.recipes.length}</div>
          <div className="data-pill">价格快照: {state.prices.length}</div>
          <div className="data-pill">库存记录: {state.inventory.length}</div>
        </div>
        {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      </article>

      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <h4 className="text-sm font-semibold">1) 物品、价格、库存</h4>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
          <input
            className="min-w-0 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            placeholder="物品名称（如：奥德结晶）"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            disabled={busy}
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={itemCategory}
            onChange={(event) => setItemCategory(event.target.value as WorkshopItemCategory)}
            disabled={busy}
          >
            <option value="material">材料</option>
            <option value="equipment">装备</option>
            <option value="component">中间件</option>
            <option value="other">其他</option>
          </select>
          <button className="task-btn px-4" onClick={onAddItem} disabled={busy || !itemName.trim()}>
            新增物品
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            disabled={busy || state.items.length === 0}
          >
            {state.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({categoryLabel(item.category)})
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            placeholder="最新单价"
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

        <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-3 py-2">物品</th>
                <th className="px-3 py-2">分类</th>
                <th className="px-3 py-2">最新价格</th>
                <th className="px-3 py-2">库存</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{categoryLabel(item.category)}</td>
                  <td className="px-3 py-2">{formatGold(latestPriceByItemId.get(item.id) ?? null)}</td>
                  <td className="px-3 py-2">{inventoryByItemId.get(item.id) ?? 0}</td>
                  <td className="px-3 py-2">
                    <button className="pill-btn" onClick={() => onDeleteItem(item.id)} disabled={busy}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <h4 className="text-sm font-semibold">2) 配方录入</h4>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,1.2fr)_minmax(0,0.6fr)_auto]">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={recipeOutputItemId}
            onChange={(event) => setRecipeOutputItemId(event.target.value)}
            disabled={busy || state.items.length === 0}
          >
            {state.items.map((item) => (
              <option key={`recipe-output-${item.id}`} value={item.id}>
                成品: {item.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={recipeOutputQuantity}
            onChange={(event) => setRecipeOutputQuantity(event.target.value)}
            disabled={busy}
            placeholder="成品数"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={recipeInputItemId}
            onChange={(event) => setRecipeInputItemId(event.target.value)}
            disabled={busy || state.items.length === 0}
          >
            {state.items.map((item) => (
              <option key={`recipe-input-${item.id}`} value={item.id}>
                材料: {item.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={recipeInputQuantity}
            onChange={(event) => setRecipeInputQuantity(event.target.value)}
            disabled={busy}
            placeholder="材料数"
          />
          <button className="task-btn px-4" onClick={onAddRecipeInput} disabled={busy || !recipeInputItemId}>
            添加材料
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {recipeDraftInputs.length === 0 ? <p className="text-xs text-slate-300">当前配方草稿还没有材料。</p> : null}
          {recipeDraftInputs.map((entry) => (
            <span key={`draft-input-${entry.itemId}`} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
              {(itemById.get(entry.itemId)?.name ?? entry.itemId) + ` x${entry.quantity}`}
              <button className="ml-2 text-rose-300" onClick={() => onRemoveRecipeInput(entry.itemId)} disabled={busy}>
                删除
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3">
          <button className="task-btn px-4" onClick={onSaveRecipe} disabled={busy || recipeDraftInputs.length === 0}>
            保存配方
          </button>
        </div>
        <div className="mt-3 max-h-52 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
          {state.recipes.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-300">暂无配方。</p>
          ) : (
            state.recipes.map((recipe) => (
              <div key={recipe.id} className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p>
                    <span className="font-semibold">{itemById.get(recipe.outputItemId)?.name ?? recipe.outputItemId}</span>
                    {` x${recipe.outputQuantity}`}
                  </p>
                  <button className="pill-btn" onClick={() => onDeleteRecipe(recipe.id)} disabled={busy}>
                    删除
                  </button>
                </div>
                <p className="mt-1 text-slate-300">
                  {recipe.inputs
                    .map((input) => `${itemById.get(input.itemId)?.name ?? input.itemId} x${input.quantity}`)
                    .join(" + ")}
                </p>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <h4 className="text-sm font-semibold">3) 制作模拟器 + 机会分析</h4>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_auto]">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateRecipeId}
            onChange={(event) => setSimulateRecipeId(event.target.value)}
            disabled={busy || state.recipes.length === 0}
          >
            {state.recipes.map((recipe) => (
              <option key={`sim-recipe-${recipe.id}`} value={recipe.id}>
                {itemById.get(recipe.outputItemId)?.name ?? recipe.outputItemId}
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

        {simulation ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="data-pill">产物: {simulation.outputItemName}</div>
              <div className="data-pill">总产量: {simulation.totalOutputQuantity}</div>
              <div className="data-pill">材料成本: {formatGold(simulation.requiredMaterialCost)}</div>
              <div className="data-pill">净利润: {formatGold(simulation.estimatedProfit)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="data-pill">税后收入: {formatGold(simulation.netRevenueAfterTax)}</div>
              <div className="data-pill">利润率: {toPercent(simulation.estimatedProfitRate)}</div>
              <div className="data-pill">缺口补齐成本: {formatGold(simulation.missingPurchaseCost)}</div>
              <div className="data-pill">{simulation.craftableNow ? "库存可直接制作" : "库存不足，需补材料"}</div>
            </div>
            {simulation.unknownPriceItemIds.length > 0 ? (
              <p className="mt-2 text-amber-300">
                以下材料缺少价格，利润结果不完整:
                {simulation.unknownPriceItemIds
                  .map((itemId) => itemById.get(itemId)?.name ?? itemId)
                  .join("、")}
              </p>
            ) : null}
            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-2 py-1">材料</th>
                    <th className="px-2 py-1">需求</th>
                    <th className="px-2 py-1">库存</th>
                    <th className="px-2 py-1">缺口</th>
                    <th className="px-2 py-1">单价</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.materialRows.map((row) => (
                    <tr key={`sim-material-${row.itemId}`} className="border-t border-white/10">
                      <td className="px-2 py-1">{row.itemName}</td>
                      <td className="px-2 py-1">{row.required}</td>
                      <td className="px-2 py-1">{row.owned}</td>
                      <td className={`px-2 py-1 ${row.missing > 0 ? "text-rose-300" : "text-emerald-300"}`}>{row.missing}</td>
                      <td className="px-2 py-1">{formatGold(row.latestUnitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </article>

      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">4) 背包逆向推导（可制作什么）</h4>
          <button className="pill-btn" onClick={() => void loadCraftOptions()} disabled={busy}>
            刷新建议
          </button>
        </div>
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 text-xs">
          {craftOptions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">暂无可分析配方。</p>
          ) : (
            craftOptions.slice(0, 30).map((option) => (
              <div key={`option-${option.recipeId}`} className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="data-pill">成品: {option.outputItemName}</div>
                  <div className="data-pill">可做次数: {option.craftableCount}</div>
                  <div className="data-pill">单次成本: {formatGold(option.requiredMaterialCostPerRun)}</div>
                  <div
                    className={`data-pill ${
                      option.estimatedProfitPerRun !== null && option.estimatedProfitPerRun >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    单次利润: {formatGold(option.estimatedProfitPerRun)}
                  </div>
                </div>
                {option.missingRowsForOneRun.length > 0 ? (
                  <p className="mt-2 text-slate-300">
                    缺口:
                    {option.missingRowsForOneRun.map((row) => `${row.itemName}(${row.missing})`).join("、")}
                  </p>
                ) : (
                  <p className="mt-2 text-emerald-300">当前库存已满足单次制作。</p>
                )}
              </div>
            ))
          )}
        </div>
      </article>

      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <h4 className="text-sm font-semibold">5) Phase 1.2 差一点可做（补差预算）</h4>
        <p className="mt-2 text-xs text-slate-300">输入可补差预算，系统会推算“补一点材料即可开做”的目标与预算内潜在利润。</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={nearCraftBudgetInput}
            onChange={(event) => setNearCraftBudgetInput(event.target.value)}
            disabled={busy}
            placeholder="补差预算（金币）"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={nearCraftSortMode}
            onChange={(event) => setNearCraftSortMode(event.target.value as "max_budget_profit" | "min_gap_cost")}
            disabled={busy}
          >
            <option value="max_budget_profit">排序: 最高预算利润优先</option>
            <option value="min_gap_cost">排序: 最低补差成本优先</option>
          </select>
          <button className="task-btn px-4" onClick={() => void loadCraftOptions()} disabled={busy}>
            按预算刷新
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-300">当前预算: {formatGold(nearCraftBudget)} 金币，计算基于“{taxMode === "0.1" ? "服务器拍卖行税 10%" : "世界交易行税 20%"}”。</p>
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 text-xs">
          {nearCraftSuggestions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">在当前预算下，没有可补差开做的目标，或关键材料缺少价格。</p>
          ) : (
            nearCraftSuggestions.slice(0, 30).map((entry) => (
              <div key={`near-${entry.recipeId}`} className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  <div className="data-pill">成品: {entry.outputItemName}</div>
                  <div className="data-pill">单次补差: {formatGold(entry.missingPurchaseCostPerRun)}</div>
                  <div className="data-pill">预算内可补差次数: {entry.affordableRuns}</div>
                  <div className="data-pill">单次利润: {formatGold(entry.estimatedProfitPerRun)}</div>
                  <div
                    className={`data-pill ${
                      entry.estimatedBudgetProfit !== null && entry.estimatedBudgetProfit >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    预算内潜在利润: {formatGold(entry.estimatedBudgetProfit)}
                  </div>
                </div>
                {entry.unknownPriceRows.length > 0 ? (
                  <p className="mt-2 text-amber-300">
                    缺价格材料:
                    {entry.unknownPriceRows.map((row) => `${row.itemName}`).join("、")}
                  </p>
                ) : (
                  <p className="mt-2 text-slate-300">
                    主要缺口:
                    {entry.missingRows.map((row) => `${row.itemName}(${row.missing})`).join("、")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  );
}
