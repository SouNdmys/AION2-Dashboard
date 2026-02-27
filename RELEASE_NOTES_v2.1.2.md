# AION2 Dashboard v2.1.2

发布日期：2026-02-27

## 本次版本定位

- `v2.1.2` 为 OCR 安装版故障的二次热修版。
- 目标是彻底修复安装版 OCR 模型加载失败，并确保自动更新元数据一致性。

## 功能与修复

- OCR 安装版路径修复（重点）：
  - 修复 ONNX 模型路径候选可能命中 `app.asar` 的问题。
  - 路径解析改为优先 `app.asar.unpacked` 物理路径，避免 `File doesn't exist`。
- 自动更新校验修复：
  - 对齐 `latest.yml` 的 `sha512/size/path` 与实际安装包，修复 checksum mismatch 报错。
- 发布流程防回归：
  - 已接入 `check:release-yml` 自动校验，发包后自动拦截元数据与安装包不一致问题。

## 回归验证

- 已执行 `npm run test:smoke`
- 已执行 `npm run dist:win`

