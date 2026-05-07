# Message Navigation Panel — 设计文档

## 1. Objective（目标）

解决长 session 消息列表中**快速定位 compact（metadata）消息**的痛点。

当前问题：
- Session 消息可能长达数千条，虚拟滚动只能看到视口内的内容
- Compact 消息（attachment、system、files 等）分散在各个 turn 的 metadata 中
- 用户很难快速找到"某个 assistant 回复前的那条 system/attachment 消息"

目标：在现有 filter 基础上，增加一个**右侧消息导航面板**，让用户通过点击导航条目直接跳转到对应的 compact 消息位置，并短暂高亮提示。

## 2. Commands & Interaction（交互设计）

### 2.1 面板显示

- **位置**：`SessionBrowser` 主内容区右侧，与消息列表并列
- **宽度**：固定 240px，可折叠（折叠后只显示一个展开按钮）
- **标题**："Message Navigator"
- **内容**：列出当前 `displayMessages`（filter 后的结果）中的所有 compact 消息

### 2.2 导航条目

每条导航条目显示：
- **Type label**（如 ATTACH、SYSTEM、FILES）——复用 `CompactMessage` 的 `typeConfig` 配色
- **简短 preview**（如 `hook_success · SessionStart`）——截断到 30 字符
- **时间戳**（如 `03:41:55`）或 **turn 序号**（如 `#12`）

### 2.3 点击行为

点击导航条目后：
1. 主消息列表通过 `virtualizer.scrollToIndex()` 滚动到该 compact 消息所在的 turn
2. 该 compact 消息本身触发**短暂高亮**（2 秒蓝色背景闪烁，使用 CSS transition）
3. 如果该 compact 消息当前被折叠（在 turn 的 metadata 中），自动展开其 JSON 或确保可见

### 2.4 分组折叠

导航面板内按消息类型分组，每组可独立折叠/展开：
- 默认展开所有分组
- 分组标题显示类型名称和消息数量（如 `ATTACH · 15`）

### 2.5 空状态

- 当前 filter 结果中没有 compact 消息 → 面板显示 "No special messages"
- 面板可折叠时，折叠状态下不占内容区宽度

## 3. Project Structure（项目结构变更）

```
components/
  session-browser.tsx              # 布局调整：主内容区改为 3 列（sidebar + messages + nav panel）
  message-stream.tsx               # 新增 scrollToMessage / highlightMessage 的 ref 暴露
  message/
    compact-message.tsx            # 新增 isHighlighted 状态，支持短暂高亮样式
    message-nav-panel.tsx          # 【新增】消息导航面板组件
    message-nav-item.tsx           # 【新增】导航条目组件（可选，如果逻辑简单可合并到 panel）
```

数据流：

```
session-browser.tsx
  ├── displayMessages (filter 后的消息)
  ├── compactMessages = extractCompactMessages(displayMessages)
  ├── MessageStream(ref={streamRef}, messages={displayMessages})
  └── MessageNavPanel(items={compactMessages}, onNavigate={handleNavigate})
        └── 点击条目 → streamRef.scrollToMessage(turnIndex, messageId)
              └── CompactMessage.isHighlighted = true (2s 后自动清除)
```

## 4. Code Style（代码风格）

- 保持现有 Tailwind CSS 工具类风格
- 颜色复用 `CompactMessage` 的 `typeConfig`，不新增颜色定义
- 导航面板使用 `border-l` 分隔，背景色使用 `bg-neutral-50 dark:bg-neutral-900`
- 高亮动画使用 Tailwind `transition-colors` + `animate-pulse` 或自定义 CSS animation
- 组件 props 保持可选，不影响现有调用方

## 5. Testing Strategy（测试策略）

### 5.1 单元测试

`message-nav-panel.test.tsx`（新建）：
- 传入空数组时显示 "No special messages"
- 传入 compact 消息时按类型分组渲染
- 点击条目调用 `onNavigate` 并传入正确的 message id
- 点击分组标题可折叠/展开该组

`compact-message.test.tsx`（补充）：
- 传入 `isHighlighted={true}` 时渲染高亮样式
- 高亮样式在 2 秒后自动清除（可用 vi.useFakeTimers()）

`message-stream.test.tsx`（补充）：
- 调用 `scrollToMessage(turnIndex, messageId)` 时，`virtualizer.scrollToIndex` 被调用

### 5.2 集成测试

手动验证流程：
1. 打开一个长 session，Load all
2. 观察右侧导航面板是否显示所有 compact 消息
3. 点击某条 attachment 导航条目
4. 验证：主列表滚动到对应位置，该 attachment 短暂高亮
5. 选择 type filter（如只显示 system）
6. 验证：导航面板只显示 system 类型的 compact 消息
7. 折叠 ATTACH 分组，验证分组收起

### 5.3 回归测试

- 无 filter 时界面与之前一致（只是右侧多了面板）
- 面板折叠后主内容区宽度恢复
- 虚拟滚动性能无退化

## 6. Boundaries（边界条件与约束）

### 6.1 必须做的（Always Do）
- 导航面板内容必须**实时同步**当前 filter 结果
- 点击导航条目后必须通过**滚动+高亮**双重反馈让用户感知到位置
- 高亮动画必须有**时间限制**（2 秒后自动清除），避免永久高亮
- 新增 compact 类型时，只需在 `typeConfig` 添加配置，导航面板自动识别

### 6.2 需要询问的（Ask First）
- 导航面板默认是展开还是折叠？（建议默认展开，小屏幕自动折叠）
- 高亮颜色除了蓝色，是否需要考虑深色模式差异？（建议复用 focus mode 用过的 `bg-blue-50/50`）
- 是否需要支持键盘导航（上下箭头选择导航条目，Enter 跳转）？（V2 可优化）

### 6.3 禁止做的（Never Do）
- **不修改 API**：导航面板完全基于前端已加载的 `messages` 状态工作
- **不引入新依赖**：使用现有的 `@tanstack/react-virtual` 和 Tailwind
- **不改变现有 filter 行为**：顶部 type filter 的逻辑和交互与现在完全一致
- **不增加操作步骤**：用户不需要先 filter 再点什么，导航面板始终可见，点击即跳转

### 6.4 技术约束

- `MessageStream` 是 `forwardRef` 组件，需要通过 `useImperativeHandle` 暴露 `scrollToMessage` 方法
- `virtualizer.scrollToIndex` 只能滚动到 turn 级别，compact 消息在 turn 内部的高亮需要 `CompactMessage` 自身处理
- 导航面板需要知道每个 compact 消息在 `turns` 数组中的索引，这要求 `extractCompactMessages` 函数同时返回 turnIndex 和 messageId

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 长 session 中 compact 消息数量极多（如 500+），导航面板滚动性能差 | 面板卡顿 | 使用虚拟滚动或限制面板最大高度 + overflow-auto |
| `scrollToIndex` 在大量数据下滚动不到位 | 用户找不到目标消息 | 使用 `{ align: "center", behavior: "smooth" }`，高亮动画提供视觉反馈 |
| 点击导航条目时目标 turn 尚未加载（未 Load all） | 无法跳转 | 导航面板在 `!isFullyLoaded` 时显示提示"Load all to enable navigation" |
| 深色模式下高亮颜色不协调 | 视觉体验差 | 使用 Tailwind dark: 变体，复用现有配色 |

## 8. 验收标准（Acceptance Criteria）

- [ ] 无 filter 时，右侧导航面板显示所有 compact 消息，按类型分组
- [ ] 选择 type filter 后，导航面板实时同步只显示对应类型的 compact 消息
- [ ] 点击导航条目，主列表滚动到对应位置，该 compact 消息短暂高亮（2 秒）
- [ ] 导航面板支持折叠/展开，折叠后不占主内容区宽度
- [ ] 导航面板内的分组支持独立折叠/展开
- [ ] 未 Load all 时，导航面板显示提示而非空列表
- [ ] 新增 compact 类型时，只需修改 `typeConfig`，导航面板自动识别
- [ ] 构建通过，现有测试不失败
