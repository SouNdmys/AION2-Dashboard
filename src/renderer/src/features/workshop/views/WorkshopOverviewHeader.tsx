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
          <h3 className="panel-title !text-[1.2rem]">装备制作工作台</h3>
          <p className="panel-subtitle">默认只回答一件事: 这件装备现在值不值得做。抓价、市场分析和历史管理全部后撤到专业工具。</p>
        </div>
        <span className="pill-btn pill-static">单任务视图</span>
      </div>
      <p className="mt-4 inline-note">
        当前配方库 {state.recipes.length} 条，重点关注 {starCount} 项。其余库存、历史价格和 OCR 抓价只在你需要时展开。
      </p>
      {message ? <p className="banner-positive mt-3 rounded-xl px-3 py-2 text-xs">{message}</p> : null}
      {error ? <p className="banner-danger mt-3 rounded-xl px-3 py-2 text-xs">{error}</p> : null}
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
