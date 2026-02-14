import { useEffect, useMemo, useState } from "react";
import type { WorkshopItemCategory, WorkshopState } from "../../shared/types";

const goldFormatter = new Intl.NumberFormat("zh-CN");

function formatGold(value: number): string {
  return goldFormatter.format(Math.floor(value));
}

function toInt(raw: string): number | null {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

const CATEGORY_SUB_ORDER = [
  "巨劍",
  "長劍",
  "短劍",
  "釘錘",
  "弓",
  "法杖",
  "法書",
  "法珠",
  "臂甲",
  "頭盔",
  "肩甲",
  "上衣",
  "下衣",
  "手套",
  "鞋子",
  "披風",
  "項鍊",
  "耳環",
  "戒指",
  "手鐲",
  "藥水",
  "咒文書",
  "魔石",
  "材料",
] as const;

function parseItemRawCategory(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/分類:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

function parseItemSourceTag(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/來源:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

function parseItemMainCategory(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/大類:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

function normalizeMainCategoryLabel(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (value === "铁匠") return "鐵匠";
  if (value === "手工艺") return "手工藝";
  if (value === "采集材料") return "採集材料";
  if (value === "炼金") return "煉金";
  return value;
}

function inferRecipeMainCategory(sourceTag: string): string {
  const normalized = sourceTag.replace(/\.md$/iu, "").trim();
  if (!normalized) {
    return "未分類";
  }
  const parts = normalized.split(/[、,，\s]+/u).map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

function inferMainCategoryByContext(
  explicitMainCategory: string,
  sourceTag: string,
  subCategory: string,
  rawCategory: string,
  itemName: string,
): string {
  const normalizedExplicitMainCategory = normalizeMainCategoryLabel(explicitMainCategory);
  if (normalizedExplicitMainCategory) {
    return normalizedExplicitMainCategory;
  }
  const text = `${rawCategory} ${itemName}`;
  if (
    subCategory === "臂甲" ||
    subCategory === "頭盔" ||
    subCategory === "肩甲" ||
    subCategory === "上衣" ||
    subCategory === "下衣" ||
    subCategory === "手套" ||
    subCategory === "鞋子" ||
    subCategory === "披風" ||
    text.includes("防具") ||
    text.includes("盔甲")
  ) {
    return "盔甲";
  }
  if (
    subCategory === "弓" ||
    subCategory === "法杖" ||
    subCategory === "法書" ||
    subCategory === "法珠" ||
    subCategory === "項鍊" ||
    subCategory === "耳環" ||
    subCategory === "戒指" ||
    subCategory === "手鐲" ||
    subCategory === "藥水" ||
    subCategory === "咒文書" ||
    subCategory === "魔石" ||
    text.includes("飾品")
  ) {
    if (subCategory === "藥水" || subCategory === "咒文書" || subCategory === "魔石" || text.includes("消耗品")) {
      return "煉金";
    }
    return "手工藝";
  }
  if (subCategory === "巨劍" || subCategory === "長劍" || subCategory === "短劍" || subCategory === "釘錘") {
    return "鐵匠";
  }
  return inferRecipeMainCategory(sourceTag);
}

function inferRecipeSubCategory(rawCategory: string, itemName: string, itemCategory: WorkshopItemCategory): string {
  const text = `${rawCategory} ${itemName}`;
  if (text.includes("巨劍") || text.includes("巨剑")) return "巨劍";
  if (text.includes("長劍") || text.includes("长剑")) return "長劍";
  if (text.includes("短劍") || text.includes("短剑")) return "短劍";
  if (text.includes("釘錘") || text.includes("钉锤")) return "釘錘";
  if (text.includes("弓")) return "弓";
  if (text.includes("法杖")) return "法杖";
  if (text.includes("法書") || text.includes("法书")) return "法書";
  if (text.includes("法珠")) return "法珠";
  if (text.includes("臂甲")) return "臂甲";
  if (text.includes("頭盔") || text.includes("头盔")) return "頭盔";
  if (text.includes("肩甲")) return "肩甲";
  if (text.includes("上衣") || text.includes("胸甲")) return "上衣";
  if (text.includes("下衣") || text.includes("腿甲")) return "下衣";
  if (text.includes("手套")) return "手套";
  if (text.includes("鞋子") || text.includes("長靴") || text.includes("长靴") || text.includes("靴")) return "鞋子";
  if (text.includes("披風") || text.includes("披风")) return "披風";
  if (text.includes("項鍊") || text.includes("项链")) return "項鍊";
  if (text.includes("耳環") || text.includes("耳环")) return "耳環";
  if (text.includes("戒指")) return "戒指";
  if (text.includes("手鐲") || text.includes("手镯")) return "手鐲";
  if (text.includes("藥水") || text.includes("药水") || text.includes("祕藥") || text.includes("秘药")) return "藥水";
  if (text.includes("咒文書") || text.includes("咒文书")) return "咒文書";
  if (text.includes("魔石") || text.includes("靈石") || text.includes("灵石")) return "魔石";
  if (
    text.includes("材料") ||
    text.includes("消耗") ||
    text.includes("採集") ||
    text.includes("采集") ||
    itemCategory === "material" ||
    itemCategory === "component"
  ) {
    return "材料";
  }
  return "其他";
}

function sortCategoryText(left: string, right: string): number {
  const leftIndex = CATEGORY_SUB_ORDER.indexOf(left as (typeof CATEGORY_SUB_ORDER)[number]);
  const rightIndex = CATEGORY_SUB_ORDER.indexOf(right as (typeof CATEGORY_SUB_ORDER)[number]);
  if (leftIndex >= 0 || rightIndex >= 0) {
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  }
  if (left === "其他") return 1;
  if (right === "其他") return -1;
  return left.localeCompare(right, "zh-CN");
}

function sortMainCategoryText(left: string, right: string): number {
  if (left === "鐵匠" && right !== "鐵匠") return -1;
  if (right === "鐵匠" && left !== "鐵匠") return 1;
  return left.localeCompare(right, "zh-CN");
}

export function WorkshopSidebarHistoryCard(): JSX.Element {
  const [state, setState] = useState<WorkshopState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mainCategory, setMainCategory] = useState<"all" | string>("all");
  const [subCategory, setSubCategory] = useState<"all" | string>("all");
  const [selectedItemId, setSelectedItemId] = useState<"all" | string>("all");
  const [keyword, setKeyword] = useState("");
  const [limitInput, setLimitInput] = useState("120");

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

    return sorted.slice(0, limit);
  }, [state, itemMetaById, mainCategory, subCategory, selectedItemId, keyword, limit]);

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

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const next = await window.aionApi.getWorkshopState();
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
      const next = await window.aionApi.deleteWorkshopPriceSnapshot(snapshotId);
      setState(next);
      setMessage(`已删除价格记录: ${itemName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除价格记录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide">历史价格管理</h3>
        <button className="pill-btn" onClick={() => void refresh()} disabled={busy}>
          刷新
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-300">用于误操作修正。删除后会立即影响行情与制作模拟。</p>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <select
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
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
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
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
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
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
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          disabled={busy}
          placeholder="按物品名搜索（可选）"
        />
        <input
          className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={limitInput}
          onChange={(event) => setLimitInput(event.target.value)}
          disabled={busy}
          placeholder="显示条数 20-500"
        />
      </div>

      <p className="mt-2 text-xs text-slate-300">当前显示最近 {limit} 条。</p>
      {message ? <p className="mt-1 text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}

      <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/20">
        {rows.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-300">暂无可管理的价格快照。</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-2 py-2">物品</th>
                <th className="px-2 py-2">分类</th>
                <th className="px-2 py-2">价格</th>
                <th className="px-2 py-2">时间</th>
                <th className="px-2 py-2">来源</th>
                <th className="px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`workshop-price-manage-${row.id}`} className="border-t border-white/10">
                  <td className="px-2 py-2">{row.itemName}</td>
                  <td className="px-2 py-2">{`${row.mainCategory}/${row.subCategory}`}</td>
                  <td className="px-2 py-2">{formatGold(row.unitPrice)}</td>
                  <td className="px-2 py-2">{new Date(row.capturedAt).toLocaleString()}</td>
                  <td className="px-2 py-2">{row.source === "import" ? "导入" : "手动"}</td>
                  <td className="px-2 py-2">
                    <button
                      className="pill-btn text-rose-300"
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
