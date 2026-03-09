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
          <p className="panel-subtitle">围绕一次制作决策组织信息，价格、库存、历史和模拟结果都在同一上下文里同步。</p>
        </div>
        <span className="pill-btn pill-static">制作主流程</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <div className="metric-card p-4">物品数: {state.items.length}</div>
        <div className="metric-card p-4">配方数: {state.recipes.length}</div>
        <div className="metric-card p-4">价格快照: {state.prices.length}</div>
        <div className="metric-card p-4">库存记录: {state.inventory.length}</div>
        <div className="metric-card p-4 text-amber-200">重点关注: {starCount}</div>
      </div>
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
