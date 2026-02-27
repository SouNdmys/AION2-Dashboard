# AION2 Dashboard 极简 UI 改造任务单（给 Gemini）

版本基线：`v2.1.0`  
适用目标：将当前界面收敛到类似 ChatGPT Web / macOS 应用的极简体验（低噪音、高一致性、强层级）。

## 1. 目标与边界

### 1.1 目标
- 建立一套统一的视觉系统（Design Tokens + 组件规范 + 页面布局规范）。
- 降低视觉噪音，提升可读性与操作专注度。
- 保持现有业务逻辑与交互能力不变。

### 1.2 非目标（禁止）
- 禁止修改 IPC 协议、store 逻辑、任务计算、工坊算法。
- 禁止新增复杂动画框架或重依赖 UI 库。
- 禁止一次性大改全站；必须分阶段、小提交推进。

## 2. 执行约束（必须遵守）

1. 仅改 `src/renderer/src/**` 样式与展示层代码。  
2. 每一阶段单独提交，commit 粒度要小。  
3. 每一阶段必须通过：
- `npm run typecheck`
- `npm run test:unit`
4. 每一阶段输出“前后对比截图”（桌面 1 张 + 窄屏 1 张）。  
5. 不允许出现“视觉语言混搭”：同一页面只允许 1 套按钮风格、1 套边框风格、1 套阴影层级。

## 3. 设计原则（极简风）

1. 颜色：中性灰阶为主，强调色少而准（1 个主强调色 + 1 个危险色）。  
2. 层级：通过留白/字号/字重建立信息层级，少用高饱和色。  
3. 边界：弱边框 + 轻阴影，避免发光和强渐变喧宾夺主。  
4. 密度：控件高度、圆角、间距统一。  
5. 动效：只保留有语义的过渡（120ms~180ms）。

## 4. 分阶段任务

## Phase 0：基线冻结（先做）

### 任务
1. 记录当前关键页面截图：
- Dashboard：总览、角色操作、设置页。
- Workshop：OCR、市场分析、模拟器。
2. 记录当前公共样式入口与组件入口。

### 验收
- 产出一份简短基线说明（可以写在 PR 描述）。

## Phase 1：Design Tokens 与全局样式收敛

### 主要文件
- `src/renderer/src/styles.css`

### 任务
1. 抽象并统一 CSS 变量（建议）：
- 颜色：`--bg-*`, `--surface-*`, `--text-*`, `--accent-*`, `--danger-*`
- 尺寸：`--radius-*`, `--space-*`, `--control-h-*`
- 阴影：`--shadow-*`
2. 统一基础控件样式：
- `.pill-btn`, `.task-btn`, `.data-pill`, `input/select/textarea`
3. 降低背景复杂度，减少强烈渐变与炫光。

### 验收
- 所有按钮/输入框高度和圆角一致。
- 页面视觉对比更平稳，无刺眼区域。

## Phase 2：Shell 框架统一（布局与导航）

### 主要文件
- `src/renderer/src/features/dashboard/views/DashboardToolbar.tsx`
- `src/renderer/src/features/dashboard/views/DashboardLeftSidebar.tsx`
- `src/renderer/src/features/dashboard/views/DashboardRightSidebar.tsx`
- `src/renderer/src/App.tsx`

### 任务
1. 统一顶栏信息结构：
- 左：主导航
- 右：版本、更新、状态反馈
2. 统一左右侧栏视觉规则：
- 标题、卡片、分组间距、滚动区样式一致。
3. 主区域内容宽度与间距规则统一。

### 验收
- 三栏结构在 1440/1920 宽度下不拥挤、不失衡。
- 顶栏交互密度明显下降，信息更可扫描。

## Phase 3：组件层规范化（Dashboard + Workshop 通用）

### 主要文件（按需）
- `src/renderer/src/features/dashboard/views/*.tsx`
- `src/renderer/src/features/workshop/views/*.tsx`

### 任务
1. 统一卡片头部模板（标题 + 描述 + 操作区）。
2. 统一表格与列表视觉：
- 行高、hover、选中、高亮、危险操作样式一致。
3. 统一状态反馈文案样式：
- success/info/warn/error 的颜色和位置规则。

### 验收
- 不同页面的同类控件“看起来像同一套系统”。
- 危险按钮、主操作按钮可一眼识别。

## Phase 4：信息层级与操作减噪

### 任务
1. 每张卡片只保留 1 个主操作，其余降级为次操作。
2. 合并重复提示文本，减少冗余说明。
3. 优先级信息（例如待办、异常、可疑）保持高对比但不过量使用红色。

### 验收
- 首屏主视图无需滚动即可找到关键操作。
- 同一区域不再出现“按钮墙”。

## Phase 5：动效与可访问性收尾

### 任务
1. 统一 transition 时长与 easing（120~180ms）。
2. 保证 focus-visible 明确可见。
3. 检查对比度与可读性（尤其灰字）。

### 验收
- 键盘导航可清晰看到焦点。
- 动效不突兀、不拖沓。

## 5. 每阶段交付模板（必须按这个给）

1. 改动摘要（3~6 行）。  
2. 改动文件清单。  
3. 设计取舍说明（为什么这么改）。  
4. 回归结果：
- `npm run typecheck`
- `npm run test:unit`
5. 前后截图（桌面 + 窄屏）。

## 6. 给 Gemini 的执行提示词（可直接复制）

你是该项目的 UI 实施工程师。请严格按照 `UI_MINIMAL_REDESIGN_TASKLIST.md` 的当前阶段执行。  
约束：只改 renderer 展示层，不改业务逻辑/IPC/store。  
每次只完成一个 Phase，提交前必须跑 `npm run typecheck && npm run test:unit`。  
输出内容必须包含：改动文件、设计理由、验收截图说明、回归结果。

