# AION2 Dashboard Refactor Worklist (based on v2.0.1)

基线版本:
- commit: `5d9a56a`
- tag: `v2.0.1`
- backup branch: `backup/v2.0.1`

## Workstream 1 - 拆分超大文件与职责边界

目标:
- 降低 `App.tsx` / `WorkshopView.tsx` / `workshop-store.ts` 的单文件复杂度。

任务:
- [x] 1.1 将 `src/renderer/src/App.tsx` 拆为 `features/dashboard/*` 子模块（视图、hooks、actions）。
- [x] 1.1 将 `src/renderer/src/App.tsx` 拆为 `features/dashboard/*` 子模块（视图、hooks、actions）。
- [x] 1.2 将 `src/renderer/src/WorkshopView.tsx` 拆为 `features/workshop/*` 子模块（OCR、历史、模拟、库存）。
- [x] 1.3 将 `src/main/workshop-store.ts` 拆为 `catalog/ocr/pricing/simulation/store` 模块。
- [x] 1.4 将 `src/main/ipc.ts` 按域拆分注册（app/account/character/workshop）。

验收:
- `npm run typecheck`
- `npm run build`
- 工坊页面可正常打开，核心操作（抓价/历史/模拟）可用。

## Workstream 2 - 状态与持久化模型优化

目标:
- 去掉“读操作触发写入”的副作用链，降低全量 clone 与快照成本。

任务:
- [x] 2.1 将 `getAppState()` 从写入型改为纯读取（刷新逻辑与持久化解耦）。
- [x] 2.2 优化 `commitMutation`（减少 `structuredClone` / `JSON.stringify` 比较热路径开销）。
- [x] 2.3 历史记录由“全量 before 快照”演进为可控增量（或保留快照但加容量与压缩策略）。
- [x] 2.4 工坊状态读写增加脏检查，避免无效写盘。

验收:
- 连续执行 100 次常见操作后，UI 不卡顿、历史撤销行为不变。
- 导入/导出、撤销/重做、自动备份行为与重构前一致。

## Workstream 3 - IPC 契约统一与运行时校验

目标:
- 单一契约源，避免 `main/preload/renderer` 三处漂移。

任务:
- [x] 3.1 统一定义 IPC 路由表与 payload/return 类型映射。
- [x] 3.2 主进程 handler 增加 payload 运行时校验。
- [x] 3.3 preload API 从手写 invoke 映射改为基于契约的薄封装生成。
- [x] 3.4 错误返回格式标准化（可定位 channel + 业务错误码）。

验收:
- 非法 payload 能稳定返回可读错误，不导致进程崩溃。
- 全部 IPC 调用在 typecheck 下无断裂。

## Workstream 4 - 前端状态收敛与可测试性

目标:
- 减少组件内分散状态和重复副作用，提升可维护性。

任务:
- [x] 4.1 提取 `usePersistedState`，替代 Workshop 中重复 localStorage effect。
- [x] 4.2 提取 `useAppActions` / `useWorkshopActions`，收敛 `window.aionApi` 调用入口。
- [x] 4.3 将高耦合计算逻辑移入 selector 层（memoized selectors）。
- [x] 4.4 为关键交互流补 UI 回归脚本（最小可行 smoke）。

## 已完成变更（当前分支）

- `1e01270` `refactor(store): decouple read path from persistence and add workshop dirty-write check`
- `e57d0f9` `refactor(ipc): split handler registration by domain with payload guards`
- `8290ad8` `refactor(renderer): extract usePersistedState and remove repeated localStorage effects`
- `31b9bcc` `refactor(renderer): centralize aionApi access via app/workshop action hooks`
- `368b1b4` `refactor(store): avoid snapshot cloning in commitMutation hot path` (2.2 阶段进展)
- `e5fc02c` `refactor(store): lazily build history snapshot only when changed` (2.2 阶段进展)
- `02f09f8` `refactor(store): add incremental history deltas with snapshot fallback` (2.3 阶段进展)
- `cf019dd` `refactor(preload): generate invoke api from shared ipc contract` (3.3 阶段进展)
- `7b6cb2a` `refactor(ipc): standardize invoke errors with channel and business codes` (3.4 阶段进展)
- `627d25e` `refactor(workshop): move derived models into memoized selector layer` (4.3 阶段进展)
- `aa5e5f6` `test(smoke): add electron ui regression script for key workflows` (4.4 阶段进展)
- `4b29680` `refactor(workshop): make ocr import and signal compute interruptible` (5.1 阶段进展)
- `993489a` `security(window): enable sandboxed renderer and isolate overlay` (5.2 阶段进展)
- `0a7274b` `test(unit): add vitest suite for shared time and engine` (5.3 阶段进展)
- `fad4c91` `docs(release): sync rules and add publish rollback runbook` (5.4 阶段进展)
- `2d596dd` `refactor(store): split workshop store into domain modules with core bridge` (1.3 阶段进展)
- `82b9bd4` `refactor(main): route workshop consumers through domain store modules` (1.3 阶段进展)
- `fb0992c` `refactor(dashboard): extract app view models and utility helpers into feature modules` (1.1 阶段进展)
- `708f4bd` `refactor(workshop): move view helpers and persistence config out of WorkshopView` (1.2 阶段进展)
- `5ada73d` `refactor(dashboard): split toolbar and dashboard side panels into view components` (1.1 第二阶段进展)
- `040f6f4` `refactor(workshop): extract loading and overview header views` (1.2 第二阶段进展)
- `7b26ae4` `docs(refactor): log phase-2 dashboard/workshop view split commits`
- `648ef56` `refactor(dashboard): extract character task board into dedicated view component` (1.1 第二阶段进展)
- `95db1ec` `refactor(dashboard): extract overview board into dedicated view component` (1.1 第二阶段进展)
- `351791a` `refactor(dashboard): extract character header controls into dedicated view component` (1.1 第二阶段进展)
- `99e11a2` `refactor(dashboard): extract character resource panels into dedicated view component` (1.1 第二阶段进展)
- `ab091bc` `refactor(dashboard): compose character main section into dedicated view` (1.1 第二阶段进展)
- `a74176c` `refactor(dashboard): compose weekly stats and task board into character-mode view` (1.1 第二阶段进展)
- `4cc0884` `refactor(dashboard): extract settings panel into dedicated view component` (1.1 第二阶段进展)
- `49fcc33` `refactor(dashboard): extract right sidebar into dedicated view component` (1.1 第二阶段进展)
- `e7873fc` `refactor(dashboard): extract dialog modal renderer into dedicated view component` (1.1 第二阶段进展)
- `55182b5` `refactor(dashboard): extract left account sidebar into dedicated view component` (1.1 第二阶段进展)
- `54c1684` `refactor(dashboard): extract dialog confirm dispatcher into action module` (1.1 第二阶段进展)
- `684053f` `refactor(dashboard): extract dialog state builders into action helpers` (1.1 第二阶段进展)
- `622d234` `refactor(dashboard): extract corridor and aode page actions into action module` (1.1 第二阶段进展)
- `160149e` `refactor(dashboard): extract settings and import-export page actions` (1.1 第二阶段进展)
- `ff58354` `refactor(dashboard): extract history page actions into action module` (1.1 第二阶段进展)
- `a58489d` `refactor(dashboard): extract weekly stats page actions into module` (1.1 第二阶段进展)
- `a53186d` `refactor(dashboard): extract account and character page actions` (1.1 第二阶段进展)
- `0018eb5` `refactor(dashboard): extract overview card drag-drop actions` (1.1 第二阶段进展)
- `90daa01` `refactor(dashboard): extract quick entry page action dispatcher` (1.1 第二阶段进展)
- `1211524` `refactor(dashboard): merge overview interaction actions into unified module` (1.1 第二阶段进展, 回顾整合)
- `3a6fe00` `refactor(dashboard): merge maintenance actions into unified module` (1.1 第二阶段进展, 回顾整合)
- `6a00772` `refactor(dashboard): extract dialog open handlers into action module` (1.1 第二阶段进展)
- `6e513ca` `refactor(dashboard): consolidate over-split action modules by domain` (1.1 第二阶段进展, 回顾整合)
- `1036442` `refactor(dashboard): extract app sync runner into reusable hook` (1.1 第二阶段进展)
- `65de77d` `refactor(dashboard): extract dialog confirm entry handler from App` (1.1 第二阶段进展)
- `5233046` `refactor(dashboard): extract dialog handler wiring into factory module` (1.1 第二阶段进展)
- `6567dd8` `refactor(dashboard): extract overview and maintenance handler factories` (1.1 第二阶段进展)
- `5a86065` `refactor(dashboard): extract account and resource handler factory` (1.1 第二阶段进展)
- `8063cce` `refactor(dashboard): aggregate page handlers via useDashboardHandlers hook` (1.1 第二阶段进展)
- `342121d` `refactor(workshop): extract ocr parsing and preview interaction handlers` (1.2 第二阶段进展)
- `7cfb06a` `refactor(workshop): extract history interaction handlers into action factory` (1.2 第二阶段进展)
- `f4b35e1` `refactor(workshop): extract simulation interaction handlers into action factory` (1.2 第二阶段进展)
- `882849e` `refactor(workshop): extract correction handlers for manual price and inventory` (1.2 第二阶段进展)
- `c432701` `refactor(workshop): extract OCR config handlers into action factory` (1.2 第二阶段进展)
- `e74b04b` `refactor(workshop): extract signal rule handlers into action factory` (1.2 第二阶段进展)
- `fc902b9` `refactor(workshop): extract bootstrap and OCR subscription lifecycle hook` (1.2 第二阶段进展)
- `5aa1c55` `refactor(workshop): extract history loading and sync lifecycle hook` (1.2 第二阶段进展)
- `622913b` `refactor(workshop): extract view sync effects into dedicated hook` (1.2 第二阶段进展)
- `8257a5a` `fix(workshop): stabilize lifecycle loaders to avoid stale simulation refresh` (1.2 第二阶段修复)
- `5a7f769` `fix(workshop): persist simulation material edits to active price market` (1.2 第二阶段修复)
- `6907dd0` `refactor(workshop): extract simulation option derivation into hook` (1.2 第二阶段进展)
- `211c500` `refactor(workshop): extract economy and reverse suggestion models into hook` (1.2 第二阶段进展)
- `636e4f0` `refactor(workshop): extract signal and history insight models into hook` (1.2 第二阶段进展)
- `8c4136d` `refactor(workshop): extract OCR display derived models into hook` (1.2 第二阶段进展)
- `b2b0fda` `refactor(workshop): extract OCR preview calibration models into hook` (1.2 第二阶段进展)
- `97da452` `refactor(workshop): extract catalog classification and filter models into hook` (1.2 第二阶段进展)
- `69a8d6c` `refactor(workshop): extract commit runner into dedicated hook` (1.2 第二阶段进展)
- `9fff9f3` `refactor(workshop): extract market analysis panel into dedicated view` (1.2 视图层拆分进展)
- `ea02385` `refactor(workshop): extract simulation panel into dedicated view` (1.2 视图层拆分进展)
- `bbe9d59` `refactor(workshop): extract inventory and reverse recommendation panel` (1.2 视图层拆分进展)
- `9b0046f` `refactor(workshop): extract OCR panel into dedicated view` (1.2 视图层拆分进展)
- `62071a0` `refactor(workshop): centralize panel prop assembly for view composition` (1.2 视图层拆分收尾)
- `9858b65` `refactor(workshop): extract view state declarations into dedicated hook` (1.2 视图层拆分收尾)
- `dce133e` `refactor(workshop): aggregate wiring into useWorkshopViewModel` (1.2 视图层拆分收尾)
- `9b5bd16` `refactor(workshop): move panel prop builder into hooks layer` (1.2 视图层拆分收尾)

验收:
- App/Workshop 主要组件状态数量显著下降（目标: `useState` 数量减少 30%+）。
- 快速录入、OCR 配置、历史筛选操作无行为回归。

## Workstream 5 - 性能、安全与工程化收尾

目标:
- 主线程更稳、边界更安全、回归成本更低。

任务:
- [x] 5.1 将工坊重计算（价格信号/部分 OCR 后处理）迁移到 worker 或可中断计算路径。
- [x] 5.2 收紧 BrowserWindow 安全配置（逐步移除 `contextIsolation: false` / `sandbox: false` 依赖）。
- [x] 5.3 补最小测试体系（`shared/engine`、`shared/time`、关键 store 逻辑）。
- [x] 5.4 文档同步（规则、发布流程、回滚流程）。

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

## 交接记录（2026-02-24）

- 今日停点提交（可直接作为明日继续起点）:
  - `9b5bd16` `refactor(workshop): move panel prop builder into hooks layer`
  - `3cc319c` `docs(refactor): log panel prop builder layer cleanup`
- `1.2` 已收尾完成（面板拆分 + view state / view model 聚合 + 分层清理）。
- 今日所有相关改动已通过:
  - `npm run typecheck`
  - `npm run build`
- 明日（2026-02-25）计划:
  - 启动 `1.3`：拆分 `src/main/workshop-store.ts` 为 `catalog/ocr/pricing/simulation/store` 模块。
  - 建议先做“只迁文件与调用接线，不改行为”的第一刀，再跑 `typecheck/build` 与页面回归。

## 交接记录（2026-02-25）

- `1.3` 已收尾完成:
  - 新增 `src/main/workshop-store-core.ts`，承载原 `workshop-store.ts` 全量实现。
  - 新增 `src/main/workshop-store/{catalog,ocr,pricing,simulation,store}.ts` 域模块转发层。
  - `src/main/workshop-store.ts` 改为聚合导出入口。
  - 主进程调用点改为按域引用:
    - `src/main/ipc/register-workshop-handlers.ts`
    - `src/main/workshop-automation.ts`
    - `src/main/index.ts`
  - 关键提交:
    - `2d596dd` `refactor(store): split workshop store into domain modules with core bridge`
    - `82b9bd4` `refactor(main): route workshop consumers through domain store modules`
- `2.2` 已收尾完成:
  - `commitMutation` 改为签名比较，不再在热路径构建前后快照副本用于差异判断。
  - 变更草稿改为 history-less draft，避免深拷贝历史快照链。
  - 历史 `before` 快照改为仅在 `changed && trackHistory` 时构建。
  - 关键提交:
    - `368b1b4` `refactor(store): avoid snapshot cloning in commitMutation hot path`
    - `e5fc02c` `refactor(store): lazily build history snapshot only when changed`
- `2.3` 已收尾完成:
  - `OperationLogEntry` 增加 `beforeDelta`，保留 `before` 兼容旧数据。
  - 新增增量回滚模型（角色级 `characterChanges` + `characterOrder`），撤销优先回放 delta。
  - `commitMutation` 在记录历史时自动在 delta 与 full snapshot 之间择优（按序列化体积比）。
  - 关键提交:
    - `02f09f8` `refactor(store): add incremental history deltas with snapshot fallback`
- `3.3` 已收尾完成:
  - 新增 `src/shared/ipc-contract.ts` 作为 preload invoke 契约源（channel + payload builder + return type）。
  - preload 通过 `createIpcInvokeBridge(...)` 生成 invoke API，移除手写 `ipcRenderer.invoke(...)` 映射。
  - OCR 事件订阅改为使用同一契约文件中的 event channel 定义。
  - 关键提交:
    - `cf019dd` `refactor(preload): generate invoke api from shared ipc contract`
- `3.4` 已收尾完成:
  - 新增 `src/shared/ipc-error.ts`，统一 IPC 错误编解码（`AION_IPC_ERROR::...`）与标准展示格式。
  - 新增 `src/main/ipc/register-handler.ts`，主进程 invoke handler 统一错误包装（含 channel + code）。
  - preload invoke 统一解析标准错误并抛出格式化消息：`[channel][code] message`。
  - 关键提交:
    - `7b6cb2a` `refactor(ipc): standardize invoke errors with channel and business codes`
- `4.3` 已收尾完成:
  - 新增 `src/renderer/src/features/workshop/selectors/*`，下沉 catalog/economy/insight 派生计算为 selector 层。
  - 引入 `memoizeSelector`（按输入引用缓存）以替代 hooks 内部大块 `useMemo` 计算逻辑。
  - `useWorkshopCatalogModels` / `useWorkshopEconomyModels` / `useWorkshopInsightModels` 改为 selector 调度。
  - 关键提交:
    - `627d25e` `refactor(workshop): move derived models into memoized selector layer`
- `4.4` 已收尾完成:
  - 新增 `scripts/ui-smoke.mjs`（Electron + Playwright）覆盖关键交互流 smoke：
    - 应用启动与主面板渲染
    - 视图切换（设置页 / 工坊 / 角色总览）
    - IPC 标准错误格式回归（`[channel][code] message`）
  - 新增脚本:
    - `npm run smoke:ui`
    - `npm run test:smoke`
  - 关键提交:
    - `aa5e5f6` `test(smoke): add electron ui regression script for key workflows`
- `5.1` 已收尾完成:
  - `importWorkshopOcrPrices` 改为可中断异步处理：OCR 行处理按分片让出事件循环，降低大批量导入时主线程阻塞。
  - `getWorkshopPriceSignals` 改为可中断异步处理：逐条计算信号并周期性让出事件循环，稳定大数据量计算响应。
  - 热键自动抓价流程接线改为 `await importWorkshopOcrPrices(...)`，与异步计算路径一致。
  - 关键提交:
    - `4b29680` `refactor(workshop): make ocr import and signal compute interruptible`
- `5.2` 已收尾完成:
  - 主窗口 `BrowserWindow` 收紧为 `contextIsolation: true` + `sandbox: true`（保留 `nodeIntegration: false`）。
  - OCR 自动抓价覆盖层窗口收紧为 `contextIsolation: true` + `sandbox: true`。
  - preload 构建目标调整为 `cjs` 输出（`out/preload/index.js`），兼容沙箱 preload 加载路径。
  - IPC 错误 token 编解码改为无 Node 模块依赖实现，确保沙箱 preload 仍可解析为标准格式 `[channel][code] message`。
  - 关键提交:
    - `993489a` `security(window): enable sandboxed renderer and isolate overlay`
- `5.3` 已收尾完成:
  - 新增 `vitest` 最小单测体系（`vitest.config.ts` + `npm run test:unit` / `npm run test:unit:watch`）。
  - 为 `shared/time` 增加重置与调度时间回归（daily/weekly reset、scheduled tick、下一次刷新时间窗口）。
  - 为 `shared/engine` 增加关键业务回归（任务打卡、券消耗、set_completed、能量校验、日/周刷新状态重建）。
  - `npm run test:smoke` 接入 `test:unit` 前置执行，形成“单测 + 构建 + UI smoke”最小闭环。
  - 关键提交:
    - `0a7274b` `test(unit): add vitest suite for shared time and engine`
- `5.4` 已收尾完成:
  - 新增 `RELEASE_RUNBOOK.md`，统一沉淀“规则基线 / 正式发布流程 / 回滚流程 / hotfix 最小流程”。
  - `README.md` 同步发布链路文档入口，修正版本下载链接与发布前检查口径（`out/preload/index.js`）。
  - `FRAMEWORK.md` 同步时间规则口径（远征/超越恢复时段、回廊刷新时段）并链接发布回滚基线文档。
  - `scripts/prepackage-check.mjs` 产物检查路径同步为 `out/preload/index.js`，与当前构建产物一致。
  - 关键提交:
    - `fad4c91` `docs(release): sync rules and add publish rollback runbook`
- 本次改动已通过:
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:unit`
  - `npm run check:prepackage`
  - `npm run smoke:ui`
  - `npm run test:smoke`

## 后续优化执行笔记（2026-02-25）

目标:
- 对齐最新 review：从“表层分层”推进到“可测试分层”。

执行清单（按优先级）:
- [ ] A1 拆分 `src/main/workshop-store-core.ts` 为真实域实现（非 re-export），并补域单测。
- [ ] A2 拆分 `src/main/store.ts` 为 `domain + infra adapter`，使业务规则可脱离 Electron I/O 测试。
- [ ] A3 为 renderer 主页面补 CSP（先 production strict baseline，再按需放开）。
- [ ] A4 继续瘦身 `src/renderer/src/App.tsx` 编排层（状态和副作用下沉到 hook/view-model）。

本轮推进记录:
- [x] A1-1：将 `src/main/workshop-store/pricing.ts` 从转发层改为真实实现层（价格快照/历史/信号/规则更新）。
- [x] A1-2：新增 `src/main/workshop-store/pricing-analytics.ts`，下沉纯计算逻辑（趋势判定、星期均价）。
- [x] A1-3：新增 `src/main/workshop-store/pricing-analytics.test.ts`，覆盖趋势判定与星期均价回归。
- [x] A1-4.1：将 `src/main/workshop-store/simulation.ts` 从转发层改为真实实现层（模拟/可制作推荐）。
- [x] A1-4.2：将 `src/main/workshop-store/catalog.ts` 从转发层改为真实实现层（物品/配方增删改）。
- [x] A1-4.3：将 `src/main/workshop-store/store.ts` 从转发层改为真实实现层（状态读取/库存写入），样例 seed 改为 core helper 调用。
- [x] A1-4.4：将 `src/main/workshop-store/ocr.ts` 从转发层改为域入口实现（调用 core OCR helper，去除直接 re-export）。
- [x] A1-4.5：core 清理：移除 `getWorkshopState/upsertWorkshopItem/deleteWorkshopItem/upsertWorkshopRecipe/deleteWorkshopRecipe/upsertWorkshopInventory` 旧公开导出；OCR/目录导入/样例 seed 改为 `*Core` helper 导出，避免对外 API 与域层重复。
- [x] A1-5：补回归测试（workshop 域模块）：
  - `src/main/workshop-store/catalog.test.ts`
  - `src/main/workshop-store/store.test.ts`
  - `src/main/workshop-store/ocr.test.ts`
  - `src/main/workshop-store/pricing-analytics.test.ts`
  - 提交：
    - `b4761b0` `refactor(workshop): move pricing/simulation/store domain logic out of core`
    - `f34b31f` `test(workshop): add coverage for ocr/store domain wrappers and pricing analytics`
- [x] A1-6.1：移除 `src/main/workshop-store-core.ts` 中遗留的 simulation/pricing 旧公开实现与仅供其使用的私有 helper，避免与域模块双实现。
- [x] A1-6.2：将样例 seed 逻辑与样例数据常量下沉到 `src/main/workshop-store/store.ts`，删除 `seedWorkshopSampleDataCore` 与 core 内部样例 seed 常量，收敛 store 域职责。
- [x] A1-6.3：同步更新 `src/main/workshop-store/store.test.ts`，从“委托 core helper”改为验证 store 域 seed 行为。
- [x] A1-6.4：回归验证通过：
  - `npm run typecheck`
  - `npm run test:unit -- src/main/workshop-store`
- [x] A1-6.5：抽离 catalog 纯 helper 到独立共享模块 `src/main/workshop-store/catalog-import-shared.ts`（名称标准化、CSV 解析、导入路径与内置目录定位/签名）。
  - 提交：`62bbe2f` `refactor(catalog): extract shared catalog parsing and path helpers`
- [x] A1-6.6：将目录文件导入入口下沉到 `src/main/workshop-store/catalog.ts`，`core` 仅保留可复用的 `applyCatalogDataCore`。
  - 变更点：
    - 删除 `importWorkshopCatalogFromFileCore`（core 对外入口收敛）
    - `catalog.ts#importWorkshopCatalogFromFile(...)` 负责路径解析/读取/解析/写回
    - `catalog.test.ts` 更新为验证 catalog 域导入流程（不再仅验证“委托 core helper”）
  - 提交：`21431ce` `refactor(catalog): move file-import entrypoint into catalog domain`
  - 回归：
    - `npm run typecheck`
    - `npm run test:unit -- src/main/workshop-store`
- [x] A1-6.7：将 `applyCatalogDataCore` 从 `core` 解耦到专属模块 `src/main/workshop-store/catalog-import-apply.ts`。
  - 变更点：
    - `core` 删除 `applyCatalogDataCore` 实现，改为调用新模块；
    - `catalog.ts` 导入流程改为直接调用 `applyCatalogData(...)`；
    - `catalog.test.ts` mock 更新为 `catalog-import-apply` 模块。
  - 提交：`ca78ff3` `refactor(catalog): decouple applyCatalogData into dedicated module`
  - 回归：
    - `npm run typecheck`
    - `npm run test:unit -- src/main/workshop-store/catalog.test.ts`
    - `npm run test:unit -- src/main/workshop-store`
- [x] A1-6.8：抽离 catalog builtin bootstrap 与 runtime remap 流程到专属模块 `src/main/workshop-store/catalog-bootstrap.ts`。
  - 变更点：
    - `core#readWorkshopState` 改为调用 `rebuildStateWithBuiltinCatalog(...)`；
    - `LEGACY_BUILTIN_ITEM_NAME_REDIRECTS` 与 `buildBuiltinCatalogState/remapRuntimeStateToBuiltin` 从 core 移出。
  - 提交：`3cb43d8` `refactor(catalog): extract builtin bootstrap and remap pipeline from core`
- [x] A1-6.9：将导入文件路径解析 helper 从 catalog shared 拆为通用模块 `src/main/workshop-store/import-file-path.ts`，消除 core 对 catalog shared 的额外耦合。
  - 提交：`520ac13` `refactor(workshop): move import file-path resolver out of catalog shared`
  - 回归：
    - `npm run typecheck`
    - `npm run test:unit -- src/main/workshop-store`
    - `npm run build`
- [ ] A1-6：继续拆 `catalog/ocr/simulation/store` 的剩余 helper，降低 `workshop-store-core.ts` 体量与职责混合度。
