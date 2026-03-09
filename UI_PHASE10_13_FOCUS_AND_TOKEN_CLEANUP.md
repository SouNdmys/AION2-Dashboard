# UI 改造 Phase 10-13 交付说明（总览瘦身 + 工坊单任务 + 侧栏按页收起 + Token 收敛）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 角色总览卡瘦身：
   - 角色卡默认只展示 `3 个最高优先项目 + 1 个次级关注摘要`
   - `快速录入` 从常驻区改为折叠入口
   - `筛选/排序` 独立成单一控制条
2. 工坊改为更接近单任务界面：
   - 顶部重命名为 `装备制作工作台`
   - 默认只保留“做装模拟器”主流程
   - `专业工具` 改成后撤折叠区，不再像第二主任务卡
3. 左右侧栏按页面收起：
   - `设置页 / 工坊` 不再占用右侧栏宽度
   - 左侧栏增加“当前上下文”，账号/角色管理改为可折叠管理区
   - 右侧栏在角色页仅保留倒计时、待办和可折叠历史
4. 主题 token 收敛继续推进：
   - 补充 `field-control / surface-table / context-card / banner-* / tone-*`
   - 核心页面不再依赖 `bg-black/25 / border-white/20` 一类深色 utility 兜底

## 2. 文件清单

1. `src/renderer/src/App.tsx`
2. `src/renderer/src/styles.css`
3. `src/renderer/src/features/dashboard/views/DashboardOverviewPanel.tsx`
4. `src/renderer/src/features/dashboard/views/DashboardLeftSidebar.tsx`
5. `src/renderer/src/features/dashboard/views/DashboardRightSidebar.tsx`
6. `src/renderer/src/features/dashboard/views/DashboardSidebarPanels.tsx`
7. `src/renderer/src/features/dashboard/views/DashboardCharacterHeaderPanel.tsx`
8. `src/renderer/src/features/dashboard/views/DashboardCharacterResourcePanels.tsx`
9. `src/renderer/src/features/dashboard/views/DashboardSettingsPanel.tsx`
10. `src/renderer/src/features/dashboard/views/WeeklyStatsPanel.tsx`
11. `src/renderer/src/WorkshopView.tsx`
12. `src/renderer/src/features/workshop/views/WorkshopOverviewHeader.tsx`
13. `src/renderer/src/features/workshop/views/WorkshopSimulationPanel.tsx`
14. `scripts/ui-baseline-phase0-capture.mjs`
15. `package.json`
16. `UI_PHASE10_13_FOCUS_AND_TOKEN_CLEANUP.md`
17. `artifacts/ui-baseline/phase13/`

## 3. 设计取舍

1. 角色总览优先看“现在该打什么”：
   - 不再让一整片标签墙先扑到用户脸上。
   - 次级任务统一下沉为摘要。
2. 工坊优先回答“值不值得做”：
   - 默认不让 OCR、历史价格和库存纠偏与模拟器抢焦点。
   - 高级能力保留，但明确是第二层。
3. 侧栏只做辅助，不再和主内容抢宽度：
   - 左栏负责导航和上下文。
   - 右栏只在 Dashboard 场景承担辅助信息。
4. 视觉收敛优先解决维护成本：
   - 继续堆 utility 会让浅色主题越来越难维护。
   - 本轮开始把关键表单和卡片转成语义类。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase13`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase13/`
2. 索引：`artifacts/ui-baseline/phase13/manifest.json`
3. 本轮重点：
   - 总览卡是否不再像标签墙
   - 工坊是否终于更接近单任务工作台
   - 设置页 / 工坊在无右栏时是否更干净

## 6. 验收结论

1. 中间主区的任务聚焦已经明显提升。
2. 工坊默认画面已更接近你要的 ChatGPT 式单任务路径。
3. 仍可继续优化的下一层问题：
   - 专业工具内部面板仍有一部分旧深色 utility，可继续收尾
   - 角色总览卡还可以再压成“卡片顶部结论 + 更少标签”

## 7. 后续微调补充

1. 工坊顶部独立说明卡已移除：
   - 原“装备制作工作台”描述并入“做装模拟器”。
   - 首屏进一步缩短，避免做装前先读两段重复说明。
2. `专业工具` 折叠区说明文案继续裁剪：
   - 仅保留分组标题与展开动作。
