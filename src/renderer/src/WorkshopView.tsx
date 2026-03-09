import { useId } from "react";
import { WorkshopSidebarHistoryCard } from "./WorkshopSidebarHistoryCard";
import { useWorkshopViewModel } from "./features/workshop/hooks/useWorkshopViewModel";
import { WorkshopInventoryPanel } from "./features/workshop/views/WorkshopInventoryPanel";
import { WorkshopLoadingCard, WorkshopOverviewHeader } from "./features/workshop/views/WorkshopOverviewHeader";
import { WorkshopMarketAnalysisPanel } from "./features/workshop/views/WorkshopMarketAnalysisPanel";
import { WorkshopOcrPanel } from "./features/workshop/views/WorkshopOcrPanel";
import { WorkshopSimulationPanel } from "./features/workshop/views/WorkshopSimulationPanel";

interface WorkshopViewProps {
  onJumpToHistoryManager?: (payload: { itemId: string; snapshotId?: string }) => void;
  externalPriceChangeNonce?: number;
  historyFocusItemId?: string | null;
  historyFocusSnapshotId?: string | null;
  historyFocusNonce?: number;
  onPriceDataChanged?: () => void;
}

export function WorkshopView(props: WorkshopViewProps = {}): JSX.Element {
  const {
    onJumpToHistoryManager,
    externalPriceChangeNonce = 0,
    historyFocusItemId = null,
    historyFocusSnapshotId = null,
    historyFocusNonce = 0,
    onPriceDataChanged,
  } = props;
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
    <div className="flex flex-col gap-5">
      <WorkshopOverviewHeader state={state} starCount={starCount} message={message} error={error} />
      <WorkshopSimulationPanel {...simulationPanelProps} />
      <details className="group rounded-[28px]">
        <summary aria-controls={expertModeId} className="details-summary soft-card p-5">
          <div>
            <p className="panel-kicker">Expert Mode</p>
            <h4 className="panel-title !mt-1">专业模式</h4>
            <p className="panel-subtitle">抓价、市场分析、历史价格管理和库存修正全部收进这里，默认首屏只保留装备制作主流程。</p>
          </div>
          <span className="pill-btn group-open:!border-emerald-700/15 group-open:!bg-emerald-700/5 group-open:!text-slate-900">
            <span className="group-open:hidden">展开高级区</span>
            <span className="hidden group-open:inline">收起高级区</span>
          </span>
        </summary>
        <div id={expertModeId} className="mt-4 space-y-4">
          <WorkshopOcrPanel {...ocrPanelProps} />
          <WorkshopMarketAnalysisPanel {...marketAnalysisPanelProps} />
          <WorkshopSidebarHistoryCard
            focusItemId={historyFocusItemId}
            focusSnapshotId={historyFocusSnapshotId}
            focusNonce={historyFocusNonce}
            onPriceDataChanged={onPriceDataChanged}
          />
          <WorkshopInventoryPanel {...inventoryPanelProps} />
        </div>
      </details>
    </div>
  );
}
