# Session Message 语义与轮次导航设计

## 1. Objective（目标）

基于 `docs/requirements/2026-05-12-session-message-semantics.md`，重构 session message 的核心语义模型，让 cc-view 不再把 Claude jsonl 的原始协议字段直接当作 UI 语义。

当前关键问题：

- Claude Code 的 tool result 常以顶层 `type: "user"` / `message.role: "user"` 记录，但它不是用户输入。
- 当前 message 展示、turn 分组、filter、右侧导航都可能把 tool result 当作真实用户输入。
- filter 只有 `Load all` 后才能使用，本质上是“已加载内容过滤”，不符合用户对 session filter 的心理模型。
- 右侧导航栏当前偏向 compact / metadata 事件导航，无法按真实用户输入快速定位 conversation turn。

目标用户：

- 需要回看 Claude Code session 完整过程的人。
- 需要快速定位“我问了什么、Claude 怎么执行、工具返回了什么”的使用者。
- 需要在长 session 中按真实用户输入跳转的人。

核心目标：

- 建立一等产品语义字段 `kind`，将协议类型和 UI 语义彻底分开。
- `user` 只代表真实用户输入；`tool-result` 是独立语义，即使原始 role/type 是 user。
- turn 分组、filter、右侧导航都统一依赖产品语义，不再散落判断 `message.type === "user"`。
- filter 支持“先 filter，再分页”，不再要求 `Load all`。
- 右侧导航栏定位为用户输入轮次导航，只显示真实用户输入。
- 保留原始 jsonl raw 数据，Raw JSON 仍可用于调试。

## 2. Tech Stack（技术栈）

- Next.js 16 App Router
- React 19
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui（现有 UI 基础）
- Lucide React（现有图标库）
- Vitest + Testing Library（现有测试栈）
- `@tanstack/react-virtual`（现有 message stream 虚拟滚动）

依赖策略：

- 不新增 npm 依赖。
- 语义解析、filter、turn/nav 派生都使用项目内 TypeScript 工具函数实现。

## 3. Commands（命令）

开发：

```bash
npm run dev
```

构建：

```bash
npm run build
```

Lint：

```bash
npm run lint
```

测试：

```bash
npm run test:run
```

针对性测试建议：

```bash
npm run test:run -- lib/message-semantics.test.ts lib/message-grouping.test.ts components/message/message-nav-panel.test.tsx
```

## 4. Semantic Model（产品语义模型）

### 4.1 原始协议层

原始协议层来自 Claude jsonl，必须保留在 `SessionMessage.raw` 中：

- 顶层 `type`
- `message.role`
- `message.content[]`
- `uuid`
- `parentUuid`
- `timestamp`

这些字段用于还原原始记录和调试，但不能直接作为 UI 分类依据。

### 4.2 产品语义层

新增产品语义字段：

```ts
export type SessionMessageKind =
  | "user"
  | "assistant"
  | "tool-result"
  | "metadata"

export interface SessionMessage {
  id: string
  type: string
  kind: SessionMessageKind
  filterType: string
  timestamp: Date | null
  parentUuid: string | null
  raw: unknown
}
```

字段含义：

- `type`：保留原始协议顶层 `type`，用于 raw 对照和 metadata subtype 兼容。
- `kind`：cc-view 产品语义，一切 UI 主判断使用它。
- `filterType`：filter chip 使用的类型。语义主体使用 `user`、`assistant`、`tool-result`；metadata 保留更细类型，如 `system`、`attachment`、`ai-title`。
- `raw`：完整原始 jsonl object，不被修改。

### 4.3 语义判定规则

真实用户输入：

- 原始消息顶层 `type` 或 `message.role` 表示 user。
- `message.content` 中存在 `text` 内容，或 `content` 是非空字符串。
- 不是纯 `tool_result` 消息。
- 生成 `kind: "user"`、`filterType: "user"`。

Tool result：

- 原始消息可能是 `type: "user"` / `message.role: "user"`。
- `message.content[]` 中包含 `type: "tool_result"`。
- 生成 `kind: "tool-result"`、`filterType: "tool-result"`。

Assistant：

- 原始消息为 assistant。
- 可包含 text、thinking、tool_use。
- 生成 `kind: "assistant"`、`filterType: "assistant"`。

Metadata：

- system、attachment、ai-title、last-prompt、permission-mode、file-history-snapshot、queue-operation 等非对话主体消息。
- 生成 `kind: "metadata"`。
- `filterType` 默认使用原始 `type`，保持现有 metadata 细粒度过滤能力。

### 4.4 混合内容消息

如果一条原始 user-role 消息同时包含 text 和 tool_result，不能粗略归为 user。

设计规则：

- 数据层将该原始 jsonl line 规范化为多个 `SessionMessage` 展示记录。
- 每个展示记录只承载一种产品语义。
- 拆分后的记录共享同一份 `raw`，并用稳定 id 区分 content block。

示例 id 策略：

```ts
const id = `${uuid ?? lineIndex}-${messageIndex}-part-${contentIndex}`
```

验收含义：

- 文本 part 参与 user 展示、turn 边界、user filter、右侧导航。
- tool_result part 参与 tool-result 展示和 tool-result filter。
- Raw JSON 面板仍能看到完整原始消息。

## 5. Query Semantics（过滤与分页语义）

filter 必须作用于整个 session，而不是当前已加载消息。

查询顺序：

```text
read jsonl
  -> normalize to semantic SessionMessage[]
  -> apply kind/filterType filter
  -> apply order
  -> apply offset/limit pagination
  -> return page + filtered total
```

API 查询参数：

```text
GET /api/projects/:projectId/sessions/:sessionId?offset=0&limit=500&order=asc&types=user,tool-result
```

参数语义：

- `types` 可为空；为空表示不过滤。
- `types` 对应 `filterType`，而不是原始协议 `type`。
- `user` 只匹配真实用户输入。
- `tool-result` 只匹配工具结果。
- metadata 仍可通过 `system`、`attachment` 等 `filterType` 过滤。

响应语义：

```ts
{
  messages: SessionMessage[]
  total: number          // 当前 filter 后的总数
  unfilteredTotal: number // 未过滤的语义消息总数
  hasMore: boolean
  offset: number
  limit: number
  availableTypes: string[]
  navItems: UserTurnNavItem[]
}
```

`Load all` 语义：

- 无 filter 时：加载当前 session 的全部语义消息。
- 有 filter 时：加载当前 filter 条件下的全部匹配消息。
- 不再作为 filter 启用条件。

UI 状态文案示例：

- `Showing 500 of 1280 messages`
- `Showing 50 of 82 user messages`
- `Showing 20 of 20 tool-result messages`

## 6. Turn Grouping（轮次分组）

conversation turn 边界基于 `kind: "user"`，不基于原始 `type: "user"`。

分组规则：

- `kind: "user"` 开启新的 turn。
- `kind: "assistant"` 归入当前 turn。
- `kind: "tool-result"` 归入当前 turn 或与最近的 tool_use 配对，不创建新 turn。
- `kind: "metadata"` 归入当前 turn 的 metadata；如果 session 开头只有 metadata，则作为 prelude metadata 保留，但不创建用户轮次导航项。
- 连续 assistant 或无 user 的异常情况允许生成无 user 的 standalone turn，但不会出现在右侧用户输入导航中。

建议类型：

```ts
export interface MessageTurn {
  id: string
  user: SessionMessage | null
  assistant: SessionMessage | null
  toolResults: SessionMessage[]
  metadata: SessionMessage[]
}
```

tool_use 仍来自 assistant content block；tool_result 由独立 `kind: "tool-result"` 消息提供。配对优先使用 `tool_use.id` 和 `tool_result.tool_use_id`，没有 id 时才按顺序回退。

## 7. Right Navigation（右侧用户轮次导航）

右侧导航栏定位为“按用户输入快速跳转”，不是 metadata 事件列表。

导航项类型：

```ts
export interface UserTurnNavItem {
  turnIndex: number
  messageId: string
  preview: string
  timestamp: Date | null
  offset: number
}
```

生成规则：

- 只从 `kind: "user"` 的真实用户输入生成导航项。
- tool result、assistant、compact boundary、attachment、system 不作为一级导航项。
- preview 使用用户输入文本截断，例如 40-60 字符。
- session 开头只有 metadata 时不生成导航项。

点击行为：

1. 如果目标 user message 已在当前已加载 messages 中，直接调用 `MessageStream.scrollToMessage(messageId)` 并高亮。
2. 如果目标尚未加载，根据 `offset` 继续请求分页，直到目标 message 进入当前列表，再滚动和高亮。
3. 加载过程中导航项进入 pending 状态，避免重复点击。

后续可优化为 anchor/window fetch，但本设计不要求一次实现双向虚拟窗口。

## 8. Project Structure（项目结构）

预计新增/修改范围：

```text
types/
  claude.ts
    # 新增 SessionMessageKind、filterType、nav item 类型

lib/
  claude-data.ts
    # getSessionMessages 支持语义 normalize、types filter、filtered total、navItems
  message-semantics.ts
    # 新增：集中定义 normalize / kind 判定 / preview / filter key
  message-semantics.test.ts
    # 新增：语义判定与混合内容拆分测试
  message-grouping.ts
    # 改为基于 kind 分组，tool-result 不再开启 user turn
  message-grouping.test.ts
    # 补充真实 user/tool-result/混合内容分组测试

app/api/projects/[projectId]/sessions/[sessionId]/route.ts
  # 解析 types 参数，返回 availableTypes、unfilteredTotal、navItems

components/
  session-browser.tsx
    # filter 不再依赖 isFullyLoaded；请求携带 types；状态文案改为 filtered total
  message-stream.tsx
    # 支持按 semantic message id 跳转和高亮
  message/
    user-message.tsx
      # 只处理 kind=user
    tool-result-card.tsx
      # 可复用现有 ToolResultCard，或升级为独立 tool-result message 展示
    message-turn.tsx
      # 基于新的 MessageTurn 渲染 user/assistant/tool-result/metadata
    message-nav-panel.tsx
      # 从 compact metadata nav 改为 user turn nav
    message-nav-panel.test.tsx
      # 更新为用户输入轮次导航测试
```

## 9. Code Style（代码风格）

核心原则：

- UI 组件禁止直接用 `message.type === "user"` 判断真实用户输入。
- 语义判断集中在 `lib/message-semantics.ts`。
- 保持 `SessionMessage.raw` 完整，不在 UI 组件里篡改 raw。
- TypeScript 类型显式表达产品语义，避免 `any`。

示例：

```ts
export function isUserInputMessage(message: SessionMessage): boolean {
  return message.kind === "user"
}

export function isToolResultMessage(message: SessionMessage): boolean {
  return message.kind === "tool-result"
}

export function getMessageFilterType(message: SessionMessage): string {
  return message.filterType
}
```

组件分发示例：

```tsx
switch (message.kind) {
  case "user":
    return <UserMessage message={message} />
  case "tool-result":
    return <ToolResultMessage message={message} />
  case "assistant":
    return <AssistantMessage message={message} />
  case "metadata":
    return <CompactMessage message={message} />
}
```

## 10. Testing Strategy（测试策略）

### 单元测试

`lib/message-semantics.test.ts`：

- 原始 `type: "user"` + string content -> `kind: "user"`。
- 原始 `type: "user"` + `content[]` text block -> `kind: "user"`。
- 原始 `type: "user"` + 纯 `tool_result` block -> `kind: "tool-result"`。
- 原始 `type: "user"` + text + tool_result 混合 content -> 拆分为多个 semantic messages。
- metadata 消息 -> `kind: "metadata"`，`filterType` 保留原始类型。
- raw 数据保留完整引用。

`lib/message-grouping.test.ts`：

- `tool-result` 不开启新 turn。
- `user -> assistant -> tool-result -> assistant` 保持同一因果链。
- session 开头 metadata 不生成用户轮次导航项。
- 连续真实 user 分别生成 turn。

`lib/claude-data.test.ts`：

- `types=user` 返回真实用户输入，不含 tool result。
- `types=tool-result` 只返回工具结果。
- `total` 是过滤后的总数。
- `unfilteredTotal` 是语义消息总数。
- `offset/limit` 发生在 filter 之后。
- `availableTypes` 基于全 session 语义消息生成。
- `navItems` 只包含真实用户输入。

`components/message/message-nav-panel.test.tsx`：

- 空用户轮次显示空状态。
- 渲染用户输入 preview。
- 点击导航项调用 `onNavigate(messageId, offset)`。
- pending 状态下避免重复触发。

### 手动验证

- 打开已知包含 tool result 的 `30001` session。
- 验证 tool result 不显示为用户气泡。
- 选择 `user` filter 后不出现 tool result。
- 选择 `tool-result` filter 后只出现工具结果。
- 未点击 `Load all` 时 filter 仍可用。
- 右侧导航栏只显示真实用户输入。
- 点击右侧导航项能跳转并高亮对应用户输入。
- Raw JSON 面板仍能看到原始 `type: "user"` / `role: "user"`。

## 11. Boundaries（边界）

### Always Do

- 始终保留原始 raw JSON。
- 始终使用 `kind` / `filterType` 驱动 UI 语义。
- filter 必须先于 pagination。
- turn 边界必须基于真实用户输入。
- 右侧导航栏一级项必须只来自真实用户输入。
- 修改前读取目标文件最新内容。
- 为语义判断、分组、filter pagination 补单元测试。

### Ask First

- 引入新的 npm 依赖。
- 改变 `.jsonl` 文件读取上限或安全策略。
- 删除现有组件文件，而不是兼容迁移。
- 把右侧导航扩展成二级事件导航。
- 引入双向虚拟窗口或 anchor fetch 这类更大分页架构改造。

### Never Do

- 不修改 Claude Code 生成的 `.jsonl` 文件。
- 不把 raw 中的 `role` 或 `type` 改写成产品语义。
- 不在组件里散落重复的 tool_result 判定。
- 不让 `role/type: "user"` 直接开启 turn。
- 不让 tool result 出现在 `user` filter 结果中。
- 不破坏 worktree 切换、session 删除、基础分页加载。

## 12. Implementation Phases（建议实现阶段）

### Phase 1：语义模型与测试

- 新增 `SessionMessageKind`、`kind`、`filterType`。
- 新增 `lib/message-semantics.ts`。
- 完成 raw -> semantic messages normalize。
- 覆盖 user/tool-result/mixed/metadata 单元测试。

### Phase 2：数据层 filter + pagination

- `getSessionMessages` 改为 normalize 后再 filter/page。
- API 支持 `types` 查询参数。
- 返回 `total`、`unfilteredTotal`、`availableTypes`、`navItems`。
- 补充 `lib/claude-data.test.ts`。

### Phase 3：分组与展示迁移

- `groupMessagesIntoTurns` 改为基于 `kind`。
- `UserMessage` 只展示真实用户输入。
- tool result 使用独立展示组件或现有 `ToolResultCard` 的 message 包装。
- `MessageTurn` 统一渲染 user、assistant、tool-result、metadata。

### Phase 4：filter 与右侧导航 UI

- `SessionBrowser` filter 不再依赖 `isFullyLoaded`。
- filter 改为请求服务端语义分页。
- `MessageNavPanel` 改为用户输入轮次导航。
- 点击未加载导航项时按 offset 补加载，再跳转高亮。

## 13. Success Criteria（验收标准）

- [ ] `SessionMessage` 有产品语义字段，UI 主逻辑不再依赖原始 `type: "user"`。
- [ ] `role/type: "user"` 的 tool result 被识别为 `kind: "tool-result"`。
- [ ] tool result 不显示为用户气泡。
- [ ] tool result 不开启新的 conversation turn。
- [ ] 混合 text + tool_result 的原始消息被分别按语义处理。
- [ ] filter 在未 `Load all` 时可用。
- [ ] filter 作用于整个 session，分页发生在 filter 之后。
- [ ] `user` filter 只显示真实用户输入。
- [ ] `tool-result` filter 只显示工具结果。
- [ ] 右侧导航栏只显示真实用户输入轮次。
- [ ] 点击右侧导航项能跳转并高亮对应用户输入。
- [ ] Raw JSON 仍保留原始协议字段。
- [ ] `npm run test:run` 通过。
- [ ] `npm run build` 通过。

## 14. Open Questions（开放问题）

1. `availableTypes` 是否需要固定排序：`user`、`assistant`、`tool-result` 优先，metadata 类型随后按字母排序？
2. 右侧导航项 preview 截断长度使用 40、50 还是 60 字符？
3. 点击未加载导航项时，第一版是否接受“继续加载到目标 offset”，还是必须直接做 anchor/window fetch？
4. 混合 content 拆分后的 message count 是否需要在 UI 上解释，还是只在 raw JSON 中保留原始 line 关系？

