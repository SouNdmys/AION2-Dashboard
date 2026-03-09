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
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="panel-kicker">Workshop</p>
          <h3 className="panel-title">工坊（内置配方库）</h3>
          <p className="panel-subtitle">已支持内置材料/配方库、价格与库存维护、制作模拟和背包可制作推荐。</p>
        </div>
        <span className="pill-btn pill-static !border-cyan-300/35 !text-cyan-100">制作主流程</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
        <div className="data-pill">物品数: {state.items.length}</div>
        <div className="data-pill">配方数: {state.recipes.length}</div>
        <div className="data-pill">价格快照: {state.prices.length}</div>
        <div className="data-pill">库存记录: {state.inventory.length}</div>
        <div className="data-pill text-amber-200">重点关注: {starCount}</div>
      </div>
      {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </article>
  );
}

export function WorkshopLoadingCard(): JSX.Element {
  return (
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <p className="text-sm text-slate-300">工坊模块加载中...</p>
    </article>
  );
}
