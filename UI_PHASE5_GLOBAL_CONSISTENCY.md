# UI 改造 Phase 5 交付说明（全局一致性收尾）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. Dashboard 与 Workshop 顶栏统一为同一套标题语言：
   - `panel-kicker`
   - `panel-title`
   - `panel-subtitle`
2. 常用按钮状态收敛：
   - 激活态统一使用 `pill-btn-active`
   - 静态标签统一使用 `pill-static`
3. 折叠区交互统一：
   - `details > summary` 统一使用 `details-summary`
   - 焦点态与 hover 态使用同一套边框与底色反馈
4. 动效进一步收敛：
   - 卡片、按钮、折叠标题的过渡统一在 `120-180ms`
   - 增加 `prefers-reduced-motion` 降级

## 2. 文件清单

1. `src/renderer/src/styles.css`
2. `src/renderer/src/features/dashboard/views/DashboardToolbar.tsx`
3. `src/renderer/src/features/dashboard/views/DashboardOverviewPanel.tsx`
4. `src/renderer/src/features/dashboard/views/DashboardCharacterHeaderPanel.tsx`
5. `src/renderer/src/features/workshop/views/WorkshopOverviewHeader.tsx`
6. `src/renderer/src/WorkshopView.tsx`
7. `src/renderer/src/features/workshop/views/WorkshopOcrPanel.tsx`
8. `src/renderer/src/features/workshop/views/WorkshopMarketAnalysisPanel.tsx`
9. `src/renderer/src/features/workshop/views/WorkshopSimulationPanel.tsx`
10. `package.json`
11. `UI_PHASE5_GLOBAL_CONSISTENCY.md`
12. `artifacts/ui-baseline/phase5/`

## 3. 设计取舍

1. 先统一语言，再追求装饰：
   - 当前阶段不额外加视觉元素。
   - 先把标题层级、激活态、折叠态和动效口径收敛。
2. 让用户一眼知道“哪里是主标题，哪里是状态，哪里是控制”：
   - Dashboard 和 Workshop 不再各说各话。
   - 同类信息采用同类样式，减少重新学习。
3. 动效不追求存在感：
   - 过渡只承担“帮助理解状态变化”。
   - 避免大幅位移和重动画，向极简方向靠拢。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `npm run capture:ui-baseline:phase5`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase5/`
2. 索引：`artifacts/ui-baseline/phase5/manifest.json`
3. 对比重点：
   - Dashboard 顶栏与总览卡片头部语言统一
   - Workshop 顶栏与专业模式折叠标题统一
   - 激活按钮与静态版本标签语义分离

## 6. 验收结论

1. Phase 5 结束后，Workshop 与 Dashboard 已具备统一的极简基底。
2. 当前界面仍不是最终美术状态，但“结构噪音”已经明显下降。
3. 下一步可以进入更明显的 UI 调整阶段：
   - 卡片留白再分级
   - 颜色层次再压缩
   - 首页与工坊的视觉重心再聚焦
