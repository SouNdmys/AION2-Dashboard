# AION2 Dashboard v2.0.1

发布日期：2026-02-23

## Hotfix

- 修复工坊初始化报错：
  - `Error invoking remote method 'workshop:get-state': Error: 未找到内置目录文件: 制作管理.md`
- 修复内容：
  - 内置目录文件查找路径增强，兼容开发模式与安装包运行路径。
  - Windows 打包资源新增 `制作管理.md`，避免安装版缺失内置目录文件。

## 影响范围

- 工坊页面首次进入与内置目录自动加载。
- 不涉及角色进度计算规则变更，不影响既有存档结构。

