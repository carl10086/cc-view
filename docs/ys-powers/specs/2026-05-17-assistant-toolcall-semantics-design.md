# Assistant 与 Tool Call 语义拆分设计

## 1. Objective(目标)

延续 `2026-05-12-session-message-semantics-design.md` 的产品语义模型,把 assistant 消息内部的 `tool_use` 块拆为独立的产品语义,**像之前区分 `user` 与 `tool-result` 一样**,让 cc-view 在 turn 渲染、filter、数据层都能把"assistant 的文字回复"和"assistant 发起的工具调用"作为两类一等公民对待。

当前关键问题:

- `normalizeRawSessionMessage` 对 assistant 消息**不做内容拆分**,把整条 raw 直接打包成单条 `kind: "assistant"`(`lib/message-semantics.ts:164-166`)。
- 现实中一条 assistant 消息可能含 `text` + `thinking` + 多个 `tool_use`,这些内容被一整块塞进 `<AssistantMessage>` 渲染,filter 无法单独筛选工具调用,turn 内时序也被 raw 结构遮蔽。
- `MessageTurn.assistant` 是单对象,无法表达"先解释→调用工具 A→再解释→调用工具 B"这种 assistant 与 tool_use 交错出现的真实序列。
- `tool-result` 已经独立语义化,但缺少与它对偶的 `tool-call` —— 数据层和 UI 都不知道"这是 assistant 发起的工具调用"。

目标用户:

- 想在 session 中单独筛选"所有工具调用"以审计 Claude 行为的人。
- 想看清 assistant 的解释文本与工具调用顺序的人。
- 需要让 tool-call 与 tool-result 在 UI 上明确配对显示的人。

核心目标:

- 新增产品语义 `kind: "tool-call"`,与 `tool-result` 对称。
- assistant 消息按 content 块**顺序拆分**:`text/thinking` 合并保留为 `kind: "assistant"` 子消息,每个 `tool_use` 独立成 `kind: "tool-call"`。
- `MessageTurn` 用 `events: SessionMessage[]` 取代单 `assistant` + `toolResults[]`,按时序混排 assistant / tool-call / tool-result。
- filter 新增 `tool-call` chip,与 `tool-result` 并列。
- `assistant-message.tsx` 不再渲染 `tool_use` 块;`tool-call-card.tsx` 接受独立的 `SessionMessage` 输入。
- `/docs/message-types` 文档页同步新增 `tool-call` 卡片。
- 右侧用户轮次导航行为**不变**,仍只显示 `kind: "user"`。

## 2. Tech Stack(技术栈)

- Next.js 16 App Router
- React 19
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui(现有 UI 基础)
- Lucide React(现有图标库)
- Vitest + Testing Library(现有测试栈)
- `@tanstack/react-virtual`(message stream 虚拟滚动,已有)

依赖策略:

- 不新增 npm 依赖。
- 语义拆分、events 分组都在项目内 TypeScript 工具函数中完成。

## 3. Commands(命令)

开发:

```bash
npm run dev
```

构建:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

测试(全量):

```bash
npm run test:run
```

针对性测试:

```bash
npm run test:run -- lib/message-semantics.test.ts lib/message-grouping.test.ts lib/claude-data.test.ts components/message/message-turn.test.tsx
```

## 4. Semantic Model(产品语义模型)

### 4.1 SessionMessageKind 扩展

```ts
export type SessionMessageKind =
  | "user"
  | "assistant"
  | "tool-call"      // 新增
  | "tool-result"
  | "metadata"
```

`SessionMessage` 接口字段保持不变。`filterType` 新增可能取值 `"tool-call"`。

### 4.2 语义判定规则

assistant 真实文本回复:

- 原始消息顶层 `type` 或 `message.role` 表示 assistant。
- `message.content` 中存在 `text` 块或 `thinking` 块。
- 生成 `kind: "assistant"`、`filterType: "assistant"`。

Tool call:

- 原始消息为 assistant。
- `message.content[]` 中包含 `type: "tool_use"`。
- 每个 `tool_use` 块独立生成一条 `kind: "tool-call"`、`filterType: "tool-call"` 消息。

其他 kind(user、tool-result、metadata)判定规则保持现状,见 `2026-05-12-session-message-semantics-design.md` §4.3。

### 4.3 assistant 混合内容拆分

参照现有 `normalizeUserContent` 的拆分模式,新增 `normalizeAssistantContent`:

- 字符串 content 或非数组 content → 单条 `kind: "assistant"`。
- 全部是 `text` / `thinking` 块 → 合并为单条 `kind: "assistant"`,沿用原 raw。
- 全部是 `tool_use` 块 → 每个 `tool_use` 独立成一条 `kind: "tool-call"`,id 后缀 `tool-call-{i}`。
- 混合 `text/thinking + tool_use`:**按 content 块出现顺序**拆出多条语义消息,连续的 `text/thinking` 合并为一条 assistant 子消息,每个 `tool_use` 独立成一条 tool-call。

混合内容拆分时,每条子消息共享同一份原始 `raw`,但 assistant 子消息的 `raw.message.content` 浅拷贝为只包含本段的 text/thinking 块(对照 `normalizeUserContent` 中对 text 块的处理),让 `<AssistantMessage>` 渲染时只看到本段内容。

id 后缀策略:

```ts
// assistant 子消息(可能多段):assistant-{segmentIndex}
// tool-call 子消息:tool-call-{contentBlockIndex}
const assistantId = `${uuid ?? lineIndex}-${messageIndex}-assistant-${segmentIndex}`
const toolCallId  = `${uuid ?? lineIndex}-${messageIndex}-tool-call-${contentIndex}`
```

`contentBlockIndex` 使用 `tool_use` 在原 content 数组中的真实位置,便于 raw 对照与稳定性。

### 4.4 raw 数据保留

- 所有拆出来的子消息 `raw` 仍指向原 jsonl line 对象(assistant 子消息的 raw 是浅拷贝,但 `.raw` 在 message 对象层级保持可读)。
- Raw JSON 面板能显示原始完整 content,不受拆分影响。
- tool-call 子消息的 raw 保留完整原 message,UI 渲染时通过 id 后缀中的 contentBlockIndex 定位本条对应的 `tool_use` 块。

## 5. MessageTurn 结构调整

```ts
export interface MessageTurn {
  id: string
  user: SessionMessage | null
  events: SessionMessage[]      // 按时序混排 assistant / tool-call / tool-result
  metadata: SessionMessage[]
}
```

字段语义:

- `user`:本 turn 的真实用户输入,沿用现有定义。
- `events`:本 turn 内除 `user` 与 `metadata` 之外的所有语义消息,按源 jsonl 时序排列。包含 `kind` 为 `assistant`、`tool-call`、`tool-result` 的消息。
- `metadata`:本 turn 内的 metadata 消息,沿用现有定义。

废弃字段:

- `assistant`(单对象)——由 `events` 中的 `kind: "assistant"` 元素表达,且支持多段。
- `toolResults`(数组)——由 `events` 中的 `kind: "tool-result"` 元素表达。

## 6. Turn Grouping(分组规则)

turn 边界仍只基于真实用户输入:

- `kind: "user"` → 关闭当前 turn(如果有),开启新 turn,设置 `user`。
- `kind: "assistant" | "tool-call" | "tool-result"` → 追加到当前 turn 的 `events` 末尾,保持源时序。无开启的 turn 时,生成一个 `user: null` 的 standalone turn 承接它们。
- `kind: "metadata"` → 追加到当前 turn 的 `metadata`。session 开头无 user 时,作为 prelude metadata 留在第一个 standalone turn。
- standalone turn(无 user)不参与右侧用户轮次导航。

tool-call ↔ tool-result 配对:

- 优先使用 `tool_use.id` ↔ `tool_result.tool_use_id` 进行配对,UI 渲染时可在 tool-result 卡片中显示对应 tool-call 的简要信息(若需要)。
- 没有 id 时退回到 events 内的顺序相邻关系。
- 本设计不强制改变现有 ToolResultCard 的内部展示,只保证 events 顺序正确。

## 7. UI 调整

### 7.1 message-turn.tsx

```tsx
function renderEvent(message: SessionMessage) {
  switch (message.kind) {
    case "assistant":
      return <AssistantMessage message={message} />
    case "tool-call":
      return <ToolCallCard message={message} />
    case "tool-result":
      return <ToolResultCard message={message} />
    default:
      return null
  }
}

// turn body
{turn.user && <UserMessage message={turn.user} />}
{turn.events.map(renderEvent)}
{turn.metadata.map((m) => <CompactMessage key={m.id} message={m} />)}
```

### 7.2 assistant-message.tsx

- 内部不再判断/渲染 `tool_use` 块。
- 只渲染本条 message `raw.message.content` 中的 `text` 和 `thinking` 块。
- 现有 `<ThinkingBlock />` 复用。

### 7.3 tool-call-card.tsx

- 入参从原来"从 assistant message 内部读取的 tool_use block"改为"独立 SessionMessage"。
- 组件内部根据 `message.id` 后缀中的 `tool-call-{contentBlockIndex}` 或直接遍历 `raw.message.content` 找到对应 `tool_use` 块渲染。
- 若已有展示样式不变,只是数据入口改了。

### 7.4 filter chip

- `availableTypes` 在 session 实际包含 tool-call 时自动列出 `tool-call`。
- 建议排序:`user`、`assistant`、`tool-call`、`tool-result`,随后是 metadata 子类型按字母排序。
- chip 配色:沿用现有 assistant 绿色系,但建议 tool-call 用偏青/蓝调与 assistant 区分,具体在实现时按 typeConfig 风格定。

### 7.5 右侧用户轮次导航

不变。`UserTurnNavItem` 仍只由 `kind: "user"` 生成。

## 8. 数据层(`lib/claude-data.ts` & API)

- `getSessionMessages` 不需要改动主流程,因为 normalize 已扩展为支持 tool-call 输出。
- `types=tool-call` 仅返回 tool-call 子消息;与 `user` / `tool-result` / `assistant` 单独可组合。
- `availableTypes` 基于全 session normalize 后的 `filterType` 计算,自然包含 `tool-call`。
- `total` 是过滤后总数;`unfilteredTotal` 是 normalize 后语义消息总数(因为 assistant 现在可能被拆分,unfilteredTotal 数字相对旧逻辑会上升,这是预期)。
- `navItems` 不受影响,仍只来自 `kind: "user"`。

## 9. Project Structure(项目结构)

```text
types/
  claude.ts
    # 扩展 SessionMessageKind 加 "tool-call"
    # MessageTurn 改为 { id, user, events, metadata }

lib/
  message-semantics.ts
    # 新增 normalizeAssistantContent
    # normalizeRawSessionMessage 在 assistant 分支调用 normalizeAssistantContent
  message-semantics.test.ts
    # 补 assistant 各种 content 形态拆分测试
  message-grouping.ts
    # 改为基于新的 MessageTurn.events 结构,tool-call/tool-result 均追加进 events
  message-grouping.test.ts
    # 补 events 时序、tool-call 不开新 turn、配对正常等
  claude-data.ts
    # 无需大改;确认 availableTypes 计算包含 tool-call
  claude-data.test.ts
    # 补 types=tool-call 过滤、availableTypes 含 tool-call

components/message/
  message-turn.tsx
    # 改用 turn.events 遍历分发到 AssistantMessage / ToolCallCard / ToolResultCard
  assistant-message.tsx
    # 移除 tool_use 渲染逻辑,只渲染 text + thinking
  assistant-message.test.tsx
    # 调整断言,确保不再渲染 tool_use
  tool-call-card.tsx
    # 入参改为 SessionMessage
  thinking-block.tsx
    # 不变

app/docs/message-types/
  page.tsx
    # 新增 tool-call 主要类型卡片
public/docs/
  message-types-meta.json
    # 添加 tool-call 元数据(label / color / description / example)
```

## 10. Code Style(代码风格)

核心原则:

- 不在 UI 组件层判断 `block.type === "tool_use"`,所有 `tool_use` 拆分集中在 `lib/message-semantics.ts`。
- 不在 UI 组件中拼装 events 顺序,顺序由 `message-grouping.ts` 决定。
- TypeScript 类型显式表达 kind,switch 必须穷尽 5 个 kind。

示例(message-turn.tsx 内部):

```tsx
function renderTurnEvent(message: SessionMessage) {
  switch (message.kind) {
    case "assistant":
      return <AssistantMessage key={message.id} message={message} />
    case "tool-call":
      return <ToolCallCard key={message.id} message={message} />
    case "tool-result":
      return <ToolResultCard key={message.id} message={message} />
    case "user":
    case "metadata":
      return null
  }
}
```

辅助函数:

```ts
export function isToolCallMessage(message: SessionMessage): boolean {
  return message.kind === "tool-call"
}
```

## 11. Testing Strategy(测试策略)

### 单元测试

`lib/message-semantics.test.ts`:

- assistant `content` 为字符串 → 单条 `kind: "assistant"`。
- assistant `content` 全是 text 块 → 单条 `kind: "assistant"`。
- assistant `content` 含 thinking + text → 单条 `kind: "assistant"`(thinking 与 text 合并保留)。
- assistant `content` 只含一个 `tool_use` → 单条 `kind: "tool-call"`。
- assistant `content` 含 N 个 `tool_use` → N 条 `kind: "tool-call"`,id 后缀 `tool-call-{i}` 稳定。
- assistant `content` 混合 text + tool_use + text + tool_use → 按时序拆 4 条:assistant / tool-call / assistant / tool-call。
- 拆出来的 assistant 子消息 `raw.message.content` 只含本段 text/thinking 块。
- tool-call 子消息 `raw` 仍指向完整原 raw。

`lib/message-grouping.test.ts`:

- 含 tool-call 的消息不开启新 turn。
- 同一 turn 内 assistant → tool-call → tool-result → assistant 的 events 顺序与源时序一致。
- 多个 tool-call/tool-result 交错时仍保持 events 顺序。
- session 开头无 user 时,assistant + tool-call 进入 standalone turn,不出现在用户轮次导航中。

`lib/claude-data.test.ts`:

- `types=tool-call` 返回结果只含 tool-call。
- `types=assistant,tool-call` 同时返回 assistant 和 tool-call,不含 tool-result。
- `availableTypes` 在 session 含 tool-call 时自动包含 `tool-call`。
- `total` 反映 filter 后总数;`unfilteredTotal` 反映 normalize 后总数。

`components/message/assistant-message.test.tsx`:

- assistant 消息渲染只包含 text + thinking,**不渲染** tool_use 块。

`components/message/message-turn.tsx`(若新增对应 test):

- events 数组按顺序渲染到正确组件。

### 手动验证

- 打开任意含工具调用的 session(如 `30001`)。
- 验证 turn 内显示顺序符合实际(assistant 文字 → tool-call 卡片 → tool-result 卡片)。
- filter 选 `tool-call`,只显示工具调用条目。
- filter 选 `assistant`,不再出现 tool_use 卡片(只剩 assistant 文字回复)。
- filter 选 `tool-result`,不变。
- `Load all` 后 `unfilteredTotal` 数值合理(因 assistant 拆分会上升)。
- 右侧用户轮次导航行为完全不变。
- Raw JSON 面板仍能看到原始完整 assistant content。
- 访问 `/docs/message-types`,看到 tool-call 卡片。

## 12. Boundaries(边界)

### Always Do

- 始终保留原始 raw 数据,assistant 子消息浅拷贝 content 时不破坏 `raw` 引用层级。
- 所有 `tool_use` 拆分集中在 `lib/message-semantics.ts`,不在组件层处理。
- `MessageTurn.events` 顺序必须严格反映源 content 顺序与 jsonl 时序。
- 修改前读取目标文件最新内容。
- 为 normalize、grouping、claude-data、UI 行为补充测试。
- tool-call/tool-result 配对优先用 id,fallback 到顺序。

### Ask First

- 引入新的 npm 依赖。
- 把 `thinking` 也独立成 kind(本次明确不做,留作未来扩展)。
- 把右侧导航扩展为二级事件导航(tool-call/tool-result 进入导航)。
- 改变现有 `<ToolCallCard>` 的视觉样式(本次只改数据入口)。
- 删除/重命名现有 `MessageTurn.assistant` 之外的字段。

### Never Do

- 不修改 Claude Code 生成的 `.jsonl` 文件。
- 不把 raw 中的 role/type 改写。
- 不让 tool-call 出现在 `user` 或 `assistant` filter 结果中。
- 不让 tool-call 开启新 turn。
- 不让 tool-call 出现在右侧用户轮次导航中。
- 不在 UI 组件中散落 `block.type === "tool_use"` 判定。
- 不破坏 worktree 切换、session 删除、基础分页加载。

## 13. Implementation Phases(建议实现阶段)

### Phase 1: 类型与语义层

- `types/claude.ts`: 扩展 `SessionMessageKind`,改 `MessageTurn` 为 `events` 形态。
- `lib/message-semantics.ts`: 新增 `normalizeAssistantContent`,接入 `normalizeRawSessionMessage`。
- `lib/message-semantics.test.ts`: 覆盖 assistant content 各形态。

### Phase 2: 分组层

- `lib/message-grouping.ts`: 改用 `events` 结构,tool-call/tool-result 均追加 events。
- `lib/message-grouping.test.ts`: 补 events 顺序、配对、不开新 turn。

### Phase 3: 数据层

- `lib/claude-data.ts`: 确认 `availableTypes` 计算与 `types=tool-call` 过滤。
- `lib/claude-data.test.ts`: 补 tool-call 过滤场景。

### Phase 4: UI 层

- `message-turn.tsx`: 改用 events 分发。
- `assistant-message.tsx`: 移除 tool_use 渲染。
- `tool-call-card.tsx`: 入参改为 SessionMessage。
- 调整相关组件测试。

### Phase 5: 文档同步

- `/docs/message-types` 页面新增 tool-call 卡片。
- 更新 `public/docs/message-types-meta.json`。

每个 phase 完成后跑一次 `npm run test:run` 与 `npm run build`,确保红 → 绿前进。

## 14. Success Criteria(验收标准)

- [ ] `SessionMessageKind` 含 `"tool-call"`,types 编译通过。
- [ ] `MessageTurn` 形态改为 `{ id, user, events, metadata }`,旧 `assistant`/`toolResults` 字段被替代。
- [ ] assistant content 只含 text/thinking → 单条 `kind: "assistant"`。
- [ ] assistant content 只含 tool_use → 每个 tool_use 独立成 `kind: "tool-call"`。
- [ ] assistant content 混合 text + tool_use → 按时序正确拆分为多条语义消息。
- [ ] turn 渲染中 assistant / tool-call / tool-result 按源时序排列。
- [ ] filter 选 `tool-call` 只返回工具调用;选 `assistant` 不再含 tool_use。
- [ ] `<AssistantMessage>` 不再渲染 tool_use 块。
- [ ] `<ToolCallCard>` 以独立 SessionMessage 渲染。
- [ ] 右侧用户轮次导航行为完全不变。
- [ ] `/docs/message-types` 页面包含 tool-call 卡片。
- [ ] `npm run test:run` 通过。
- [ ] `npm run lint` 通过。
- [ ] `npm run build` 通过。

## 15. Open Questions(开放问题)

1. tool-call chip 的具体配色:沿用绿色系还是另起一色(青/蓝)?建议实现期间参考 `typeConfig` 既有配色统一定。
2. tool-call 与 tool-result 在 UI 上是否需要"配对连线"或视觉关联(箭头/缩进/折叠)?本次只保证 events 顺序正确,视觉关联留待后续 UX 迭代。
3. assistant 子消息合并策略:连续 `text + thinking + text` 是否合并为一段,还是 thinking 单独一段?本次默认合并为一段(共享同一 raw content 切片)。如要拆开,需要给 thinking 单独的 id 后缀。
4. 历史 session 中如果某 assistant 含 100+ tool_use(罕见),拆分后 `unfilteredTotal` 会显著上升。是否需要在 UI 上对此进行说明,还是留作 Raw JSON 自然展示?暂不处理。

## 16. References(参考)

- 前序设计:`docs/ys-powers/specs/2026-05-12-session-message-semantics-design.md`
- Message Types 文档:`docs/ys-powers/specs/2025-05-16-message-types-documentation-design.md`
- 当前实现:`lib/message-semantics.ts:164-166`(assistant 当前未拆分位置)
- 类型定义:`types/claude.ts:22-44`
