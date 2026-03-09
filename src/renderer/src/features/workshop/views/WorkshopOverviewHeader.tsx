import type { WorkshopState } from "../../../../../shared/types";

interface WorkshopOverviewHeaderProps {
  state: WorkshopState;
  starCount: number;
  message: string | null;
  error: string | null;
}

export function WorkshopOverviewHeader(props: WorkshopOverviewHeaderProps): JSX.Element {
  const { state, starCount, message, error } = props;

  return (
    <article className="hero-strip rounded-[30px] p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="panel-kicker">Workshop</p>
          <h3 className="panel-title !text-[1.2rem]">工坊（内置配方库）</h3>
          <p className="panel-subtitle">默认只保留装备制作主流程，抓价、市场分析、历史价格和库存修正全部进入展开区。</p>
        </div>
        <span className="pill-btn pill-static">制作主流程</span>
      </div>
      <p className="mt-4 summary-note">
        {state.items.length} 个物品 · {state.recipes.length} 条配方 · {state.prices.length} 条价格快照 · {state.inventory.length} 条库存记录 · 重点关注 {starCount} 项
      </p>
      {message ? <p className="mt-3 text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
    </article>
  );
}

export function WorkshopLoadingCard(): JSX.Element {
  return (
    <article className="glass-panel rounded-[28px] p-5">
      <p className="text-sm text-slate-300">工坊模块加载中...</p>
    </article>
  );
}
