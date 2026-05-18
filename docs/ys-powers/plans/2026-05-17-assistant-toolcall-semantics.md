# 实施计划:Assistant 与 Tool Call 语义拆分

## Context(背景)

延续 `2026-05-12-session-message-semantics-design.md` 已落地的 user/tool-result 语义拆分,本次把 assistant 消息内部的 `tool_use` 块也拆为独立产品语义(`kind: "tool-call"`),让 cc-view 在 turn 渲染、filter、数据层都能把"assistant 的文字回复"和"assistant 发起的工具调用"作为两类一等公民对待。

源 spec:`docs/ys-powers/specs/2026-05-17-assistant-toolcall-semantics-design.md`

源代码现状关键点:
- `lib/message-semantics.ts:164-166`:assistant 分支当前**不拆分** content,整条打包成单条 `kind: "assistant"`。
- `lib/message-grouping.ts:136-199`:`groupMessagesIntoTurns` 把 assistant 放进 `MessageTurn.assistant` 单字段,把 tool-result 放进 `toolResults[]`。
- `lib/message-grouping.ts:204-260`:有 `extractToolUses` / `extractToolResults` / `pairToolCalls` 工具函数,被 `MessageTurn` 组件用来从 raw 中提取 tool_use 块并与 tool_result 配对显示。
- `components/message/message-turn.tsx:20-91`:渲染顺序为 User → Metadata → Assistant → Paired ToolCalls → Unpaired ToolResults。`ToolCallCard` 同时显示 `Input`(tool_use)和 `Result`(tool_result),是用户最熟悉的展示模式。
- `lib/claude-data.ts:610-674`:`getSessionMessages` 当前签名 `(projectId, sessionId, offset, limit, order)`,**没有 types 参数也没返回 availableTypes/navItems**。即:前份 spec 中"数据层 types filter"只是设计文档,**生产代码未实现**。filter 目前由前端在客户端实现。

## 关键架构决策

### 决策 1:tool-call 与 tool-result 的 UI 配对策略(选项 A)

源 spec §6 写"events 严格按时序渲染",§7.5 写"不强制改变现有 ToolResultCard"。这两点在 UX 上有冲突 — 现有 `ToolCallCard` 把 tool_use 和它配对的 tool_result 合并显示(Input + Result 一卡片),非常关键。

采纳 **选项 A:保留配对显示**:

- 数据层:`tool-call` 和 `tool-result` 仍是独立的 `SessionMessage`,各自有独立 id、参与独立 filter。
- 分组层:`groupMessagesIntoTurns` 仍把它们追加到 `events: SessionMessage[]`,顺序与 jsonl 一致。
- 渲染层:`MessageTurn` 渲染 events 时,先按 `tool_use_id` 计算 tool-call ↔ tool-result 配对集合。遍历 events:
  - 遇到 `kind: "assistant"` → 渲染 `<AssistantMessage>`
  - 遇到 `kind: "tool-call"` → 渲染 `<ToolCallCard>`,并把配对的 tool-result(若有)作为 prop 传入
  - 遇到 `kind: "tool-result"` → **如果已被某 tool-call 消费,跳过;否则**作为独立 `<ToolResultCard>` 渲染(罕见,容错)

理由:filter 维度上 tool-call 与 tool-result 必须独立(用户能单独筛选);UX 维度上配对显示一定要保留(用户能直接看到 input/output)。两者并不矛盾。

### 决策 2:数据层 types filter 不在本次范围

前份 spec 提到 `types` 查询参数,但**现有代码未实现**。本次设计文档(2026-05-17)也提到"补 types=tool-call 过滤场景",但既然 types filter 整体没落地,这次也不强行实施完整的服务端 filter。

采纳:本次**只**实现 normalize 输出 + 客户端 filter 兼容,**不**改 `getSessionMessages` 签名,**不**在 API route 加 types 参数。如果未来要做服务端 filter,单独立项。

`availableTypes` 由前端在客户端 messages 上计算(若有需要)。

### 决策 3:thinking 合并入 assistant 子消息

assistant 拆分时,连续的 `text + thinking` 块合并为同一条 `kind: "assistant"` 子消息(共享同一份 raw content 切片)。理由:thinking 是助手回复的过程性内容,UX 上紧跟 text 显示;独立成 kind 会增加复杂度且无明确收益。

### 决策 4:旧 helper 函数处置

`extractToolUses` / `extractToolResults` / `pairToolCalls` 在 message-turn 中的作用会被 normalize 替代。但 `pairToolCalls` 算法本身仍有价值(按 id 配对),可以保留并改写为接受 SessionMessage[] 输入,供 message-turn 计算配对集合。`extractToolUses` / `extractToolResults` 可以删除(死代码)。

## 关键文件

待修改:
- `types/claude.ts` — `SessionMessageKind` 加 `"tool-call"`,`MessageTurn` 改为 `events` 形态
- `lib/message-semantics.ts` — 新增 `normalizeAssistantContent`,接入 `normalizeRawSessionMessage`
- `lib/message-semantics.test.ts` — 补 assistant content 各形态测试
- `lib/message-grouping.ts` — `groupMessagesIntoTurns` 改用 `events`;`pairToolCalls` 改写为接受 SessionMessage[];删除 `extractToolUses`/`extractToolResults`
- `lib/message-grouping.test.ts` — 改测试以匹配新 events 结构
- `components/message/message-turn.tsx` — 用 events 驱动渲染;配对计算后传给 ToolCallCard
- `components/message/tool-call-card.tsx` — 入参改为 `SessionMessage`(tool-call) + 可选 `SessionMessage`(tool-result);内部从 raw 提取对应 block
- `components/message/assistant-message.tsx` — 已有逻辑(只渲染 text + thinking)沿用,无需大改;补 test 断言
- `components/message/assistant-message.test.tsx` — 断言不再渲染 tool_use 块
- `app/docs/message-types/page.tsx` — 新增 `tool-call` 主要类型卡片
- `public/docs/message-types-meta.json` — 添加 `tool-call` 元数据

待复用:
- `pairToolCalls` 中按 `tool_use_id` 配对的算法(改写但保留逻辑)
- `<ThinkingBlock />`、`<ToolCallCard />` 大部分内部渲染(只改入参)
- `normalizeUserContent` 的拆分模式(`normalizeAssistantContent` 参照此实现)

## Task List

### Phase 1:类型与语义基础

#### Task 1:扩展 SessionMessageKind 与 MessageTurn 类型

**Description**:在 `types/claude.ts` 中扩展 kind 联合类型,把 `MessageTurn` 改为 `events` 形态。此步骤会导致 grouping/UI 暂时编译失败 — 不要单独提交;与 Task 2/3 一起验证。

**Acceptance criteria**:
- [ ] `SessionMessageKind` 含 `"tool-call"`,5 个 kind
- [ ] `MessageTurn` 改为 `{ id, user, events: SessionMessage[], metadata: SessionMessage[] }`
- [ ] 旧字段 `assistant` 和 `toolResults` 移除

**Verification**:
- [ ] `npm run lint`(允许在此步骤显示 grouping/UI 的类型错误,Task 4 后应清零)

**Dependencies**:无

**Files**:
- `types/claude.ts`

**Scope**:XS

---

#### Task 2:实现 normalizeAssistantContent + 单测

**Description**:在 `lib/message-semantics.ts` 中新增 `normalizeAssistantContent`,参照现有 `normalizeUserContent` 的拆分模式:
- 字符串/非数组 content → 单条 assistant
- 全 text/thinking 块 → 单条 assistant
- 全 tool_use 块 → 每块独立成 tool-call
- 混合 → 按 content 顺序拆,连续 text/thinking 合并为一段 assistant 子消息,每个 tool_use 独立成 tool-call

`normalizeRawSessionMessage` 在 assistant 分支调用它。

assistant 子消息 raw 浅拷贝,只保留本段 text/thinking 块(对照现有 user text-block 拆分中 `newRaw` 的做法);tool-call 子消息 raw 保留完整原 raw,id 后缀 `tool-call-{contentBlockIndex}`(用原 content 数组真实索引)。

**Acceptance criteria**:
- [ ] `normalizeAssistantContent` 函数存在并被 `normalizeRawSessionMessage` 调用
- [ ] 单测覆盖:纯 text、纯 thinking、纯 text+thinking、纯 tool_use、混合 text+tool_use+text+tool_use、混合 text+thinking+tool_use
- [ ] 拆出的 assistant 子消息 raw 只含本段 text/thinking
- [ ] 拆出的 tool-call 子消息 raw 仍指向原始完整 raw
- [ ] id 后缀稳定(`tool-call-{contentBlockIndex}`、`assistant-{segmentIndex}`)

**Verification**:
- [ ] `npm run test:run -- lib/message-semantics.test.ts` 通过

**Dependencies**:Task 1

**Files**:
- `lib/message-semantics.ts`
- `lib/message-semantics.test.ts`

**Scope**:S

---

### Checkpoint: Phase 1
- [ ] Task 1+2 完成,`npm run test:run -- lib/message-semantics.test.ts` 全绿
- [ ] `npm run lint` 中 message-grouping 和 UI 的类型错误是已知预期(将在 Phase 2 修复)
- [ ] **不提交,与 Phase 2/3 一起作为一个原子改动**

---

### Phase 2:分组与配对工具

#### Task 3:重写 groupMessagesIntoTurns 使用 events

**Description**:把 `lib/message-grouping.ts` 的 `groupMessagesIntoTurns` 改为基于新的 `MessageTurn.events`:
- `kind: "user"` → 关闭当前 turn,开新 turn 设置 `user`
- `kind: "assistant" | "tool-call" | "tool-result"` → 追加到当前 turn 的 `events`(按消息顺序);无开启 turn 时建立 standalone turn
- `kind: "metadata"` → 进 metadata

**Acceptance criteria**:
- [ ] `MessageTurn` 字段使用 events
- [ ] events 中顺序与输入 messages 顺序一致
- [ ] tool-call 不开启新 turn
- [ ] tool-result 不开启新 turn

**Verification**:
- [ ] `npm run test:run -- lib/message-grouping.test.ts` 通过(需要在 Task 4 中改测试)

**Dependencies**:Task 1, 2

**Files**:
- `lib/message-grouping.ts`

**Scope**:S

---

#### Task 4:更新 grouping 测试 + 改写 pairToolCalls + 删除 extractToolUses/extractToolResults

**Description**:
- 把 `message-grouping.test.ts` 的 `groupMessagesIntoTurns` 测试改为断言 `events` 数组而非 `assistant` / `toolResults`。
- 把 `pairToolCalls` 改写为接受 `SessionMessage[]`(两个数组:tool-call 集合 + tool-result 集合),返回 `Map<toolCallId, toolResultMessage>` 或类似配对结构,逻辑沿用现有"按 tool_use_id 配对,fallback 顺序"。
- 删除 `extractToolUses` 和 `extractToolResults`(死代码,被 normalize 替代)。
- 更新对应 `pairToolCalls` 测试用例。
- 补充新测试:assistant content 含 tool_use 经 normalize 后,grouping 把 tool-call 放进 events 且不开新 turn;events 时序与 jsonl 顺序一致。

**Acceptance criteria**:
- [ ] `extractToolUses` / `extractToolResults` 已删除
- [ ] `pairToolCalls` 接受 SessionMessage 数组,行为正确(按 id 配对,fallback 顺序)
- [ ] 所有 grouping 测试改为 events 形态
- [ ] 新增至少 2 个测试覆盖 tool-call 在 events 中的顺序与配对

**Verification**:
- [ ] `npm run test:run -- lib/message-grouping.test.ts` 全绿

**Dependencies**:Task 3

**Files**:
- `lib/message-grouping.ts`
- `lib/message-grouping.test.ts`

**Scope**:M

---

### Checkpoint: Phase 2
- [ ] `npm run test:run -- lib/message-semantics.test.ts lib/message-grouping.test.ts` 全绿
- [ ] 此时 UI 仍编译失败 — 必须接着 Phase 3 才能跑 build

---

### Phase 3:UI 切换

#### Task 5:改造 ToolCallCard 入参

**Description**:把 `components/message/tool-call-card.tsx` 的 props 从 `{ toolUse, toolResult }` 改为 `{ message: SessionMessage, resultMessage?: SessionMessage }`,内部:
- 从 `message.raw.message.content` 中找到与 `message.id` 后缀对应的 `tool_use` 块(后缀格式 `tool-call-{index}`,直接取 content[index])
- 若 `resultMessage` 存在,从其 raw 中提取 `tool_result` 块
- 渲染逻辑不变(Input + Result 折叠展开)

**Acceptance criteria**:
- [ ] ToolCallCard 接受 SessionMessage 入参
- [ ] 视觉与现有行为完全一致(Input/Result 展开折叠、`等待结果` 状态)
- [ ] 仍能正确显示 tool name

**Verification**:
- [ ] 手动:运行 `npm run dev`,打开一个含工具调用的 session,工具调用卡片显示正常

**Dependencies**:Task 1-4

**Files**:
- `components/message/tool-call-card.tsx`

**Scope**:S

---

#### Task 6:改造 MessageTurn 用 events 渲染

**Description**:把 `components/message/message-turn.tsx` 改为基于 `turn.events` 驱动:
- 先调用新版 `pairToolCalls`,从 events 中分离出 tool-call 与 tool-result 数组,计算配对集合
- 收集已被配对消费的 tool-result id 集合
- 遍历 events:
  - assistant → `<AssistantMessage>`
  - tool-call → `<ToolCallCard message={...} resultMessage={pairedResult || undefined} />`
  - tool-result → 如果已被消费,跳过;否则独立渲染 `<ToolResultCard>`(用 tool-result 的 raw 提取 block)
- User、Metadata、Turn header 渲染保持不变

注意 `<ToolResultCard>` 当前签名是 `{ toolResult: Record<string, unknown> }` — 需要从 SessionMessage.raw 提取对应 `tool_result` block 传给它,**不需要改 ToolResultCard 本身**。

**Acceptance criteria**:
- [ ] `MessageTurn` 不再引用 `turn.assistant` / `turn.toolResults`
- [ ] events 渲染顺序与源时序一致
- [ ] 配对的 tool-result 不重复渲染
- [ ] 未配对的 tool-result(罕见 orphan)仍能独立渲染

**Verification**:
- [ ] `npm run build` 通过
- [ ] 手动:打开包含 assistant(text → tool_use → text)的 session,看到 events 按时序显示

**Dependencies**:Task 5

**Files**:
- `components/message/message-turn.tsx`

**Scope**:M

---

#### Task 7:更新 AssistantMessage 测试

**Description**:`components/message/assistant-message.tsx` 现有渲染逻辑(只渲染 thinking + text)其实已经不渲染 tool_use 块(那是 MessageTurn 干的)。所以代码不需要改,但需要在 `assistant-message.test.tsx` 中加一个测试断言:即使 raw content 中含 `tool_use` 块,组件也不应渲染该块(确保未来不会回退)。

**Acceptance criteria**:
- [ ] 新增测试用例:assistant message 的 raw 含 tool_use 块时,渲染结果不包含 tool name 或 tool input 痕迹
- [ ] 现有 thinking + text 渲染测试仍通过

**Verification**:
- [ ] `npm run test:run -- components/message/assistant-message.test.tsx` 通过

**Dependencies**:Task 6

**Files**:
- `components/message/assistant-message.test.tsx`

**Scope**:XS

---

### Checkpoint: Phase 3
- [ ] `npm run test:run` 全量通过
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] 手动验证:打开真实 session(如 `30001`),工具调用与文字回复按时序正确显示

---

### Phase 4:文档同步

#### Task 8:更新 message-types 文档页

**Description**:在 `/docs/message-types` 页面新增 `tool-call` 主要类型卡片。如果 `public/docs/message-types-meta.json` 是数据源,在其中补 `tool-call` 元数据(label / color / description / example JSON)。配色建议沿用与 assistant 同色族但更深一档,或选用 amber/橙色系(与 ToolCallCard 的 amber 视觉一致)。

**Acceptance criteria**:
- [ ] 访问 `/docs/message-types` 看到 `tool-call` 卡片
- [ ] 配色与 ToolCallCard 视觉风格一致或合理
- [ ] description 文字简明描述 "assistant 发起的工具调用"

**Verification**:
- [ ] 手动:`npm run dev` → 访问 `http://localhost:3000/docs/message-types`,看到新卡片

**Dependencies**:Task 6(UI 已切换)

**Files**:
- `app/docs/message-types/page.tsx`(或对应组件)
- `public/docs/message-types-meta.json`

**Scope**:S

---

### Checkpoint: Complete
- [ ] 所有任务的验收标准都满足
- [ ] `npm run test:run` / `npm run lint` / `npm run build` 全绿
- [ ] 在含工具调用的 session 上手动验证 5 个场景:
  - [ ] 纯 text assistant 显示正常
  - [ ] 纯 tool_use assistant 拆出独立 tool-call 卡片
  - [ ] text + tool_use 混合 assistant 按时序拆为 assistant + tool-call
  - [ ] tool-call 卡片仍能展开看到配对的 tool-result(Input + Result)
  - [ ] 右侧用户轮次导航行为完全不变
- [ ] 准备提交(commit message 引用 spec 文件)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MessageTurn 类型一改,整个项目编译断裂 | High | Phase 1-3 必须作为一个原子改动完成,不中间提交;每 task 完成后跑 `tsc --noEmit` 局部确认 |
| ToolCallCard 配对查找出错,Input/Result 显示空白 | Medium | Task 6 完成后立即手动验证含工具调用的 session;保留 fallback orphan 渲染 |
| normalize 拆分破坏现有 user 消息处理 | Medium | Task 2 测试需覆盖现有所有 user 用例(从现有 `message-semantics.test.ts` 全部继承,不破坏) |
| `pairToolCalls` 改写后丢失 fallback 行为 | Low | Task 4 测试需保留现有 index-based fallback 测试 |
| 文档页 typeConfig 配色冲突 | Low | Task 8 可独立做,不影响主流程;若配色不合再迭代 |

## Open Questions

1. tool-call 文档卡片的配色:跟 ToolCallCard 的 amber 一致,还是新选一色?默认 amber(与 UI 一致),Task 8 可微调。
2. 是否在 PR 中顺便清掉 `MessageTurn.toolResults` 等的死引用搜索?默认 Task 4 一并处理。
3. 未来如果做服务端 types filter,是否需要预留 API 兼容?本次不预留,保持 minimal change。

## Verification 总览

实施过程中按顺序:
1. Phase 1 完成 → `npm run test:run -- lib/message-semantics.test.ts`
2. Phase 2 完成 → `npm run test:run -- lib/message-grouping.test.ts lib/message-semantics.test.ts`
3. Phase 3 完成 → `npm run test:run` 全量 + `npm run lint` + `npm run build` + 手动 UI 验证
4. Phase 4 完成 → 访问 `/docs/message-types` 验证视觉

End-to-end 手动验证清单(Phase 3 后):
1. `npm run dev`,导航到一个含 tool_use 的 session(如 `30001`)
2. 验证:assistant 文本回复与 tool-call 卡片按源时序交错出现
3. 展开 tool-call 卡片 → 看到 Input 和 Result(配对成功)
4. 右侧用户轮次导航仍只显示真实用户输入
5. Raw JSON 面板仍能看到原始完整 content
6. (Phase 4 后)访问 `/docs/message-types` → 看到 tool-call 卡片
