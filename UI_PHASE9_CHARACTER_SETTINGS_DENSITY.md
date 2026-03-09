# UI 改造 Phase 9 交付说明（角色页减重 + 设置页分组压缩 + 侧栏细修）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 角色操作页重排为“摘要 -> 资料/快捷操作 -> 资源记录”：
   - 头部压缩为 4 个迷你摘要卡
   - `角色资料` 与 `快捷操作` 分组并列
   - 奥德能量、微风商店、变换记录改为更轻的双列区块
2. 设置页改为 4 个职责明确的配置块：
   - `收益与阈值`
   - `优先级偏好`
   - `构建信息`
   - `深渊回廊参数`
3. 左右侧栏做局部密度下调：
   - 卡片内边距略减
   - 优先级列表与历史列表行距收敛
   - 操作中心按钮允许换行，避免窄宽度下拥挤

## 2. 文件清单

1. `src/renderer/src/features/dashboard/views/DashboardCharacterHeaderPanel.tsx`
2. `src/renderer/src/features/dashboard/views/DashboardCharacterResourcePanels.tsx`
3. `src/renderer/src/features/dashboard/views/DashboardSettingsPanel.tsx`
4. `src/renderer/src/features/dashboard/views/DashboardSidebarPanels.tsx`
5. `src/renderer/src/features/dashboard/views/DashboardRightSidebar.tsx`
6. `src/renderer/src/styles.css`
7. `package.json`
8. `UI_PHASE9_CHARACTER_SETTINGS_DENSITY.md`
9. `artifacts/ui-baseline/phase9/`

## 3. 设计取舍

1. 角色页优先回答“这个角色现在是什么状态”：
   - 把高频识别信息放在顶部摘要卡。
   - 编辑资料和快捷动作不再混成一整块长表单。
2. 设置页优先回答“用户要改哪类规则”：
   - 参数不再按实现来源堆叠。
   - 每个卡片只承载一类决策。
3. 侧栏继续降噪，但不隐藏关键辅助能力：
   - 右栏仍保留倒计时、优先级、历史。
   - 只是减少每张卡的视觉占地，避免把中栏重新挤脏。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase9`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase9/`
2. 索引：`artifacts/ui-baseline/phase9/manifest.json`
3. 本轮重点：
   - 角色页是否从“表单页”更接近“状态工作台”
   - 设置页是否更像少数几组明确配置，而不是参数堆栈
   - 左右侧栏是否更轻，不再抢中栏注意力

## 6. 验收结论

1. 角色操作页和设置页的阅读路径已更短。
2. 侧栏密度已下降，但总览角色卡本身仍然偏满。
3. 下一轮若继续，应集中在：
   - 角色总览卡片标签再压一轮
   - 窄屏下左右栏与按钮高度进一步统一
   - Workshop 与 Dashboard 的字重和留白继续靠拢
