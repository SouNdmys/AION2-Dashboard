import type { WorkshopState } from "../../../../../shared/types";
import { toInt } from "../workshop-view-helpers";

type WorkshopActions = NonNullable<Window["aionApi"]>;
type CommitRunner = (action: () => Promise<WorkshopState>, successText: string) => Promise<void>;

interface CreateWorkshopSignalHandlersParams {
  signalLookbackDaysInput: string;
  signalThresholdPercentInput: string;
  signalRuleEnabled: boolean;
  workshopActions: WorkshopActions;
  commit: CommitRunner;
  loadSignals: () => Promise<void>;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
}

interface WorkshopSignalHandlers {
  onSaveSignalRule: () => Promise<void>;
  onRefreshSignals: () => Promise<void>;
}

export function createWorkshopSignalHandlers(params: CreateWorkshopSignalHandlersParams): WorkshopSignalHandlers {
  const {
    signalLookbackDaysInput,
    signalThresholdPercentInput,
    signalRuleEnabled,
    workshopActions,
    commit,
    loadSignals,
    setBusy,
    setError,
    setMessage,
  } = params;

  async function onSaveSignalRule(): Promise<void> {
    const lookbackDays = toInt(signalLookbackDaysInput);
    if (lookbackDays === null || lookbackDays <= 0) {
      setError("周期性波动提示配置失败：回看天数必须是正整数。");
      return;
    }
    const thresholdPercent = Number(signalThresholdPercentInput);
    if (!Number.isFinite(thresholdPercent) || thresholdPercent < 15) {
      setError("周期性波动提示配置失败：阈值必须是 >= 15 的数字。");
      return;
    }

    await commit(
      () =>
        workshopActions.updateWorkshopSignalRule({
          enabled: signalRuleEnabled,
          lookbackDays,
          dropBelowWeekdayAverageRatio: thresholdPercent / 100,
        }),
      "周期性波动提示规则已保存",
    );
  }

  async function onRefreshSignals(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await loadSignals();
      setMessage("周期性波动提示已刷新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "周期性波动提示刷新失败");
    } finally {
      setBusy(false);
    }
  }

  return {
    onSaveSignalRule,
    onRefreshSignals,
  };
}
