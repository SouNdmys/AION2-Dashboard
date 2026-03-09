# UI 改造 Phase 8 交付说明（导航左移 + 中栏净化）

基线版本：`v2.1.3`  
执行日期：`2026-03-09`

## 1. 改动摘要

1. 顶部“控制台导航”移出中栏，改到左侧栏：
   - 中栏不再先看到导航卡
   - 交互方式更接近 ChatGPT 左侧目录
2. 删除中栏顶部总览统计卡：
   - `可远征角色 / 清空奥德预估 / 每日使命未清 / 每周指令未清`
   - 释放中栏首屏空间
3. 工坊顺序修正：
   - `做装模拟器` 现在稳定在 `专业模式` 上方
4. 做装模拟器材料明细改为默认展开：
   - 不再额外点开折叠项
   - 直接看材料、库存修正和价格修正

## 2. 文件清单

1. `src/renderer/src/App.tsx`
2. `src/renderer/src/features/dashboard/views/DashboardLeftSidebar.tsx`
3. `src/renderer/src/WorkshopView.tsx`
4. `src/renderer/src/features/workshop/views/WorkshopSimulationPanel.tsx`
5. `package.json`
6. `UI_PHASE8_NAV_AND_CANVAS_CLEANUP.md`
7. `artifacts/ui-baseline/phase8/`

## 3. 设计取舍

1. 中栏只保留内容本身：
   - 首屏不再让导航和汇总卡抢走注意力。
   - 用户进入应用后直接看到“当前页真正要操作的东西”。
2. 左侧栏承担目录职责：
   - 更符合桌面工作台与 ChatGPT 式导航心智。
   - 目录、版本、检查更新都固定在左边，切页更自然。
3. 做装结果默认展开明细：
   - 这里本来就是主任务的一部分。
   - 额外再做折叠只会增加一次不必要点击。

## 4. 回归结果

1. `npm run typecheck`：通过
2. `npm run test:unit`：通过
3. `npm run build`：通过
4. `node scripts/ui-baseline-phase0-capture.mjs --out-dir artifacts/ui-baseline/phase8`：通过，输出 `16` 张截图

## 5. 截图产物

1. 目录：`artifacts/ui-baseline/phase8/`
2. 索引：`artifacts/ui-baseline/phase8/manifest.json`
3. 本轮重点：
   - 左侧栏目录感是否成立
   - 中栏开场是否终于足够干净
   - 工坊默认画面是否更像单任务工作台

## 6. 验收结论

1. 中栏已明显去掉“导航层”和“统计层”干扰。
2. 工坊默认视图已更接近单一任务面板。
3. 下一轮若继续，应集中在：
   - 角色操作页继续减重
   - 设置页分组层级再压缩
   - 左右栏局部密度细修
