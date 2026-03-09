interface DashboardOverviewSummaryCardsProps {
  visible: boolean;
  readyCharacters: number;
  weeklyGoldText: string;
  pendingDaily: number;
  pendingWeekly: number;
}

export function DashboardOverviewSummaryCards(props: DashboardOverviewSummaryCardsProps): JSX.Element | null {
  const { visible, readyCharacters, weeklyGoldText, pendingDaily, pendingWeekly } = props;
  if (!visible) {
    return null;
  }

  return (
    <header className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
      <article className="metric-card p-5">
        <p className="tile-k">可远征角色</p>
        <p className="tile-v !text-[1.45rem]">{readyCharacters}</p>
      </article>
      <article className="metric-card p-5">
        <p className="tile-k">清空奥德预估</p>
        <p className="tile-v !text-[1.45rem]">{weeklyGoldText}</p>
      </article>
      <article className="metric-card p-5">
        <p className="tile-k">每日使命未清</p>
        <p className="tile-v !text-[1.45rem]">{pendingDaily} 角色</p>
      </article>
      <article className="metric-card p-5">
        <p className="tile-k">每周指令未清</p>
        <p className="tile-v !text-[1.45rem]">{pendingWeekly} 角色</p>
      </article>
    </header>
  );
}
