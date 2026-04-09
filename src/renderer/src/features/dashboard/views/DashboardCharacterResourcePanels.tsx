import {
  ABYSS_REPLENISH_TICKET_SERVER_LIMIT,
  AODE_CONVERT_SERVER_LIMIT,
  AODE_POINT_PER_OPERATION,
  AODE_SHOP_SERVER_LIMIT,
  EXPEDITION_CHOICE_BOX_SERVER_LIMIT,
  NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT,
  UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT,
} from "../../../../../shared/constants";
import { getTotalEnergy } from "../../../../../shared/engine";
import type { CharacterState } from "../../../../../shared/types";
import { buildCountOptions } from "../dashboard-utils";

interface DashboardCharacterResourcePanelsProps {
  busy: boolean;
  selected: CharacterState;
  onOpenEnergyDialog: () => void;
  selectedAodeLimits: {
    purchaseLimit: number;
    convertLimit: number;
  };
  selectedIsAodeExtra: boolean;
  selectedAccountExtraCharacterName: string | null;
  selectedShopAodePurchaseRemaining: number;
  selectedShopDailyDungeonTicketPurchaseRemaining: number;
  selectedShopExpeditionChoiceBoxRemaining: number;
  selectedShopNightmareInstantRemaining: number;
  selectedShopAbyssReplenishRemaining: number;
  selectedTransformAodeRemaining: number;
  shopAodePurchaseUsedInput: string;
  shopUnknownChallengeTicketUsedInput: string;
  shopExpeditionChoiceBoxUsedInput: string;
  shopNightmareInstantUsedInput: string;
  shopAbyssReplenishUsedInput: string;
  transformAodeUsedInput: string;
  onShopAodePurchaseUsedInputChange: (value: string) => void;
  onShopUnknownChallengeTicketUsedInputChange: (value: string) => void;
  onShopExpeditionChoiceBoxUsedInputChange: (value: string) => void;
  onShopNightmareInstantUsedInputChange: (value: string) => void;
  onShopAbyssReplenishUsedInputChange: (value: string) => void;
  onTransformAodeUsedInputChange: (value: string) => void;
  onSaveShopPlan: () => void;
  onSaveTransformPlan: () => void;
}

export function DashboardCharacterResourcePanels(props: DashboardCharacterResourcePanelsProps): JSX.Element {
  const {
    busy,
    selected,
    onOpenEnergyDialog,
    selectedShopAodePurchaseRemaining,
    selectedShopDailyDungeonTicketPurchaseRemaining,
    selectedShopExpeditionChoiceBoxRemaining,
    selectedShopNightmareInstantRemaining,
    selectedShopAbyssReplenishRemaining,
    selectedTransformAodeRemaining,
    shopAodePurchaseUsedInput,
    shopUnknownChallengeTicketUsedInput,
    shopExpeditionChoiceBoxUsedInput,
    shopNightmareInstantUsedInput,
    shopAbyssReplenishUsedInput,
    transformAodeUsedInput,
    onShopAodePurchaseUsedInputChange,
    onShopUnknownChallengeTicketUsedInputChange,
    onShopExpeditionChoiceBoxUsedInputChange,
    onShopNightmareInstantUsedInputChange,
    onShopAbyssReplenishUsedInputChange,
    onTransformAodeUsedInputChange,
    onSaveShopPlan,
    onSaveTransformPlan,
  } = props;

  return (
    <div className="mt-2.5 space-y-2.5">
      <section className="toolbar-card">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)] xl:items-center">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="panel-kicker !tracking-[0.08em]">Energy</p>
                <h3 className="panel-title !mt-1 !text-sm">奥德能量</h3>
              </div>
              <span className="summary-note">
                {selected.energy.baseCurrent}(+{selected.energy.bonusCurrent})/{selected.energy.baseCap}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.06)]">
              <div
                className="flex h-full"
                style={{
                  width: `${(getTotalEnergy(selected) / (selected.energy.baseCap + selected.energy.bonusCap)) * 100}%`,
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-cyan-300"
                  style={{
                    width: `${(selected.energy.baseCurrent / Math.max(1, getTotalEnergy(selected))) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-gradient-to-r from-amber-300 to-orange-400"
                  style={{
                    width: `${(selected.energy.bonusCurrent / Math.max(1, getTotalEnergy(selected))) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="toolbar-meta mt-1 summary-note">
              <span>基础优先扣除</span>
              <span>补充能量兜底</span>
            </div>
          </div>

          <div className="toolbar-actions xl:justify-end">
            <div className="data-pill !px-2.5 !py-1.5 !text-xs">基础 {selected.energy.baseCurrent}/{selected.energy.baseCap}</div>
            <div className="data-pill !px-2.5 !py-1.5 !text-xs">补充 {selected.energy.bonusCurrent}/{selected.energy.bonusCap}</div>
            <button className="task-btn task-btn-soft task-btn-compact px-4" onClick={onOpenEnergyDialog} disabled={busy}>
              调整能量
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="toolbar-card h-full">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Breeze Shop</p>
            <h3 className="panel-title !mt-1 !text-sm">微风商店记录</h3>
          </div>
          <p className="summary-note mt-1">按伺服器统一上限记录本周已购买数量，切角色时显示的是同一份记录。</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-500">奥德能量(刻印) 剩余 {selectedShopAodePurchaseRemaining}/{AODE_SHOP_SERVER_LIMIT}</span>
              <select className="field-control" value={shopAodePurchaseUsedInput} onChange={(event) => onShopAodePurchaseUsedInputChange(event.target.value)} disabled={busy}>
                {buildCountOptions(0, AODE_SHOP_SERVER_LIMIT, shopAodePurchaseUsedInput).map((value) => (
                  <option key={`shop-aode-${value}`} value={value}>奥德能量(刻印) 已购 {value}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">未知键队挑战券(刻印) 剩余 {selectedShopDailyDungeonTicketPurchaseRemaining}/{UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT}</span>
              <select className="field-control" value={shopUnknownChallengeTicketUsedInput} onChange={(event) => onShopUnknownChallengeTicketUsedInputChange(event.target.value)} disabled={busy}>
                {buildCountOptions(0, UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT, shopUnknownChallengeTicketUsedInput).map((value) => (
                  <option key={`shop-unknown-${value}`} value={value}>未知键队挑战券 已购 {value}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">远征/超越挑战券选择箱 剩余 {selectedShopExpeditionChoiceBoxRemaining}/{EXPEDITION_CHOICE_BOX_SERVER_LIMIT}</span>
              <select className="field-control" value={shopExpeditionChoiceBoxUsedInput} onChange={(event) => onShopExpeditionChoiceBoxUsedInputChange(event.target.value)} disabled={busy}>
                {buildCountOptions(0, EXPEDITION_CHOICE_BOX_SERVER_LIMIT, shopExpeditionChoiceBoxUsedInput).map((value) => (
                  <option key={`shop-expedition-box-${value}`} value={value}>远征/超越箱 已购 {value}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">立即完成券: 恶梦 剩余 {selectedShopNightmareInstantRemaining}/{NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT}</span>
              <select className="field-control" value={shopNightmareInstantUsedInput} onChange={(event) => onShopNightmareInstantUsedInputChange(event.target.value)} disabled={busy}>
                {buildCountOptions(0, NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT, shopNightmareInstantUsedInput).map((value) => (
                  <option key={`shop-nightmare-${value}`} value={value}>恶梦完成券 已购 {value}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-500">深渊重镇补充券(刻印) 剩余 {selectedShopAbyssReplenishRemaining}/{ABYSS_REPLENISH_TICKET_SERVER_LIMIT}</span>
              <select className="field-control" value={shopAbyssReplenishUsedInput} onChange={(event) => onShopAbyssReplenishUsedInputChange(event.target.value)} disabled={busy}>
                {buildCountOptions(0, ABYSS_REPLENISH_TICKET_SERVER_LIMIT, shopAbyssReplenishUsedInput).map((value) => (
                  <option key={`shop-abyss-${value}`} value={value}>深渊重镇补充券 已购 {value}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button className="task-btn task-btn-soft task-btn-compact px-4" onClick={onSaveShopPlan} disabled={busy}>
              保存微风记录
            </button>
          </div>
        </section>

        <section className="toolbar-card h-full">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Convert</p>
            <h3 className="panel-title !mt-1 !text-sm">奥德兑换记录</h3>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="toolbar-meta task-meta-line">
              <span>已用 {selected.aodePlan.transformAodeUsed}/{AODE_CONVERT_SERVER_LIMIT}</span>
              <span>剩余 {selectedTransformAodeRemaining}</span>
              <span>单次 {AODE_POINT_PER_OPERATION} 奥德</span>
            </div>
            <div className="toolbar-actions">
              <div className="data-pill !px-2.5 !py-1.5 !text-xs">伺服器每周 {AODE_CONVERT_SERVER_LIMIT} 次</div>
            </div>
          </div>
          <div className="toolbar-grid mt-2.5 md:grid-cols-[minmax(0,0.9fr)_auto]">
            <select
              className="field-control"
              value={transformAodeUsedInput}
              onChange={(event) => onTransformAodeUsedInputChange(event.target.value)}
              disabled={busy}
            >
              {buildCountOptions(0, AODE_CONVERT_SERVER_LIMIT, transformAodeUsedInput).map((value) => (
                <option key={`transform-aode-${value}`} value={value}>
                  兑换次数 {value}
                </option>
              ))}
            </select>
            <button className="task-btn task-btn-soft task-btn-compact px-4" onClick={onSaveTransformPlan} disabled={busy}>
              保存兑换记录
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
