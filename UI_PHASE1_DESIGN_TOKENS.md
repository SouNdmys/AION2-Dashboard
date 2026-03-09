# UI 改造 Phase 1 交付说明（Design Tokens 收敛）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 收敛了 renderer 全局设计 token，统一颜色、圆角、阴影、控件高度与动效时长。
2. 重做了 `.task-btn`、`.pill-btn`、`.glass-panel`、`.data-pill` 的基础视觉规格。
3. 将 `input/select/textarea` 的默认外观统一收口到全局样式，减少页面内重复拼接类名导致的漂移。
4. 保留现有业务结构与页面信息架构，不改 renderer 逻辑流。

## 2. 文件清单

1. `src/renderer/src/styles.css`
2. `scripts/ui-baseline-phase0-capture.mjs`
3. `package.json`
4. `artifacts/ui-baseline/phase1/`

## 3. 设计取舍

1. 颜色策略：
   - 从高饱和蓝青发光，收敛为低噪音冷灰底色 + 轻量蓝色焦点。
   - 保留深色界面基调，但把“强调”集中到焦点态与主按钮，不再让大面积面板本身发光。
2. 控件策略：
   - 主按钮统一由 `.task-btn` 承担，改为浅色实心，确保主动作在深色界面上稳定可见。
   - 次按钮统一由 `.pill-btn` 承担，改为更轻的边框胶囊，避免多个动作同时抢主视觉。
   - 表单控件统一高度和聚焦反馈，降低不同面板之间的规格漂移。
3. 动效策略：
   - 全局动效收敛到 `140ms ~ 180ms`，只保留 hover/focus 的必要反馈，不做额外漂移动画。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run capture:ui-baseline:phase1`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase1/`
2. 索引：`artifacts/ui-baseline/phase1/manifest.json`
3. 新增能力：
   - 截图脚本支持 `--out-dir`
   - 可复用同一套采集逻辑为 Phase 2~5 输出对比产物

## 6. 验收结论

1. 同类型按钮与输入控件的高度、圆角、焦点态已统一到同一规格。
2. 视觉噪音较基线下降，尤其是卡片背景、按钮强度、输入框边界更一致。
3. 当前仍不够“极简”，主要原因不是 token，而是页面信息架构仍维持旧布局：
   - OCR 抓价器默认展开内容过多
   - 市场分析器默认首屏占用过高
   - 这部分进入 Phase 2 / Phase 3 处理
