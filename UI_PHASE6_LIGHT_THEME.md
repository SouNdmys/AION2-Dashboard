# UI 改造 Phase 6 交付说明（浅色极简主题）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 全局主题从深色玻璃风切换为浅色极简基底：
   - 画布改为暖白灰背景
   - 主卡片改为白底柔阴影
   - 主按钮收敛为深色实体按钮
2. 颜色层级压缩：
   - 去掉大面积黑底 + 白按钮的强反差组合
   - 高亮色统一收敛到低饱和绿色与少量风险色
3. 首页与工坊主视觉重心重新整理：
   - 顶部主卡放大并改为 `hero-strip`
   - 关键统计改为统一 `metric-card`
   - 快捷模式 / 专业模式改为更轻的分组卡片
4. 留白与密度再调整：
   - 主卡圆角与内边距进一步放大
   - 侧栏与主栏间距增加

## 2. 文件清单

1. `src/renderer/src/styles.css`
2. `src/renderer/src/App.tsx`
3. `src/renderer/src/WorkshopView.tsx`
4. `src/renderer/src/features/dashboard/views/DashboardToolbar.tsx`
5. `src/renderer/src/features/dashboard/views/DashboardOverviewSummaryCards.tsx`
6. `src/renderer/src/features/dashboard/views/DashboardOverviewPanel.tsx`
7. `src/renderer/src/features/dashboard/views/DashboardLeftSidebar.tsx`
8. `src/renderer/src/features/dashboard/views/DashboardRightSidebar.tsx`
9. `src/renderer/src/features/workshop/views/WorkshopOverviewHeader.tsx`
10. `package.json`
11. `UI_PHASE6_LIGHT_THEME.md`
12. `artifacts/ui-baseline/phase6/`

## 3. 设计取舍

1. 先做“气质切换”，再做精修：
   - 这一轮优先解决“像不像一个极简产品”。
   - 不继续增加样式装饰，先把色板、对比度和卡片层次调对。
2. 主按钮保留深色：
   - 页面整体已经变浅，如果主按钮也做成白色，会失去操作锚点。
   - 只保留一个较深的主按钮层级，其他按钮退回浅色次按钮。
3. 让首页和工坊都像“工作台”，而不是“参数墙”：
   - 顶部主卡承担说明与导航。
   - 次级统计退成低存在感的指标卡。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase6`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase6/`
2. 索引：`artifacts/ui-baseline/phase6/manifest.json`
3. 本轮重点：
   - Dashboard 首页是否已摆脱黑底工具感
   - Workshop 首屏是否更接近简约白底工作台
   - 主按钮、次按钮、统计卡是否形成稳定层级

## 6. 验收结论

1. 当前已进入你希望的浅色极简方向。
2. 这还不是最终美术完成态，但“主题错误”已经修正。
3. 下一轮若继续优化，应该进入：
   - 角色卡信息裁剪
   - 表格区与明细区的密度继续降低
   - 字号节奏和移动端间距微调
