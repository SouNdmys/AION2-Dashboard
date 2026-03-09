# UI 改造 Phase 4 交付说明（模拟结果优先）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 做装模拟器结果区改为“推荐结论 + 四指标 + 风险提示 + 折叠明细”结构。
2. 首屏四指标固定为：
   - 材料成本
   - 税后收入
   - 净利润
   - 利润率
3. 产物总量、成品单价、缺口补齐成本降级到次级信息。
4. 材料明细与库存修正折叠为按需展开，不再默认抢占主视觉。

## 2. 文件清单

1. `src/renderer/src/features/workshop/views/WorkshopSimulationPanel.tsx`
2. `scripts/ui-baseline-phase0-capture.mjs`
3. `package.json`
4. `UI_PHASE4_SIMULATION_RESULTS.md`
5. `artifacts/ui-baseline/phase4/`

## 3. 设计取舍

1. 默认首屏先回答“值不值得做”：
   - 通过“值得做 / 建议观察 / 缺价待补”结论直接给出判断。
2. 风险优先于细节：
   - 缺价时优先提醒“利润结果不完整”。
   - 库存不足时先给出“需补材料”的状态，不让用户先陷入明细表。
3. 明细仍保留：
   - 材料名点击联动
   - 库存/价格手改
   - 取价来源查看
   全部继续可用，只是收进折叠区。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase4`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase4/`
2. 索引：`artifacts/ui-baseline/phase4/manifest.json`
3. 截图脚本增强：
   - 在抓工坊截图前会先执行一次默认 `运行模拟`
   - 这样 Phase 4 以后可以稳定捕获模拟结果区的真实状态

## 6. 验收结论

1. 首屏已经可以直接判断“是否值得做”。
2. 材料明细不再默认占据主要视线。
3. 下一步进入 Phase 5：
   - 做全站按钮、卡片头、细节对齐与动效收尾。
