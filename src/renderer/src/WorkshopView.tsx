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
      <WorkshopSimulationPanel {...simulationPanelProps} />
      <WorkshopOcrPanel {...ocrPanelProps} />
      <WorkshopMarketAnalysisPanel {...marketAnalysisPanelProps} />
      <WorkshopInventoryPanel {...inventoryPanelProps} />
    </div>
  );
}
