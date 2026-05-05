# Message Stream 虚拟滚动与过滤优化 — 实施计划

## 组件依赖图

```
Project Page (server)
  ↓ props
SessionBrowser (client) [核心状态容器]
  ├── SessionSidebar (左侧 session 列表 — 无改动)
  ├── Header (新增控制栏)
  │     └── 状态: sortOrder, pageSize, isFullyLoaded, selectedTypes
  ├── MessageStream (大幅改动)
  │     ├── useVirtualizer (新增)
  │     ├── groupMessagesIntoTurns (复用)
  │     └── MessageTurn[] (复用，需支持 ref 测量)
  └── Status Bar (底部状态，简化)

API Route (/api/.../sessions/{id})
  ↓
getSessionMessages (lib/claude-data.ts)
  ↓
jsonl file
```

---

## 任务分解（垂直切片）

每个任务是一条**完整可验证的功能路径**，而非水平分层。

---

### Task 1: API 与数据层改造 — 支持倒序分页

**目标**：让服务端能够按正序或倒序返回分页消息。

**改动文件**：
- `app/api/projects/[projectId]/sessions/[sessionId]/route.ts`
- `lib/claude-data.ts`

**具体步骤**：
1. `route.ts` 增加 `order` 查询参数读取和校验（`"asc" | "desc"`，默认 `"asc"`）
2. `getSessionMessages` 增加 `order` 参数
3. `getSessionMessages` 改为**统一解析全部消息**，然后按 `order` 反转（如需要），最后 `slice(offset, offset + limit)`
4. 保持现有 ID 生成逻辑：`obj.uuid ? \`${obj.uuid}-${index}\` : \`${index}\``

**验收标准**：
- [ ] `curl "/api/.../sessions/xxx?offset=0&limit=10&order=asc"` 返回最早的 10 条
- [ ] `curl "/api/.../sessions/xxx?offset=0&limit=10&order=desc"` 返回最新的 10 条
- [ ] `curl "...order=desc&offset=10&limit=10"` 返回次新 10 条
- [ ] 响应中 `total` 和 `hasMore` 正确

**验证命令**：
```bash
# 假设有 3778 条消息的 session
curl -s "http://localhost:3000/api/projects/.../sessions/xxx?offset=0&limit=1&order=asc" | jq '.messages[0].type'
curl -s "http://localhost:3000/api/projects/.../sessions/xxx?offset=0&limit=1&order=desc" | jq '.messages[0].type'
# 两者应返回不同类型的消息（最早 vs 最新）
```

---

### Task 2: MessageStream 虚拟滚动 — 渲染层核心

**目标**：仅渲染可视区域的 turns，解决长列表 DOM 性能问题。

**改动文件**：
- `components/message-stream.tsx`
- `package.json`（新增依赖）

**具体步骤**：
1. `npm install @tanstack/react-virtual`
2. `MessageStream` 改为使用 `useVirtualizer`：
   - `count: turns.length`
   - `getScrollElement: () => parentRef.current`
   - `estimateSize: () => 150`
   - `measureElement: (el) => el.getBoundingClientRect().height`
   - `overscan: 5`
3. 渲染结构改为 absolute positioning：外层容器设 `position: relative`，每个虚拟 item 用 `transform: translateY(${start}px)` 定位
4. 通过 `useImperativeHandle` 将内部滚动容器 ref 暴露给父组件
5. 空状态保持不变（`turns.length === 0` 时显示 "No messages"）

**验收标准**：
- [ ] 打开 3778 条消息的 session，Chrome DevTools Elements 面板中 `<MessageTurn>` 节点数量稳定在 ~15-20 个（而非 1000+）
- [ ] 快速滚动无白屏、无卡顿
- [ ] 展开 JSON 后，虚拟列表自动调整高度，无重叠或空白

**验证方法**：
1. 打开 DevTools → Elements → 搜索 `MessageTurn`，确认节点数 < 30
2. React DevTools Profiler 录制滚动过程，无 > 50ms 的渲染帧

---

### Task 3: 无限滚动与加载全部 — 交互层

**目标**：滚动到底自动加载，支持一键加载全部消息。

**改动文件**：
- `components/session-browser.tsx`

**具体步骤**：
1. `MessageStream` 新增 `onScrollNearBottom?: () => void` prop
2. `MessageStream` 内通过 `useEffect` 监听 `virtualItems`：当最后一个虚拟 item 的 `index >= turns.length - 3` 时调用 `onScrollNearBottom`
3. `SessionBrowser` 提供 `handleScrollNearBottom` 回调：判断 `hasMore && !loadingMore && !isFullyLoaded` 时调用 `loadMore()`
4. 实现 `loadAll()` 函数：
   - while 循环，每次加载 `pageSize` 条
   - 每次加载后 `setMessages(accumulated)` 渐进更新 UI
   - 完成后 `setIsFullyLoaded(true)`
5. 原有底部 "Load more" 按钮改为状态提示文字（"Scroll to load more • N remaining"）

**验收标准**：
- [ ] 滚动到底部时，自动触发下一页加载，无需点击按钮
- [ ] 点击 "Load all" 后，渐进加载所有剩余消息，UI 不冻结
- [ ] 加载全部完成后，底部显示 "All messages loaded"
- [ ] 小 session（首次加载后 `hasMore === false`）自动 `setIsFullyLoaded(true)`

**验证方法**：
1. 打开大 session，滚动到底，观察网络面板出现连续 fetch 请求
2. 点击 "Load all"，观察消息计数逐步增长到 total

---

### Task 4: Header 控制栏 — UI 层

**目标**：提供排序、页大小、加载全部、类型过滤的交互控件。

**改动文件**：
- `components/session-browser.tsx`

**具体步骤**：
1. Header 区域重新设计为两行布局：
   - 第一行：统计文本（左）+ 控件组（右：排序切换、页大小下拉、Load all 按钮）
   - 第二行：类型过滤 chips（仅 `isFullyLoaded` 时显示）
2. 排序切换：分段按钮（segmented control）样式，`"asc"` 显示 "Oldest first"，`"desc"` 显示 "Newest first"
3. 页大小选择：`<select>`，选项 500/1000/2000
4. Load all 按钮：仅在 `!isFullyLoaded` 时显示，加载中禁用
5. 类型过滤：
   - `availableTypes` 从 `messages` 动态提取（`Set` 去重）
   - 每个类型一个 capsule chip，点击 toggle
   - 选中状态：`bg-neutral-800 text-white`
   - 未选中状态：`bg-neutral-100 text-neutral-600`
   - 有选中时显示 "Clear" 按钮
6. 未全量时显示提示："Scroll to load more, or click 'Load all' to enable filtering"

**验收标准**：
- [ ] 排序切换即时生效，列表清空并按新顺序重新加载
- [ ] 页大小切换即时生效，列表清空并以新批次大小重新加载
- [ ] Load all 按钮加载中显示 "Loading..." 并禁用
- [ ] 全量后过滤 chips 出现，点击即时过滤消息列表
- [ ] Clear 按钮清空所有过滤条件
- [ ] 所有控件在 `loadingMore` 时被禁用

**验证方法**：
1. 切换排序，确认网络请求参数变化，列表内容反转
2. 加载全部后，选择/取消类型，确认列表即时更新（无网络请求）

---

### Task 5: 状态集成与边界处理

**目标**：处理各种边界场景，确保体验完整。

**改动文件**：
- `components/session-browser.tsx`
- `components/message-stream.tsx`

**具体步骤**：
1. **排序/页大小切换时重置**：
   - `setMessages([])`, `setHasMore(false)`, `setIsFullyLoaded(false)`
   - `setSelectedTypes(new Set())`
   - `scrollRef.current.scrollTop = 0`（asc）或 `scrollHeight`（desc）
2. **过滤后的空状态**：
   - `MessageStream` 接收 `filteredMessages`，`turns.length === 0` 时显示 "No messages match the filter"
3. **请求去重**：
   - 切换排序/页大小时 `AbortController` 中断旧请求
   - `loadMore` 和 `loadAll` 使用 `requestIdRef` 丢弃过期响应
4. **加载全部进度**：
   - Header 统计文本在加载全部时显示 "loading..."

**验收标准**：
- [ ] 快速切换排序两次，不会显示旧排序的数据
- [ ] 过滤导致无结果时，显示空状态提示（而非空白）
- [ ] 小 session（< pageSize）首次加载后自动启用过滤
- [ ] 加载全部过程中切换 session，旧加载任务停止，新 session 正常加载

**验证方法**：
1. 快速点击排序切换两次，观察网络请求和 UI，无数据错乱
2. 过滤到无结果，确认显示空状态
3. 打开小 session，确认过滤 chips 直接可用

---

## 检查点

| 检查点 | 触发条件 | 验证内容 |
|--------|---------|---------|
| **CP1** | Task 1 + Task 2 完成 | API 倒序返回正确，虚拟滚动渲染节点数 < 30 |
| **CP2** | Task 3 + Task 4 完成 | 无限滚动自动加载，控制栏交互正常 |
| **CP3** | Task 5 完成 | 边界场景处理完善，可进入全面测试 |

---

## 实施顺序

```
Task 1 (API 层)
    ↓
Task 2 (MessageStream 虚拟滚动)
    ↓ 检查点 CP1
Task 3 (无限滚动 + 加载全部)
    ↓
Task 4 (Header 控制栏)
    ↓ 检查点 CP2
Task 5 (状态集成 + 边界处理)
    ↓ 检查点 CP3
全面测试（spec 中的 8 个场景 + 性能基准）
```

**说明**：Task 1 和 Task 2 可以并行，但建议按顺序以便逐个验证。Task 3 依赖 Task 2（需要 `onScrollNearBottom` 回调）。Task 4 和 Task 5 主要在同一文件（`session-browser.tsx`）中，建议先完成 Task 4 的 UI，再在 Task 5 中完善边界逻辑。

---

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| @tanstack/react-virtual 与 React 19 兼容性 | 虚拟滚动无法工作 | 安装后先用最小代码验证，如有问题改用 react-window |
| MessageTurn 高度变化导致虚拟列表跳动 | 滚动体验差 | 确保 measureElement 正确绑定到每个 turn 的外层 div |
| 加载全部时内存占用过高 | 浏览器卡顿 | 当前最大 3778 条，按每条 2KB 估算约 7.5MB，可接受；如后续增长到万级需改为服务端过滤 |
| 倒序模式下滚动位置异常 | 用户迷失 | 切换排序时显式设置 scrollTop 到顶部/底部 |
