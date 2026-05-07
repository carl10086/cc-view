# Message Navigation Panel — 实现计划

## Dependency Graph（依赖关系）

```
lib/message-grouping.ts
  ├── 新增 extractCompactMessages()
  │
  ├── components/message/compact-message.tsx    # 新增 isHighlighted prop
  │       ↑
  ├── components/message-stream.tsx             # 暴露 scrollToMessage() ref API
  │       ↑
  └── components/session-browser.tsx            # 布局整合 + 数据流连接
          ↑
      components/message/message-nav-panel.tsx  # 【NEW】导航面板
```

数据流方向：`session-browser` → `message-nav-panel` + `message-stream` → `compact-message`

---

## Task Breakdown（垂直切片）

### Task 1: 核心交互路径 — 滚动到消息 + 高亮

**Scope**: `lib/message-grouping.ts`, `components/message/compact-message.tsx`, `components/message-stream.tsx`, 测试文件

**Acceptance Criteria**:
- [ ] `lib/message-grouping.ts` 新增 `extractCompactMessages(messages)` 函数，返回 `{ turnIndex, messageId, type, preview, timestamp }[]`
- [ ] `CompactMessage` 接收可选的 `isHighlighted?: boolean` prop，为 true 时渲染蓝色背景高亮
- [ ] `CompactMessage` 高亮状态 2 秒后自动清除（使用 `useEffect` + `setTimeout`）
- [ ] `MessageStream` 的 `useImperativeHandle` 暴露 `scrollToMessage(messageId: string)` 方法
- [ ] `scrollToMessage` 内部：遍历 turns 找到包含该 messageId 的 turn 索引，调用 `virtualizer.scrollToIndex()`
- [ ] `scrollToMessage` 同时设置内部状态 `highlightedMessageId`，传递给对应的 `CompactMessage`
- [ ] 临时手动测试可验证：在 `session-browser` 中添加临时按钮调用 `scrollRef.current?.scrollToMessage("某id")`

**Implementation Steps**:

1. `lib/message-grouping.ts`:
   ```typescript
   export interface CompactMessageNavItem {
     turnIndex: number
     messageId: string
     type: string
     preview: string
     timestamp: Date | null
   }
   
   export function extractCompactMessages(messages: SessionMessage[]): CompactMessageNavItem[] {
     // 遍历 turns，收集所有 metadata 中的非 user/assistant 消息
   }
   ```

2. `components/message/compact-message.tsx`:
   - 新增 `isHighlighted?: boolean` prop
   - 使用 `useEffect`：当 `isHighlighted` 变为 true 时，设置内部状态，2 秒后清除
   - 高亮样式：`bg-blue-50 dark:bg-blue-900/20 transition-colors duration-300`

3. `components/message-stream.tsx`:
   - `useImperativeHandle` 当前暴露 `parentRef.current`，需要扩展为对象：
     ```typescript
     useImperativeHandle(forwardedRef, () => ({
       scrollToMessage: (messageId: string) => { ... },
       getScrollElement: () => parentRef.current,
     }))
     ```
   - 新增内部状态 `highlightedMessageId: string | null`
   - `scrollToMessage` 遍历 turns 和 metadata 找到对应 message，设置 `highlightedMessageId`
   - 渲染 `CompactMessage` 时传递 `isHighlighted={msg.id === highlightedMessageId}`

**Verification**:
```bash
npx vitest run
npm run build
```
手动验证：临时添加按钮调用 `scrollToMessage`，确认滚动到正确位置且 CompactMessage 高亮 2 秒。

---

### Task 2: 导航面板组件

**Scope**: `components/message/message-nav-panel.tsx`（新建），测试文件

**Acceptance Criteria**:
- [ ] 导航面板接收 `items: CompactMessageNavItem[]` 和 `onNavigate: (messageId: string) => void` props
- [ ] items 按 `type` 分组，默认展开所有分组
- [ ] 分组标题显示类型名称和数量（如 `ATTACH · 15`）
- [ ] 点击分组标题可折叠/展开该组
- [ ] 每条导航条目显示：type label（复用 `typeConfig` 配色）、preview（截断 30 字符）、时间戳
- [ ] 点击导航条目调用 `onNavigate(messageId)`
- [ ] 空数组时显示 "No special messages"
- [ ] 面板支持整体折叠/展开（顶部有 toggle 按钮）
- [ ] 面板高度限制为 `h-full overflow-y-auto`

**Implementation Steps**:

1. `components/message/message-nav-panel.tsx`（新建）：
   ```typescript
   interface MessageNavPanelProps {
     items: CompactMessageNavItem[]
     onNavigate: (messageId: string) => void
     isCollapsed?: boolean
     onToggleCollapse?: () => void
   }
   ```
   - 使用 `useMemo` 将 items 按 type 分组
   - 每个分组使用内部状态控制折叠
   - 整体折叠时只显示一个展开按钮（固定在右侧边缘）

2. 复用 `CompactMessage` 的 `typeConfig` 获取 type label 和颜色

**Verification**:
```bash
npx vitest run
npm run build
```
手动验证：临时渲染 `<MessageNavPanel items={mockItems} onNavigate={console.log} />`，确认分组、折叠、点击行为正确。

---

### Task 3: SessionBrowser 布局整合

**Scope**: `components/session-browser.tsx`

**Acceptance Criteria**:
- [ ] `SessionBrowser` 主内容区从 2 列（sidebar + detail）改为支持 3 列（sidebar + messages + nav panel）
- [ ] 使用 `useMemo` 计算 `compactNavItems = extractCompactMessages(displayMessages)`
- [ ] 将 `scrollRef` 从 `HTMLDivElement` 改为自定义 ref 类型（含 `scrollToMessage` 方法）
- [ ] `MessageNavPanel` 放在 detail 区域的右侧，宽度 240px
- [ ] 点击导航条目时调用 `scrollRef.current?.scrollToMessage(messageId)`
- [ ] `!isFullyLoaded` 时，导航面板显示提示 "Load all to enable navigation" 而非空列表
- [ ] 面板默认展开，小屏幕（lg 以下）自动隐藏
- [ ] 移除 Task 1 的临时测试按钮

**Implementation Steps**:

1. `session-browser.tsx` 布局调整：
   ```typescript
   // 当前布局
   <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
     <div className="lg:col-span-1"> /* sidebar */ </div>
     <div className="lg:col-span-3"> /* detail */ </div>
   </div>
   
   // 新布局（detail 内再分 2 列：messages + nav panel）
   <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
     <div className="lg:col-span-1"> /* sidebar */ </div>
     <div className="lg:col-span-3">
       <div className="flex h-full gap-0">
         <div className="flex-1"> /* MessageStream */ </div>
         <div className="w-60 border-l"> /* MessageNavPanel */ </div>
       </div>
     </div>
   </div>
   ```

2. 数据流连接：
   ```typescript
   const compactNavItems = useMemo(() => 
     extractCompactMessages(displayMessages)
   , [displayMessages])
   
   function handleNavigate(messageId: string) {
     streamRef.current?.scrollToMessage(messageId)
   }
   ```

3. Ref 类型调整：
   ```typescript
   interface MessageStreamHandle {
     scrollToMessage: (messageId: string) => void
   }
   
   const streamRef = useRef<MessageStreamHandle>(null)
   ```

**Verification**:
```bash
npx vitest run
npm run build
```
手动验证完整流程：
1. 打开 session，Load all
2. 观察右侧导航面板是否显示所有 compact 消息
3. 点击某条 attachment 导航条目
4. 验证：主列表滚动到对应位置，该 attachment 短暂高亮
5. 选择 type filter（如只显示 system）
6. 验证：导航面板实时同步只显示 system 类型的 compact 消息
7. 折叠 ATTACH 分组，验证分组收起

---

## Checkpoints（检查点）

| 检查点 | 触发条件 | 验证内容 |
|--------|---------|---------|
| CP-1 | Task 1 完成后 | scrollToMessage 能正确滚动到目标 turn，CompactMessage 高亮 2 秒后自动清除 |
| CP-2 | Task 2 完成后 | MessageNavPanel 独立渲染正确：分组、折叠、点击回调、空状态 |
| CP-3 | Task 3 完成后 | 完整功能可用：布局正确、filter 联动、未 Load all 提示、测试通过、构建通过 |

---

## Risk & Mitigation（风险与缓解）

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `scrollToMessage` 找不到对应 messageId | 不滚动，用户困惑 | Task 1 防御性检查：找不到时静默忽略 |
| `useImperativeHandle` 改变 ref 类型破坏现有调用方 | 编译错误 | Task 1 确保 ref 类型向后兼容（对象含 `scrollToMessage` 方法） |
| 导航面板在超多 compact 消息下卡顿 | 面板滚动性能差 | Task 2 限制面板最大高度 + `overflow-y-auto`，V2 可引入虚拟滚动 |
| 布局从 2 列变 3 列导致小屏幕体验变差 | 移动端不可用 | Task 3 使用响应式：小屏幕隐藏面板，lg 以上显示 |
| `extractCompactMessages` 重复遍历大数据 | CPU 占用高 | Task 1 使用 `useMemo` 缓存结果，避免每次渲染重新计算 |
