# AION2 Dashboard Refactor Worklist (based on v2.0.1)

基线版本:
- commit: `5d9a56a`
- tag: `v2.0.1`
- backup branch: `backup/v2.0.1`

## Workstream 1 - 拆分超大文件与职责边界

目标:
- 降低 `App.tsx` / `WorkshopView.tsx` / `workshop-store.ts` 的单文件复杂度。

任务:
- [ ] 1.1 将 `src/renderer/src/App.tsx` 拆为 `features/dashboard/*` 子模块（视图、hooks、actions）。
- [ ] 1.2 将 `src/renderer/src/WorkshopView.tsx` 拆为 `features/workshop/*` 子模块（OCR、历史、模拟、库存）。
- [ ] 1.3 将 `src/main/workshop-store.ts` 拆为 `catalog/ocr/pricing/simulation/store` 模块。
- [ ] 1.4 将 `src/main/ipc.ts` 按域拆分注册（app/account/character/workshop）。

验收:
- `npm run typecheck`
- `npm run build`
- 工坊页面可正常打开，核心操作（抓价/历史/模拟）可用。

## Workstream 2 - 状态与持久化模型优化

目标:
- 去掉“读操作触发写入”的副作用链，降低全量 clone 与快照成本。

任务:
- [ ] 2.1 将 `getAppState()` 从写入型改为纯读取（刷新逻辑与持久化解耦）。
- [ ] 2.2 优化 `commitMutation`（减少 `structuredClone` / `JSON.stringify` 比较热路径开销）。
- [ ] 2.3 历史记录由“全量 before 快照”演进为可控增量（或保留快照但加容量与压缩策略）。
- [ ] 2.4 工坊状态读写增加脏检查，避免无效写盘。

验收:
- 连续执行 100 次常见操作后，UI 不卡顿、历史撤销行为不变。
- 导入/导出、撤销/重做、自动备份行为与重构前一致。

## Workstream 3 - IPC 契约统一与运行时校验

目标:
- 单一契约源，避免 `main/preload/renderer` 三处漂移。

任务:
- [ ] 3.1 统一定义 IPC 路由表与 payload/return 类型映射。
- [ ] 3.2 主进程 handler 增加 payload 运行时校验。
- [ ] 3.3 preload API 从手写 invoke 映射改为基于契约的薄封装生成。
- [ ] 3.4 错误返回格式标准化（可定位 channel + 业务错误码）。

验收:
- 非法 payload 能稳定返回可读错误，不导致进程崩溃。
- 全部 IPC 调用在 typecheck 下无断裂。

## Workstream 4 - 前端状态收敛与可测试性

目标:
- 减少组件内分散状态和重复副作用，提升可维护性。

任务:
- [ ] 4.1 提取 `usePersistedState`，替代 Workshop 中重复 localStorage effect。
- [ ] 4.2 提取 `useAppActions` / `useWorkshopActions`，收敛 `window.aionApi` 调用入口。
- [ ] 4.3 将高耦合计算逻辑移入 selector 层（memoized selectors）。
- [ ] 4.4 为关键交互流补 UI 回归脚本（最小可行 smoke）。

验收:
- App/Workshop 主要组件状态数量显著下降（目标: `useState` 数量减少 30%+）。
- 快速录入、OCR 配置、历史筛选操作无行为回归。

## Workstream 5 - 性能、安全与工程化收尾

目标:
- 主线程更稳、边界更安全、回归成本更低。

任务:
- [ ] 5.1 将工坊重计算（价格信号/部分 OCR 后处理）迁移到 worker 或可中断计算路径。
- [ ] 5.2 收紧 BrowserWindow 安全配置（逐步移除 `contextIsolation: false` / `sandbox: false` 依赖）。
- [ ] 5.3 补最小测试体系（`shared/engine`、`shared/time`、关键 store 逻辑）。
- [ ] 5.4 文档同步（规则、发布流程、回滚流程）。

验收:
- 大数据量下工坊操作响应稳定。
- 安全配置收敛后不影响现有功能。
- 至少覆盖核心规则回归测试并纳入发布前检查。

## 回滚方案

快速回滚到热修稳定版:
- `git checkout main`
- `git reset --hard v2.0.1`
- `git push origin main --force-with-lease`

或使用备份分支恢复:
- `git checkout backup/v2.0.1`
- `git checkout -B main`
- `git push origin main --force-with-lease`

