import { useId } from "react";
import { WorkshopSidebarHistoryCard } from "./WorkshopSidebarHistoryCard";
import { useWorkshopViewModel } from "./features/workshop/hooks/useWorkshopViewModel";
import { WorkshopInventoryPanel } from "./features/workshop/views/WorkshopInventoryPanel";
import { WorkshopLoadingCard } from "./features/workshop/views/WorkshopOverviewHeader";
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
  const { state, message, error, ocrPanelProps, marketAnalysisPanelProps, simulationPanelProps, inventoryPanelProps } =
    useWorkshopViewModel({
      onJumpToHistoryManager,
      externalPriceChangeNonce,
    });

  if (!state) {
    return <WorkshopLoadingCard />;
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkshopSimulationPanel {...simulationPanelProps} message={message} error={error} />
      <details className="order-2 group">
        <summary aria-controls={expertModeId} className="details-summary workbench-panel px-4 py-3">
          <div className="min-w-0">
            <p className="panel-kicker">Market Tools</p>
            <h4 className="panel-title !mt-1 !text-sm">市场工具</h4>
            <p className="summary-note mt-1">OCR 抓价、市场分析、历史价格和库存都后撤到这里，默认不打断做装主流程。</p>
          </div>
          <span className="pill-btn group-open:!border-slate-900/10 group-open:!bg-slate-900/6 group-open:!text-slate-900">
            <span className="group-open:hidden">展开工具</span>
            <span className="hidden group-open:inline">收起工具</span>
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
