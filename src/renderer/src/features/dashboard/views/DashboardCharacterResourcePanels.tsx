import {
  AODE_POINT_PER_OPERATION,
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  AODE_WEEKLY_EXTRA_CONVERT_MAX,
  AODE_WEEKLY_EXTRA_PURCHASE_MAX,
} from "../../../../../shared/constants";
import { getTotalEnergy } from "../../../../../shared/engine";
import type { CharacterState } from "../../../../../shared/types";
import { buildCountOptions } from "../dashboard-utils";

interface DashboardCharacterResourcePanelsProps {
  busy: boolean;
  selected: CharacterState;
  selectedAodeLimits: {
    purchaseLimit: number;
    convertLimit: number;
  };
  selectedIsAodeExtra: boolean;
  selectedAccountExtraCharacterName: string | null;
  selectedShopAodePurchaseRemaining: number;
  selectedShopDailyDungeonTicketPurchaseRemaining: number;
  selectedTransformAodeRemaining: number;
  shopAodePurchaseUsedInput: string;
  shopDailyDungeonTicketPurchaseUsedInput: string;
  transformAodeUsedInput: string;
  onShopAodePurchaseUsedInputChange: (value: string) => void;
  onShopDailyDungeonTicketPurchaseUsedInputChange: (value: string) => void;
  onTransformAodeUsedInputChange: (value: string) => void;
  onSaveShopPlan: () => void;
  onAssignExtraAodeCharacter: (enabled: boolean) => void;
  onSaveTransformPlan: () => void;
}

export function DashboardCharacterResourcePanels(props: DashboardCharacterResourcePanelsProps): JSX.Element {
  const {
    busy,
    selected,
    selectedAodeLimits,
    selectedIsAodeExtra,
    selectedAccountExtraCharacterName,
    selectedShopAodePurchaseRemaining,
    selectedShopDailyDungeonTicketPurchaseRemaining,
    selectedTransformAodeRemaining,
    shopAodePurchaseUsedInput,
    shopDailyDungeonTicketPurchaseUsedInput,
    transformAodeUsedInput,
    onShopAodePurchaseUsedInputChange,
    onShopDailyDungeonTicketPurchaseUsedInputChange,
    onTransformAodeUsedInputChange,
    onSaveShopPlan,
    onAssignExtraAodeCharacter,
    onSaveTransformPlan,
  } = props;

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="section-card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Energy</p>
            <h3 className="panel-title !mt-1 !text-sm">奥德能量</h3>
          </div>
          <span className="summary-note">
            {selected.energy.baseCurrent}(+{selected.energy.bonusCurrent})/{selected.energy.baseCap}
          </span>
        </div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
          <span>奥德能量</span>
          <span>
            {selected.energy.baseCurrent}(+{selected.energy.bonusCurrent})/{selected.energy.baseCap}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.06)]">
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
        <p className="mt-2 text-xs text-slate-400">基础能量优先扣除，补充能量用于兜底。</p>
      </section>

      <div className="space-y-4">
      <section className="section-card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Breeze Shop</p>
            <h3 className="panel-title !mt-1 !text-sm">微风商店记录</h3>
          </div>
          <span className="summary-note">{selectedIsAodeExtra ? "额外+8资格" : "基础资格"}</span>
        </div>
        <p className="mt-2 text-xs text-slate-300">
          奥德购买 {selected.aodePlan.shopAodePurchaseUsed}/{selectedAodeLimits.purchaseLimit}（剩余 {selectedShopAodePurchaseRemaining}） | 每日副本券购买{" "}
          {selected.aodePlan.shopDailyDungeonTicketPurchaseUsed}/{selectedAodeLimits.purchaseLimit}（剩余 {selectedShopDailyDungeonTicketPurchaseRemaining}）
        </p>
        <p className="summary-note mt-1">基础每周每项 {AODE_WEEKLY_BASE_PURCHASE_MAX} 次，额外角色每项 +{AODE_WEEKLY_EXTRA_PURCHASE_MAX} 次。</p>
        {!selectedIsAodeExtra && selectedAccountExtraCharacterName ? (
          <p className="banner-warning mt-1 rounded-lg px-3 py-2 text-xs">当前账号额外角色：{selectedAccountExtraCharacterName}</p>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
          <select
            className="field-control"
            value={shopAodePurchaseUsedInput}
            onChange={(event) => onShopAodePurchaseUsedInputChange(event.target.value)}
            disabled={busy}
          >
            {buildCountOptions(0, selectedAodeLimits.purchaseLimit, shopAodePurchaseUsedInput).map((value) => (
              <option key={`shop-aode-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="field-control"
            value={shopDailyDungeonTicketPurchaseUsedInput}
            onChange={(event) => onShopDailyDungeonTicketPurchaseUsedInputChange(event.target.value)}
            disabled={busy}
          >
            {buildCountOptions(0, selectedAodeLimits.purchaseLimit, shopDailyDungeonTicketPurchaseUsedInput).map((value) => (
              <option key={`shop-ticket-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button className="task-btn px-4" onClick={onSaveShopPlan} disabled={busy}>
            保存记录
          </button>
          <button className="task-btn px-4" onClick={() => onAssignExtraAodeCharacter(!selectedIsAodeExtra)} disabled={busy}>
            {selectedIsAodeExtra ? "取消额外" : "设为额外"}
          </button>
        </div>
      </section>

      <section className="section-card">
        <div>
          <p className="panel-kicker !tracking-[0.08em]">Transform</p>
          <h3 className="panel-title !mt-1 !text-sm">变换记录</h3>
        </div>
        <p className="mt-2 text-xs text-slate-300">
          奥德变换 {selected.aodePlan.transformAodeUsed}/{selectedAodeLimits.convertLimit}（剩余 {selectedTransformAodeRemaining}）
        </p>
        <p className="summary-note mt-1">
          单次奥德按 {AODE_POINT_PER_OPERATION} 记录；基础每周 {AODE_WEEKLY_BASE_CONVERT_MAX} 次，额外角色 +{AODE_WEEKLY_EXTRA_CONVERT_MAX} 次。
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <select
            className="field-control"
            value={transformAodeUsedInput}
            onChange={(event) => onTransformAodeUsedInputChange(event.target.value)}
            disabled={busy}
          >
            {buildCountOptions(0, selectedAodeLimits.convertLimit, transformAodeUsedInput).map((value) => (
              <option key={`transform-aode-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button className="task-btn px-4" onClick={onSaveTransformPlan} disabled={busy}>
            保存记录
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
