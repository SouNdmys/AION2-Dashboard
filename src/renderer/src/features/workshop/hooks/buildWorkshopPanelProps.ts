import type { ComponentProps } from "react";
import type { WorkshopPriceHistoryResult } from "../../../../../shared/types";
import type { HistoryInsightModel } from "../workshop-view-helpers";
import { WorkshopInventoryPanel } from "../views/WorkshopInventoryPanel";
import { WorkshopMarketAnalysisPanel } from "../views/WorkshopMarketAnalysisPanel";
import { WorkshopOcrPanel } from "../views/WorkshopOcrPanel";
import { WorkshopSimulationPanel } from "../views/WorkshopSimulationPanel";

interface BuildWorkshopPanelPropsParams {
  ocrPanelProps: Omit<ComponentProps<typeof WorkshopOcrPanel>, "busy">;
  marketAnalysisPanelProps: Omit<
    ComponentProps<typeof WorkshopMarketAnalysisPanel>,
    "busy" | "historyMarketPanels" | "historyServerResult" | "historyWorldResult"
  > & {
    historyServerResult: WorkshopPriceHistoryResult | null;
    historyWorldResult: WorkshopPriceHistoryResult | null;
    historyServerInsight: HistoryInsightModel | null;
    historyWorldInsight: HistoryInsightModel | null;
  };
  simulationPanelProps: Omit<ComponentProps<typeof WorkshopSimulationPanel>, "busy">;
  inventoryPanelProps: Omit<ComponentProps<typeof WorkshopInventoryPanel>, "busy">;
  busy: boolean;
}

interface WorkshopPanelPropsBundle {
  ocrPanelProps: ComponentProps<typeof WorkshopOcrPanel>;
  marketAnalysisPanelProps: ComponentProps<typeof WorkshopMarketAnalysisPanel>;
  simulationPanelProps: ComponentProps<typeof WorkshopSimulationPanel>;
  inventoryPanelProps: ComponentProps<typeof WorkshopInventoryPanel>;
}

export function buildWorkshopPanelProps(params: BuildWorkshopPanelPropsParams): WorkshopPanelPropsBundle {
  const { ocrPanelProps, marketAnalysisPanelProps, simulationPanelProps, inventoryPanelProps, busy } = params;
  const historyMarketPanels: ComponentProps<typeof WorkshopMarketAnalysisPanel>["historyMarketPanels"] = [
    {
      market: "server",
      title: "伺服器交易所",
      result: marketAnalysisPanelProps.historyServerResult,
      insight: marketAnalysisPanelProps.historyServerInsight,
      colorClass: "text-cyan-200",
      borderClass: "border-cyan-300/20 bg-cyan-500/5",
    },
    {
      market: "world",
      title: "世界交易所",
      result: marketAnalysisPanelProps.historyWorldResult,
      insight: marketAnalysisPanelProps.historyWorldInsight,
      colorClass: "text-emerald-200",
      borderClass: "border-emerald-300/20 bg-emerald-500/5",
    },
  ];

  const {
    historyServerResult,
    historyWorldResult,
    historyServerInsight,
    historyWorldInsight,
    ...restMarketProps
  } = marketAnalysisPanelProps;

  return {
    ocrPanelProps: {
      ...ocrPanelProps,
      busy,
    },
    marketAnalysisPanelProps: {
      ...restMarketProps,
      busy,
      historyServerResult,
      historyWorldResult,
      historyMarketPanels,
    },
    simulationPanelProps: {
      ...simulationPanelProps,
      busy,
    },
    inventoryPanelProps: {
      ...inventoryPanelProps,
      busy,
    },
  };
}
