# AION2 Dashboard

本地离线的 AION2 多账号/多角色进度管理桌面工具。  
目标是降低“周常/日常清单”的心智负担，让你先看优先级，再快速录入进度。

作者: `SouNd`

## 核心功能

- 多账号与多角色管理（单账号最多 8 角色）
- 三栏工作流布局：
  - 左栏: 账号与角色管理
  - 中栏: 角色总览 / 角色操作 / 设置
  - 右栏: 倒计时、优先级待办、操作日志
- 角色总览筛选与排序：按可执行项、账号、大区、任务类型快速过滤
- 总览快速录入：可直接选择角色 + 内容 + 动作 + 次数提交
- 角色操作面板：任务完成、吃券、手动设定、能量与回廊录入
- 微风商店与变换记录：
  - 微风商店: 奥德购买、每日副本挑战券购买
  - 变换: 奥德能量变换
  - 支持账号内“额外 +8 资格角色”
- 优先级待办（Top 8）: 基于收益、临近周刷新、溢出风险排序
- 倒计时面板：远征恢复、超越恢复、每日重置、每周重置、回廊刷新
- 周统计校准：远征/超越已完成次数可手动回填，防止误清空后失真
- 撤销与历史：支持撤销一步/多步、清空历史
- 数据管理：JSON 导入/导出
- 自动备份：每天首次启动自动落盘一份备份
- 构建信息展示：设置页可查看版本、构建时间、作者

## 关键规则（当前实现）

- 每日重置: `05:00`
- 每周重置: `周三 05:00`
- 远征恢复: `05:00 / 13:00 / 21:00`
- 超越恢复: `05:00 / 17:00`
- 回廊刷新: 以 `21:00` 为锚点，每 `48` 小时推算下一次刷新
- 周刷新前 `48` 小时进入高亮窗口（重点任务标红）

## 快速开始

### 环境要求

- Node.js `>= 20`
- npm `>= 10`

### 本地开发

```bash
npm install
npm run dev
```

## 构建与发布前检查

```bash
npm run check:prepackage
```

该命令会自动执行:

1. `npm run typecheck`
2. `npm run build`
3. 校验构建产物是否存在:
   - `out/main/index.js`
   - `out/preload/index.mjs`
   - `out/renderer/index.html`

仅构建（不做检查）:

```bash
npm run build
```

Windows 本地打包（不发布更新元数据）:

```bash
npm run dist:win
```

Windows 发布（上传到 GitHub Releases，客户端可自动更新）:

```bash
npm run dist:win:publish
```

说明:
- 自动更新仅对 `NSIS` 安装版生效，`portable` 包不参与自动更新安装流程。
- 客户端会在启动时检查 GitHub Releases，新版本下载完成后提示重启安装。

## 数据与备份

- 应用状态由 `electron-store` 本地持久化
- 设置页支持一键导出/导入 JSON（便于换设备迁移）
- 自动备份目录:
  - `文档/aion2-dashboard-auto-backups/`
  - 每天首次打开自动生成一份备份

## 项目结构

- `src/main`: Electron 主进程、IPC 注册、持久化与备份逻辑
- `src/preload`: 安全桥接 API
- `src/renderer`: React 界面
- `src/shared`: 类型、常量、时间规则、计算引擎
- `scripts/prepackage-check.mjs`: 打包前自检脚本
- `OPERATION_LOG.md`: 迭代日志
- `FRAMEWORK.md`: 架构基线说明

## 常用命令

```bash
npm run dev
npm run typecheck
npm run build
npm run check:prepackage
```

## 开源说明

本项目计划开源发布。许可证文件可在发布前按你的策略补充（例如 AGPL 或其他协议）。
