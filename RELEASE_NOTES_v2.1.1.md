# AION2 Dashboard v2.1.1

发布日期：2026-02-27

## 本次版本定位

- `v2.1.1` 为 `v2.1.0` 后的补丁热修版。
- 目标是修复安装版 OCR 模型加载故障，并优化工坊高频入口位置。

## 功能与修复

- OCR 安装版模型加载修复：
  - 修复报错 `Load model ... app.asar ... File doesn't exist`。
  - 打包配置补充 `asarUnpack`，并在运行时优先回退到解包资源路径加载 ONNX 模型。
- 工坊入口调整：
  - “做装模拟器”卡片调整到工坊页面首位，便于高频使用。

## 回归验证

- 已执行 `npm run test:smoke`
- 已执行 `npm run dist:win`

