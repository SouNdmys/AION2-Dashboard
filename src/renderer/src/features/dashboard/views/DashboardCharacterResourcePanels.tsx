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
  onOpenEnergyDialog: () => void;
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
    onOpenEnergyDialog,
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
    <div className="mt-3 space-y-3">
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
            <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.06)]">
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
            <div className="toolbar-meta mt-1.5 summary-note">
              <span>基础优先扣除</span>
              <span>补充能量兜底</span>
            </div>
          </div>

          <div className="toolbar-actions xl:justify-end">
            <div className="data-pill !px-3 !py-2">基础 {selected.energy.baseCurrent}/{selected.energy.baseCap}</div>
            <div className="data-pill !px-3 !py-2">补充 {selected.energy.bonusCurrent}/{selected.energy.bonusCap}</div>
            <button className="pill-btn" onClick={onOpenEnergyDialog} disabled={busy}>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="toolbar-meta task-meta-line">
              <span>奥德 {selected.aodePlan.shopAodePurchaseUsed}/{selectedAodeLimits.purchaseLimit}</span>
              <span>副本券 {selected.aodePlan.shopDailyDungeonTicketPurchaseUsed}/{selectedAodeLimits.purchaseLimit}</span>
              <span>资格 {selectedIsAodeExtra ? "额外+8" : "基础"}</span>
            </div>
            <div className="toolbar-actions">
              <div className="data-pill !px-3 !py-2">奥德剩余 {selectedShopAodePurchaseRemaining}</div>
              <div className="data-pill !px-3 !py-2">副本券剩余 {selectedShopDailyDungeonTicketPurchaseRemaining}</div>
            </div>
          </div>
          <p className="summary-note mt-1">基础每周每项 {AODE_WEEKLY_BASE_PURCHASE_MAX} 次，额外角色每项 +{AODE_WEEKLY_EXTRA_PURCHASE_MAX} 次。</p>
          {!selectedIsAodeExtra && selectedAccountExtraCharacterName ? (
            <p className="banner-warning mt-1 rounded-lg px-3 py-2 text-xs">当前账号额外角色：{selectedAccountExtraCharacterName}</p>
          ) : null}
          <div className="toolbar-grid mt-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_auto_auto]">
            <select
              className="field-control"
              value={shopAodePurchaseUsedInput}
              onChange={(event) => onShopAodePurchaseUsedInputChange(event.target.value)}
              disabled={busy}
            >
              {buildCountOptions(0, selectedAodeLimits.purchaseLimit, shopAodePurchaseUsedInput).map((value) => (
                <option key={`shop-aode-${value}`} value={value}>
                  奥德购买 {value}
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
                  副本券购买 {value}
                </option>
              ))}
            </select>
            <button className="task-btn task-btn-soft task-btn-compact px-4" onClick={onSaveShopPlan} disabled={busy}>
              保存记录
            </button>
            <button className="task-btn task-btn-soft task-btn-compact px-4" onClick={() => onAssignExtraAodeCharacter(!selectedIsAodeExtra)} disabled={busy}>
              {selectedIsAodeExtra ? "取消额外" : "设为额外"}
            </button>
          </div>
        </section>

        <section className="toolbar-card h-full">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Transform</p>
            <h3 className="panel-title !mt-1 !text-sm">变换记录</h3>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="toolbar-meta task-meta-line">
              <span>已用 {selected.aodePlan.transformAodeUsed}/{selectedAodeLimits.convertLimit}</span>
              <span>剩余 {selectedTransformAodeRemaining}</span>
              <span>单次 {AODE_POINT_PER_OPERATION} 奥德</span>
            </div>
            <div className="toolbar-actions">
              <div className="data-pill !px-3 !py-2">基础每周 {AODE_WEEKLY_BASE_CONVERT_MAX} 次</div>
              <div className="data-pill !px-3 !py-2">额外角色 +{AODE_WEEKLY_EXTRA_CONVERT_MAX} 次</div>
            </div>
          </div>
          <div className="toolbar-grid mt-3 md:grid-cols-[minmax(0,0.9fr)_auto]">
            <select
              className="field-control"
              value={transformAodeUsedInput}
              onChange={(event) => onTransformAodeUsedInputChange(event.target.value)}
              disabled={busy}
            >
              {buildCountOptions(0, selectedAodeLimits.convertLimit, transformAodeUsedInput).map((value) => (
                <option key={`transform-aode-${value}`} value={value}>
                  变换次数 {value}
                </option>
              ))}
            </select>
            <button className="task-btn task-btn-soft task-btn-compact px-4" onClick={onSaveTransformPlan} disabled={busy}>
              保存记录
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
