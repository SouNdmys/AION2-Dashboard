# UI 改造 Phase 3 交付说明（市场分析减负）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 市场分析器默认首屏压缩为四块摘要：伺服器最近价格、世界最近价格、趋势方向、异常提醒。
2. 当前物品的趋势方向会优先显示该物品的触发结果；没有命中时回退为全局信号摘要或观察状态。
3. 异常提醒改为少量可点击短标签，可直接联动到历史价格管理中的对应快照。
4. 曲线、筛选、最近 OCR 更新、周期信号明细继续保留在展开区，不改联动逻辑。

## 2. 文件清单

1. `src/renderer/src/features/workshop/views/WorkshopMarketAnalysisPanel.tsx`
2. `package.json`
3. `UI_PHASE3_MARKET_ANALYSIS.md`
4. `artifacts/ui-baseline/phase3/`

## 3. 设计取舍

1. 默认首屏只回答三个问题：
   - 最近价格是多少
   - 现在偏向进货、出货还是观察
   - 有没有异常价格需要立刻处理
2. 不删高级能力：
   - 分类筛选、历史曲线、信号规则、触发清单仍保留在展开区。
3. 保持右侧历史管理联动：
   - 可疑点短标签继续直达历史价格管理快照，不新增跳转页面。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase3`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase3/`
2. 索引：`artifacts/ui-baseline/phase3/manifest.json`

## 6. 验收结论

1. 市场分析器默认首屏高度和信息密度已明显下降。
2. 用户不需要先阅读图表和长列表，也能判断“现在该不该继续看这个物品”。
3. 下一步进入 Phase 4：
   - 把做装模拟器结果区继续压缩到“是否值得做”一眼可判定的形态。
