# UI 改造 Phase 2 交付说明（工坊 IA 重排）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 工坊页增加“快捷模式 / 专业模式”分层，默认首屏只保留做装主流程。
2. `库存管理` 下沉到“专业模式”折叠区，避免管理型操作长期占据默认首屏。
3. `OCR抓价器` 默认只展示抓价主流程，自动巡航、调试明细、可视化校准移入“高级设置”。
4. `市场分析器` 默认只展示当前物品、近期价格和结论摘要，分类筛选、曲线、信号列表移入“高级筛选与细节”。

## 2. 文件清单

1. `src/renderer/src/WorkshopView.tsx`
2. `src/renderer/src/features/workshop/views/WorkshopOcrPanel.tsx`
3. `src/renderer/src/features/workshop/views/WorkshopMarketAnalysisPanel.tsx`
4. `scripts/ui-baseline-phase0-capture.mjs`
5. `package.json`
6. `artifacts/ui-baseline/phase2/`

## 3. 设计取舍

1. 保留业务联动，不改逻辑：
   - 材料点击联动、历史价格联动、市场分析联动保持原路径。
   - 本次只调整“默认先看到什么”。
2. 默认首屏聚焦制作决策：
   - 快捷模式固定为“选配方 -> 抓价格 -> 看结论”。
   - 库存修正、逆向推荐、批量维护进入专业模式。
3. 专业功能不删除，只做渐进披露：
   - OCR 的巡航、校准和调试仍可用。
   - 市场分析的曲线、周期信号、重点关注仍可用。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase2`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase2/`
2. 索引：`artifacts/ui-baseline/phase2/manifest.json`
3. 新增截图脚本兼容：
   - 当 `库存管理` 位于折叠的“专业模式”中时，脚本会先自动展开再截图

## 6. 验收结论

1. 默认进入工坊后，用户无需先阅读库存管理和大段曲线/信号内容。
2. 首屏主操作已收敛到制作模拟、抓价和结果查看。
3. 当前仍有两个后续优化点：
   - 做装模拟器内部结果区还能继续压缩到更强的“结论优先”
   - 市场分析器的展开内容仍偏重，这部分进入 Phase 3 / Phase 4
