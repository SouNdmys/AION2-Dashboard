# UI 改造 Phase 7 交付说明（主流程聚焦 + 语义色修正）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 主按钮降反差：
   - 从近黑按钮改为柔和石墨灰按钮
   - 降低浅色界面里的刺眼感
2. 角色总览语义色重做：
   - 删除强烈红色主导
   - 改为 `完成/可做 = 绿色`、`观察 = 琥珀`、`高优先 = 橙色`
3. 工坊主流程重排：
   - 默认首屏只保留 `装备制作`
   - `OCR抓价器 / 市场分析器 / 历史价格管理 / 库存管理` 全部收进 `专业模式`
4. 信息密度继续下调：
   - 角色卡只显示当前需要处理的重点标签
   - 次级信息折叠为摘要文字

## 2. 文件清单

1. `src/renderer/src/styles.css`
2. `src/renderer/src/App.tsx`
3. `src/renderer/src/WorkshopView.tsx`
4. `src/renderer/src/features/dashboard/dashboard-utils.ts`
5. `src/renderer/src/features/dashboard/views/DashboardOverviewPanel.tsx`
6. `src/renderer/src/features/dashboard/views/DashboardRightSidebar.tsx`
7. `src/renderer/src/features/workshop/views/WorkshopOverviewHeader.tsx`
8. `scripts/ui-baseline-phase0-capture.mjs`
9. `package.json`
10. `UI_PHASE7_WORKFLOW_FOCUS.md`
11. `artifacts/ui-baseline/phase7/`

## 3. 设计取舍

1. 工坊默认不再展示管理型内容：
   - 用户默认目标是“做不做这件装备”。
   - 价格抓取和历史维护属于支撑信息，不应抢首屏。
2. 高优先不等于纯红色：
   - 在浅色主题里，大面积红色很容易显得脏和焦躁。
   - 这轮改成更克制的橙色高优先，保留提醒但不过载。
3. 角色卡不再平铺全部标签：
   - 只显示当前有值、且优先处理的项目。
   - 其余信息改为摘要说明，减少一眼看到的标签墙。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase7`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase7/`
2. 索引：`artifacts/ui-baseline/phase7/manifest.json`
3. 本轮重点：
   - 工坊是否已经更接近“默认只剩做装”
   - 角色总览标签色是否更舒服
   - 主按钮是否仍清楚但不再刺眼

## 6. 验收结论

1. 工坊主流程已经接近单任务工作台。
2. 角色总览的视觉噪音和颜色冲突已明显下降。
3. 下一轮如果继续，应集中在：
   - 角色操作页与设置页的同类降噪
   - 明细表格进一步压缩
   - 更细的字号、间距和移动端触达优化
