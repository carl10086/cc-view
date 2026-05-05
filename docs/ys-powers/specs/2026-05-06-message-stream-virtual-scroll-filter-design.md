# Message Stream 虚拟滚动与过滤优化

## Objective

优化 cc-view 项目中的 session message 列表浏览体验，解决长列表（最长 3778 条消息）的性能和交互问题。

### 当前痛点
- 手动点击 "Load more" 按钮加载分页，操作繁琐
- 无虚拟滚动，大量消息直接渲染到 DOM，导致卡顿
- 无法按类型过滤消息（如只看 user + assistant 对话）
- 无法切换正序/倒序浏览
- 无法快速加载全部消息

### 目标体验
- 滚动自动加载更多（无限滚动）
- 仅渲染可视区域的 turns，长列表流畅不卡顿
- 一键加载全部后，可即时按类型过滤
- 支持正序（最早在上）和倒序（最新在上）切换
- 支持调整分页批次大小（500/1000/2000）

---

## Commands

### 安装依赖
```bash
npm install @tanstack/react-virtual
```

### 开发服务器
```bash
npm run dev
```

---

## Project Structure

### 修改的文件

| 文件路径 | 改动内容 |
|---------|---------|
| `app/api/projects/[projectId]/sessions/[sessionId]/route.ts` | API 增加 `order` 查询参数 |
| `lib/claude-data.ts` | `getSessionMessages` 支持 `order: "asc" \| "desc"`，统一解析全部消息后切片 |
| `components/session-browser.tsx` | 核心状态管理：排序、页大小、过滤、全量加载；集成无限滚动回调 |
| `components/message-stream.tsx` | 集成 `@tanstack/react-virtual`，按 turn 虚拟滚动；触发底部加载 |
| `components/message/message-turn.tsx` | 确保 ref 可测量（动态高度） |

### 不新建文件
本次改动集中在现有组件的功能扩展，不新增独立组件文件。

---

## Code Style

### 状态管理
- 所有新状态使用 `useState`，派生数据使用 `useMemo`
- 过滤和排序只在 `isFullyLoaded === true` 时启用，避免部分数据上的困惑行为
- 切换排序/页大小时，清空现有消息并重新加载第一页

### 虚拟滚动
- 使用 `@tanstack/react-virtual` 的 `useVirtualizer`
- `estimateSize: () => 150` 作为初始高度估计
- `measureElement` 自动测量实际高度，支持展开 JSON 后的动态调整
- `overscan: 5` 预渲染上下各 5 个 turn，减少白屏

### API 调用
- 倒序语义：`order=desc&offset=0` 返回最新的 `limit` 条消息
- `loadMore` 的 `offset` 计算与正序完全一致：`offset = messages.length`
- 请求去重：使用 `requestIdRef` 丢弃过期响应

### Tailwind 样式
- 复用现有设计系统：`border-neutral-100`, `text-neutral-500`, `rounded-md` 等
- 过滤 chip 使用 `rounded-full` 胶囊样式
- 排序切换使用分段按钮（segmented control）样式

---

## Testing Strategy

### 手动验证清单

| 场景 | 验证步骤 | 预期结果 |
|------|---------|---------|
| 虚拟滚动 | 打开 3778 条消息的 session，快速滚动 | 无卡顿，DOM 节点数量稳定 |
| 无限滚动 | 滚动到底部 | 自动加载下一页，无按钮点击 |
| 加载全部 | 点击 "Load all" | 渐进加载所有消息，完成后显示过滤控件 |
| 类型过滤 | 加载全部后，选择 user 类型 | 只显示 user 消息，即时响应 |
| 正序/倒序 | 点击 "Newest first" | 列表清空，从最新消息重新加载 |
| 页大小切换 | 选择 2000/page | 列表清空，以 2000 为批次重新加载 |
| 边界：小 session | 打开 <500 条的 session | 首次加载即完成，自动启用过滤 |
| 边界：空过滤结果 | 过滤条件导致无匹配 | 显示 "No messages" 空状态 |

### 性能基准
- 打开 3778 条消息的 session，首屏渲染时间 < 1s
- 滚动过程中，React DevTools Profiler 中无长时间帧（> 50ms）

---

## Boundaries

### Always Do
- 切换排序/页大小时，重置滚动位置到顶部（正序）或底部（倒序）
- 加载全部过程中显示加载状态，禁用排序/页大小切换
- 过滤只针对已加载的全部消息，不在服务端实现按类型过滤（jsonl 遍历成本高）
- 保持现有消息分组逻辑 `groupMessagesIntoTurns` 不变

### Ask First About
- 是否需要持久化用户的排序/过滤偏好（如保存到 localStorage）
- 是否需要支持消息内容搜索（全文检索）
- 是否需要显示 turn 数量（当前只显示 message 数量）

### Never Do
- 不要在未全量时启用过滤控件，避免用户误以为只能看到部分结果
- 不要修改 jsonl 文件格式或存储结构
- 不要引入额外的状态管理库（Redux/Zustand 等），现有 useState 足够
- 不要删除现有的 "Expand JSON" 等消息交互功能
- 不要改变消息分组的业务逻辑（turn 的构成规则）
