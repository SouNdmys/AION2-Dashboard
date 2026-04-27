# v2.2.6 发布说明

## 版本名

`回廊刷新时间热修`

## 本次重点

- 深渊回廊刷新规则更新：
  - 统一刷新时间从旧的 `周二 / 周四 / 周六 21:00`
  - 调整为新的 `周三 / 周六 22:00`
- 同步更新范围：
  - 回廊倒计时
  - 同步回廊时写入的下次刷新时间
  - 设置页中的回廊规则说明

## 校验

- `npm run typecheck`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run dist:win`
- `npm run check:release-yml`
