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
    <header className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <p className="tile-k">可远征角色</p>
        <p className="tile-v">{readyCharacters}</p>
      </article>
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <p className="tile-k">清空奥德预估</p>
        <p className="tile-v">{weeklyGoldText}</p>
      </article>
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <p className="tile-k">每日使命未清</p>
        <p className="tile-v">{pendingDaily} 角色</p>
      </article>
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <p className="tile-k">每周指令未清</p>
        <p className="tile-v">{pendingWeekly} 角色</p>
      </article>
    </header>
  );
}
