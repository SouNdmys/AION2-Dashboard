# UI 改造 Phase 0 基线说明（改造前）

基线版本：`v2.1.3`  
采集日期：`2026-02-27`  
采集脚本：`npm run capture:ui-baseline:phase0`

## 1. 截图产物

目录：`artifacts/ui-baseline/phase0/`

### Dashboard（桌面 + 窄屏）

- `desktop-dashboard-overview.jpg`
- `desktop-dashboard-character.jpg`
- `desktop-dashboard-settings.jpg`
- `narrow-dashboard-overview.jpg`
- `narrow-dashboard-character.jpg`
- `narrow-dashboard-settings.jpg`

### Workshop（桌面 + 窄屏）

- `desktop-workshop-overview.jpg`
- `desktop-workshop-simulation.jpg`
- `desktop-workshop-ocr.jpg`
- `desktop-workshop-market-analysis.jpg`
- `desktop-workshop-inventory.jpg`
- `narrow-workshop-overview.jpg`
- `narrow-workshop-simulation.jpg`
- `narrow-workshop-ocr.jpg`
- `narrow-workshop-market-analysis.jpg`
- `narrow-workshop-inventory.jpg`

截图清单索引见：`artifacts/ui-baseline/phase0/manifest.json`

## 2. 首屏交互密度（改造前）

统计口径：
- `totalInteractive`：页面内 `button/input/select/textarea` 总数
- `visibleInteractiveInViewport`：当前视口内可见交互控件数

结果：
- 桌面（`1728x1117`）：`totalInteractive = 393`，`visibleInteractiveInViewport = 66`
- 窄屏（`430x932`）：`totalInteractive = 393`，`visibleInteractiveInViewport = 23`

说明：
- 工坊页面交互能力完整，但首屏可见控件密度偏高。
- 默认进入工坊时，同时暴露模拟、OCR、市场分析的大量操作入口。

## 3. 主流程点击步数（改造前）

说明：
- 统计“关键点击”，不包含键盘输入与下拉内选项滚动。
- 起点统一为 Dashboard 顶栏。

### 场景 A：快速模拟（已有价格）

1. 点击 `工坊`
2. 点击 `运行模拟`

关键点击数：`2`

### 场景 B：抓价后模拟

1. 点击 `工坊`
2. 点击 OCR 区 `立即抓价`
3. 点击 `运行模拟`

关键点击数：`3`

### 场景 C：手动改价后重算

1. 点击 `工坊`
2. 点击库存区物品选择
3. 点击 `保存价格`
4. 点击 `运行模拟`

关键点击数：`4`

### 场景平均（A/B/C）

- 平均关键点击数：`(2 + 3 + 4) / 3 = 3.0`

## 4. Phase 0 结论

1. 功能链路可用，点击步数不高。
2. 主要问题不在“步骤数量”，而在“默认信息暴露过多”：
   - 认知负担高于点击负担。
3. 后续 Phase 重点应放在：
   - 渐进披露
   - 主任务聚焦
   - 工坊默认首屏减噪

