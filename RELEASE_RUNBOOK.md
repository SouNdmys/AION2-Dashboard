# AION2 Dashboard 发布与回滚 Runbook

最后更新: 2026-02-25
适用版本线: `v2.0.1+`

## 1. 规则基线（发布前必须核对）

以下文件是当前实现的基线来源，发布前若有规则改动，必须同步文档与发布说明:

- 角色/时间规则:
  - `src/shared/constants.ts`
  - `src/shared/time.ts`
  - `src/shared/engine.ts`
- 工坊规则:
  - `src/main/workshop-store-core.ts`
  - `WORKSHOP_FRAMEWORK.md`
- IPC 契约与错误规范:
  - `src/shared/ipc-contract.ts`
  - `src/shared/ipc-error.ts`

当前关键时间规则（实现口径）:

- 每日重置: `05:00`
- 每周重置: `周三 05:00`
- 奥德基础能量恢复: `02:00 / 05:00 / 08:00 / 11:00 / 14:00 / 17:00 / 20:00 / 23:00`
- 远征恢复: `05:00 / 13:00 / 21:00`
- 超越恢复: `05:00 / 17:00`
- 回廊刷新: `周二 / 周四 / 周六 21:00`

## 2. 发布流程（正式）

### 2.1 发布前准备

1. 确认当前分支状态干净:
   - `git status --short`
2. 更新版本相关文档:
   - `README.md`（版本与说明）
   - `RELEASE_NOTES_vX.Y.Z.md`
   - `OPERATION_LOG.md`
3. 若涉及规则变更，先更新本 runbook 的“规则基线”。

### 2.2 发布前检查（必须全部通过）

按顺序执行:

```bash
npm run test:unit
npm run typecheck
npm run build
npm run check:prepackage
npm run test:smoke
npm run check:release-yml
```

通过标准:

- `test:unit` 通过（核心规则回归）
- `typecheck` 通过（无 TS 断裂）
- `build` 通过（主进程/preload/renderer 产物齐全）
- `check:prepackage` 通过（关键产物存在性检查）
- `test:smoke` 通过（UI 关键链路无回归）
- `check:release-yml` 通过（自动更新元数据与安装包哈希一致）

### 2.3 产包与发布

1. 本地产包（不推送 Release）:
   - `npm run dist:win`
2. 正式发布到 GitHub Releases:
   - `npm run dist:win:publish`
3. 发布后核对:
   - Release 页面版本号与 tag 一致
   - `latest.yml` 中 `path/sha512/size` 与安装版资产完全一致
   - 资产包含 `Setup` / `Portable` / `win.7z`（若策略未调整）
   - 安装版可正常启动并读取构建信息
   - 自动更新链路（安装版）可检出新版本

## 3. 回滚流程

### 3.1 代码回滚到稳定标签

> 仅在确认新版本存在严重问题时执行。

```bash
git checkout main
git fetch --tags
git reset --hard <stable-tag>
git push origin main --force-with-lease
```

示例:

```bash
git reset --hard v2.0.1
git push origin main --force-with-lease
```

### 3.2 发布通道回滚

1. 在 GitHub Releases 将问题版本标记为不可用（删除或下架问题资产）。
2. 确保上一稳定版本 Release 仍可下载。
3. 重新从稳定代码重新打包并发布（必要时发 `vX.Y.Z+hotfix`）。

### 3.3 用户侧回退建议

1. 先导出当前数据（JSON 导出）做备份。
2. 卸载问题版本（如需）。
3. 安装上一稳定版 `Setup` 或使用稳定版 `Portable`。

## 4. Hotfix 最小流程

当线上故障需要快速止血时，最小流程如下:

1. 新建 hotfix 分支并修复问题。
2. 至少执行:
   - `npm run test:unit`
   - `npm run typecheck`
   - `npm run build`
   - `npm run smoke:ui`
3. 合并后发布 `vX.Y.Z+1`（或约定热修语义版本）。
4. 更新:
   - `RELEASE_NOTES_vX.Y.Z+1.md`
   - `OPERATION_LOG.md`
   - 本 runbook（若流程口径发生变化）
