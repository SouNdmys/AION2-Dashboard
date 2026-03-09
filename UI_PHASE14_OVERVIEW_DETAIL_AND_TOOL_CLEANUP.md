# UI 改造 Phase 14 交付说明（总览细节回补 + 专业工具浅色化续收）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 角色总览卡恢复任务细节：
   - 不再只保留少量摘要标签
   - 改为 `高优先 / 副本 / 周常 / 使命 / 休闲` 分组列表
   - 每个角色卡可直接看见当前还能做哪些任务及剩余次数
2. 专业工具旧样式继续收尾：
   - `OCR抓价器` 顶部主流程卡、调试区、校准区改为浅色 token 面板
   - `市场分析器` 的首屏控件、高级筛选、最近抓价表改为浅色 token 面板
   - `库存管理` 的修正区、物品表格、逆向推荐区改为浅色 token 面板
   - `历史价格管理` 的筛选区、提示区、表格区改为浅色 token 面板

## 2. 文件清单

1. `src/renderer/src/features/dashboard/views/DashboardOverviewPanel.tsx`
2. `src/renderer/src/features/workshop/views/WorkshopOcrPanel.tsx`
3. `src/renderer/src/features/workshop/views/WorkshopMarketAnalysisPanel.tsx`
4. `src/renderer/src/features/workshop/views/WorkshopInventoryPanel.tsx`
5. `src/renderer/src/WorkshopSidebarHistoryCard.tsx`
6. `src/renderer/src/styles.css`
7. `package.json`
8. `UI_PHASE14_OVERVIEW_DETAIL_AND_TOOL_CLEANUP.md`
9. `artifacts/ui-baseline/phase14/`

## 3. 设计取舍

1. 总览卡优先保留“可执行细节”：
   - 用户需要在总览直接判断每个角色到底还能做什么。
   - 所以保留明细，但改成分组行列表，而不是一片语义标签。
2. 专业工具继续浅色化，但不硬改业务结构：
   - 先处理最影响观感的 `表单 / 表格 / 状态提示 / 高级区容器`
   - 避免一次性大拆，保证热修阶段仍然可控

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run build`：通过
3. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase14`：通过，输出 `16` 张截图

## 5. 验收结论

1. 角色总览重新具备“直接判断角色可做内容”的实用性。
2. 专业工具内部已经明显减少旧黑底残留，但还没完全清零。
3. 下一轮若继续，建议优先把：
   - `市场分析器` 深层图表区
   - `库存管理` 推荐结果卡
   - `OCR 调试明细` 的剩余旧状态色
   继续统一到同一套浅色 token。
