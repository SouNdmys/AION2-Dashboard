import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkshopPriceMarket, WorkshopState } from "../../shared/types";
import { useWorkshopActions } from "./features/workshop/actions/useWorkshopActions";
import {
  inferMainCategoryByContext,
  inferRecipeSubCategory,
  parseItemMainCategory,
  parseItemRawCategory,
  parseItemSourceTag,
  sortCategoryText,
  sortMainCategoryText,
} from "./features/workshop/workshop-view-helpers";

const goldFormatter = new Intl.NumberFormat("zh-CN");

function formatGold(value: number): string {
  return goldFormatter.format(Math.floor(value));
}

function isSuspectPriceNote(note?: string): boolean {
  if (!note) {
    return false;
  }
  return note.includes("qa:suspect") || note.includes("qa:hard-outlier");
}

function formatMarketLabel(market: WorkshopPriceMarket | undefined): string {
  if (market === "server") {
    return "伺服器";
  }
  if (market === "world") {
    return "世界";
  }
  return "单列";
}

function toInt(raw: string): number | null {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

interface WorkshopSidebarHistoryCardProps {
  focusItemId?: string | null;
  focusSnapshotId?: string | null;
  focusNonce?: number;
  onPriceDataChanged?: () => void;
}

export function WorkshopSidebarHistoryCard(props: WorkshopSidebarHistoryCardProps = {}): JSX.Element {
  const { focusItemId = null, focusSnapshotId = null, focusNonce = 0, onPriceDataChanged } = props;
  const workshopActions = useWorkshopActions();
  const [state, setState] = useState<WorkshopState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mainCategory, setMainCategory] = useState<"all" | string>("all");
  const [subCategory, setSubCategory] = useState<"all" | string>("all");
  const [selectedItemId, setSelectedItemId] = useState<"all" | string>("all");
  const [keyword, setKeyword] = useState("");
  const [limitInput, setLimitInput] = useState("120");
  const [highlightSnapshotId, setHighlightSnapshotId] = useState<string | null>(null);
  const handledFocusNonceRef = useRef(0);
  const historyTableContainerRef = useRef<HTMLDivElement | null>(null);

  const classifiedItems = useMemo(() => {
    if (!state) {
      return [] as Array<{ id: string; name: string; mainCategory: string; subCategory: string }>;
    }
    return state.items.map((item) => {
      const rawCategory = parseItemRawCategory(item.notes);
      const sourceTag = parseItemSourceTag(item.notes);
      const explicitMainCategory = parseItemMainCategory(item.notes);
      const inferredSubCategory = inferRecipeSubCategory(rawCategory, item.name, item.category);
      return {
        id: item.id,
        name: item.name,
        mainCategory: inferMainCategoryByContext(
          explicitMainCategory,
          sourceTag,
          inferredSubCategory,
          rawCategory,
          item.name,
        ),
        subCategory: inferredSubCategory,
      };
    });
  }, [state]);

  const mainCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(classifiedItems.map((item) => item.mainCategory).filter(Boolean)));
    return unique.sort(sortMainCategoryText);
  }, [classifiedItems]);

  const itemsByMainCategory = useMemo(() => {
    return classifiedItems.filter((item) => (mainCategory === "all" ? true : item.mainCategory === mainCategory));
  }, [classifiedItems, mainCategory]);

  const subCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(itemsByMainCategory.map((item) => item.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  }, [itemsByMainCategory]);

  const itemOptions = useMemo(() => {
    return itemsByMainCategory
      .filter((item) => (subCategory === "all" ? true : item.subCategory === subCategory))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [itemsByMainCategory, subCategory]);

  const itemMetaById = useMemo(() => {
    const map = new Map<string, { itemName: string; mainCategory: string; subCategory: string }>();
    classifiedItems.forEach((item) => {
      map.set(item.id, {
        itemName: item.name,
        mainCategory: item.mainCategory,
        subCategory: item.subCategory,
      });
    });
    return map;
  }, [classifiedItems]);

  const validItemIds = useMemo(() => new Set(itemOptions.map((item) => item.id)), [itemOptions]);

  const limit = useMemo(() => {
    const parsed = toInt(limitInput);
    if (parsed === null) {
      return 120;
    }
    return Math.max(20, Math.min(500, parsed));
  }, [limitInput]);

  const rows = useMemo(() => {
    if (!state) {
      return [] as Array<{
        id: string;
        itemId: string;
        itemName: string;
        unitPrice: number;
        market?: WorkshopPriceMarket;
        capturedAt: string;
        source: "manual" | "import";
        note?: string;
        mainCategory: string;
        subCategory: string;
      }>;
    }
    const trimmedKeyword = keyword.trim();
    const sorted = [...state.prices]
      .sort((left, right) => {
        const leftTs = new Date(left.capturedAt).getTime();
        const rightTs = new Date(right.capturedAt).getTime();
        if (leftTs !== rightTs) {
          return rightTs - leftTs;
        }
        return right.id.localeCompare(left.id);
      })
      .map((row) => ({
        ...row,
        itemName: itemMetaById.get(row.itemId)?.itemName ?? row.itemId,
        mainCategory: itemMetaById.get(row.itemId)?.mainCategory ?? "未分類",
        subCategory: itemMetaById.get(row.itemId)?.subCategory ?? "其他",
      }))
      .filter((row) => {
        if (mainCategory !== "all" && row.mainCategory !== mainCategory) {
          return false;
        }
        if (subCategory !== "all" && row.subCategory !== subCategory) {
          return false;
        }
        if (selectedItemId !== "all" && row.itemId !== selectedItemId) {
          return false;
        }
        if (trimmedKeyword && !row.itemName.includes(trimmedKeyword)) {
          return false;
        }
        return true;
      });

    const limited = sorted.slice(0, limit);
    if (highlightSnapshotId && !limited.some((row) => row.id === highlightSnapshotId)) {
      const target = sorted.find((row) => row.id === highlightSnapshotId);
      if (target) {
        return [target, ...limited.slice(0, Math.max(0, limit - 1))];
      }
    }
    return limited;
  }, [state, itemMetaById, mainCategory, subCategory, selectedItemId, keyword, limit, highlightSnapshotId]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (mainCategory !== "all" && !mainCategoryOptions.includes(mainCategory)) {
      setMainCategory("all");
    }
  }, [mainCategory, mainCategoryOptions]);

  useEffect(() => {
    if (subCategory !== "all" && !subCategoryOptions.includes(subCategory)) {
      setSubCategory("all");
    }
  }, [subCategory, subCategoryOptions]);

  useEffect(() => {
    if (selectedItemId === "all") {
      return;
    }
    const exists = validItemIds.has(selectedItemId);
    if (!exists) {
      setSelectedItemId("all");
    }
  }, [selectedItemId, validItemIds]);

  useEffect(() => {
    if (!focusItemId || focusNonce <= 0) {
      return;
    }
    if (focusNonce === handledFocusNonceRef.current) {
      return;
    }
    handledFocusNonceRef.current = focusNonce;
    const target = classifiedItems.find((item) => item.id === focusItemId);
    if (!target) {
      setError("定位失败：目标物品不存在，可能已被删除。");
      return;
    }
    setMainCategory("all");
    setSubCategory("all");
    setKeyword("");
    setLimitInput((prev) => {
      const current = toInt(prev);
      if (current !== null && current >= 500) {
        return prev;
      }
      return "500";
    });
    setSelectedItemId(focusItemId);
    setHighlightSnapshotId(focusSnapshotId ?? null);
    setMessage(focusSnapshotId ? `已定位到历史价格管理：${target.name}（目标点位已高亮）` : `已定位到历史价格管理：${target.name}`);
  }, [focusItemId, focusSnapshotId, focusNonce, classifiedItems]);

  useEffect(() => {
    if (!highlightSnapshotId) {
      return;
    }
    const timer = window.setTimeout(() => {
      const container = historyTableContainerRef.current;
      if (!container) {
        return;
      }
      const row = container.querySelector<HTMLTableRowElement>(`#workshop-price-row-${highlightSnapshotId}`);
      if (!row) {
        return;
      }
      const rowTop = row.offsetTop;
      const targetTop = Math.max(0, rowTop - (container.clientHeight - row.clientHeight) / 2);
      container.scrollTo({ top: targetTop, behavior: "smooth" });
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightSnapshotId, rows]);

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const next = await workshopActions.getWorkshopState();
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "历史价格加载失败");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSnapshot(snapshotId: string, itemName: string, capturedAt: string): Promise<void> {
    const confirmed = window.confirm(`删除价格记录「${itemName} @ ${new Date(capturedAt).toLocaleString()}」？`);
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await workshopActions.deleteWorkshopPriceSnapshot(snapshotId);
      setState(next);
      if (highlightSnapshotId === snapshotId) {
        setHighlightSnapshotId(null);
      }
      setMessage(`已删除价格记录: ${itemName}`);
      onPriceDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除价格记录失败");
    } finally {
      setBusy(false);
    }
  }

  async function onClearAllSnapshots(): Promise<void> {
    const count = state?.prices.length ?? 0;
    if (count <= 0) {
      return;
    }
    const confirmed = window.confirm(`确认清空全部历史价格记录？当前共 ${count} 条，清空后不可恢复。`);
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await workshopActions.clearAllWorkshopPriceSnapshots();
      setState(next);
      setHighlightSnapshotId(null);
      setMessage("已清空全部历史价格记录");
      onPriceDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空历史价格失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide">历史价格管理</h3>
        <div className="flex items-center gap-2">
          <button
            className="pill-btn text-rose-300"
            onClick={() => void onClearAllSnapshots()}
            disabled={busy || (state?.prices.length ?? 0) <= 0}
          >
            一键清空全部
          </button>
          <button className="pill-btn" onClick={() => void refresh()} disabled={busy}>
            刷新
          </button>
        </div>
      </div>
      <p className="mt-2 summary-note">用于误操作修正。删除后会立即影响行情与制作模拟。</p>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <select
          className="field-control-sm min-w-0"
          value={mainCategory}
          onChange={(event) => setMainCategory(event.target.value)}
          disabled={busy}
        >
          <option value="all">大类: 全部</option>
          {mainCategoryOptions.map((item) => (
            <option key={`workshop-price-main-${item}`} value={item}>
              大类: {item}
            </option>
          ))}
        </select>
        <select
          className="field-control-sm min-w-0"
          value={subCategory}
          onChange={(event) => setSubCategory(event.target.value)}
          disabled={busy}
        >
          <option value="all">下级分类: 全部</option>
          {subCategoryOptions.map((item) => (
            <option key={`workshop-price-sub-${item}`} value={item}>
              下级分类: {item}
            </option>
          ))}
        </select>
        <select
          className="field-control-sm min-w-0"
          value={selectedItemId}
          onChange={(event) => setSelectedItemId(event.target.value)}
          disabled={busy}
        >
          <option value="all">全部物品</option>
          {itemOptions.map((item) => (
            <option key={`workshop-price-manage-item-${item.id}`} value={item.id}>
              [{item.mainCategory}/{item.subCategory}] {item.name}
            </option>
          ))}
        </select>
        <input
          className="field-control-sm min-w-0"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          disabled={busy}
          placeholder="按物品名搜索（可选）"
        />
        <input
          className="field-control-sm min-w-0"
          value={limitInput}
          onChange={(event) => setLimitInput(event.target.value)}
          disabled={busy}
          placeholder="显示条数 20-500"
        />
      </div>

      <p className="mt-2 summary-note">当前显示最近 {limit} 条。</p>
      {message ? <p className="banner-positive mt-1 rounded-xl px-3 py-2 text-xs">{message}</p> : null}
      {error ? <p className="banner-danger mt-1 rounded-xl px-3 py-2 text-xs">{error}</p> : null}

      <div ref={historyTableContainerRef} className="tool-table-wrap mt-3 max-h-72">
        {rows.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-500">暂无可管理的价格快照。</p>
        ) : (
          <table className="tool-table">
            <thead>
              <tr>
                <th>物品</th>
                <th>分类</th>
                <th>价格</th>
                <th>市场</th>
                <th>时间</th>
                <th>来源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  id={`workshop-price-row-${row.id}`}
                  key={`workshop-price-manage-${row.id}`}
                  className={highlightSnapshotId === row.id ? "bg-[rgba(15,143,111,0.10)]" : ""}
                >
                  <td>{row.itemName}</td>
                  <td>{`${row.mainCategory}/${row.subCategory}`}</td>
                  <td className={isSuspectPriceNote(row.note) ? "tone-danger" : ""}>
                    {formatGold(row.unitPrice)}
                    {isSuspectPriceNote(row.note) ? "（可疑）" : ""}
                  </td>
                  <td>{formatMarketLabel(row.market)}</td>
                  <td>{new Date(row.capturedAt).toLocaleString()}</td>
                  <td>{row.source === "import" ? "导入" : "手动"}</td>
                  <td>
                    <button
                      className="pill-btn"
                      onClick={() => void onDeleteSnapshot(row.id, row.itemName, row.capturedAt)}
                      disabled={busy}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </article>
  );
}

