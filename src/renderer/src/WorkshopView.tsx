import { useId } from "react";
import { useWorkshopViewModel } from "./features/workshop/hooks/useWorkshopViewModel";
import { WorkshopInventoryPanel } from "./features/workshop/views/WorkshopInventoryPanel";
import { WorkshopLoadingCard, WorkshopOverviewHeader } from "./features/workshop/views/WorkshopOverviewHeader";
import { WorkshopMarketAnalysisPanel } from "./features/workshop/views/WorkshopMarketAnalysisPanel";
import { WorkshopOcrPanel } from "./features/workshop/views/WorkshopOcrPanel";
import { WorkshopSimulationPanel } from "./features/workshop/views/WorkshopSimulationPanel";

interface WorkshopViewProps {
  onJumpToHistoryManager?: (payload: { itemId: string; snapshotId?: string }) => void;
  externalPriceChangeNonce?: number;
}

export function WorkshopView(props: WorkshopViewProps = {}): JSX.Element {
  const { onJumpToHistoryManager, externalPriceChangeNonce = 0 } = props;
  const expertModeId = useId();
  const { state, starCount, message, error, ocrPanelProps, marketAnalysisPanelProps, simulationPanelProps, inventoryPanelProps } =
    useWorkshopViewModel({
      onJumpToHistoryManager,
      externalPriceChangeNonce,
    });

  if (!state) {
    return <WorkshopLoadingCard />;
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkshopOverviewHeader state={state} starCount={starCount} message={message} error={error} />
      <section className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">快捷模式</h4>
            <p className="mt-1 text-xs text-slate-300">默认按“选配方 → 抓价格 → 看结论”组织，先完成一次制作决策，再决定是否进入高级设置。</p>
          </div>
          <span className="pill-btn !border-cyan-300/35 !text-cyan-100">默认入口</span>
        </div>
      </section>
      <WorkshopSimulationPanel {...simulationPanelProps} />
      <WorkshopOcrPanel {...ocrPanelProps} />
      <WorkshopMarketAnalysisPanel {...marketAnalysisPanelProps} />
      <details className="group rounded-2xl">
        <summary
          aria-controls={expertModeId}
          className="details-summary glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150"
        >
          <div>
            <h4 className="text-sm font-semibold">专业模式</h4>
            <p className="mt-1 text-xs text-slate-300">库存修正、逆向推荐和批量维护收进这里，避免默认首屏被管理型操作占满。</p>
          </div>
          <span className="pill-btn !border-white/15 !text-slate-200 group-open:!border-cyan-300/35 group-open:!text-cyan-100">
            <span className="group-open:hidden">展开高级区</span>
            <span className="hidden group-open:inline">收起高级区</span>
          </span>
        </summary>
        <div id={expertModeId} className="mt-4">
          <WorkshopInventoryPanel {...inventoryPanelProps} />
        </div>
      </details>
    </div>
  );
}
