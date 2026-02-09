# AION 2 Dashboard - Framework Baseline

## 1. Goal
- Local desktop app to track multi-character daily/weekly progress.
- Core loop: completion check-in -> energy/count consumption -> auto refresh -> gold estimation update.
- Priority order: business logic correctness first, visual polish later.

## 2. Tech Stack
- Electron (`src/main`, `src/preload`) for desktop shell and local persistence.
- React + Vite (`src/renderer`) for UI rendering.
- TypeScript across main/preload/renderer/shared.
- Tailwind CSS + custom CSS for glass-style base.
- `electron-store` as local JSON persistence.

## 3. Current Domain Model
- Shared model in `src/shared/types.ts`.
- Character dimensions:
  - Energy: `baseCurrent` + `bonusCurrent`, with `baseCap`/`bonusCap`.
  - Missions: daily, weekly, abyss lower/mid.
  - Activities: nightmare, awakening, suppression, daily dungeon, expedition, transcendence, sanctum, artifact.
  - Weekly stats: task completions + weekly gold earned.
- Task action modes:
  - `complete_once`: 按输入次数完成并扣减资源（远征/超越/圣域箱会扣奥德）。
  - `use_ticket`: 吃券 +1（恶梦/觉醒/讨伐/远征/超越）。
  - `set_completed`: 直接录入“已完成次数”（用于指令书类）。

## 4. Rule Engine
- Implemented in `src/shared/engine.ts` + `src/shared/time.ts`.
- Includes:
  - Energy regen every 3 hours +15 (natural regen only fills base energy).
  - Energy consumption priority: base first, bonus second.
  - Daily reset at 05:00.
  - Weekly reset at Wednesday 05:00.
  - Expedition charge ticks: 04:00 / 12:00 / 20:00.
  - Transcendence charge ticks: 03:00 / 15:00.
  - Gold estimate logic: prioritize high value runs under current energy budget.
  - Weekly stats auto reset together with weekly reset.
  - Expedition weekly all-character run cap: 84.

## 5. Dashboard Baseline Cards
- Global:
  - Characters ready for expedition (energy >= 80 and expedition count > 0).
  - Total estimated gold if all characters clear current energy.
  - Weekly recorded gold (all characters).
  - Weekly expedition/transcendence completed counts.
  - Characters with pending daily missions.
  - Characters with pending weekly missions.
- Current character:
  - Split energy display (`base(+bonus)/baseCap`).
  - Energy bar with base+bonus segments.
  - Mission counters + weekly completion counters.
  - Pending labels (nightmare / awakening / suppression / artifact etc.).
  - Config-driven task cards with 3 action buttons:
    - 完成次数
    - 吃券 +1
    - 录入已完成

## 6. Manual Controls Included
- Add character.
- Rename character.
- Switch current character.
- Manual segmented energy override (base + bonus).
- Manual artifact availability update.
- Manual weekly stats reset (for daily bookkeeping scenarios).

## 7. Suggested Next Iterations
1. Add dedicated settings page:
  - Per-activity gold config.
   - Optional cost overrides.
2. Add event timeline:
   - Next expedition/transcendence tick countdown.
   - Next weekly reset countdown.
3. Add per-character journal:
   - "why used count_only" notes.
   - Operation history for rollback.
4. Add animation layer:
   - Task completion burst.
   - Progress bar shimmer and card state transitions.
5. Add import/export:
   - Backup and restore local JSON snapshots.
