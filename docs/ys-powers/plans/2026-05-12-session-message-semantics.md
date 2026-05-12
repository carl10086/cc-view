# Implementation Plan: Session Message 语义与轮次导航

## Overview

基于 `docs/ys-powers/specs/2026-05-12-session-message-semantics-design.md`，本计划将 session message 从“直接使用 Claude jsonl 原始 `type`”迁移到“统一产品语义 `kind`”。最终目标是：`user` 只代表真实用户输入，`tool-result` 独立展示和过滤，filter 先于 pagination，conversation turn 和右侧导航都基于真实用户输入。

## Architecture Decisions

- 使用 `SessionMessage.kind` 和 `SessionMessage.filterType` 作为一等语义字段。`type` 保留原始协议含义，`raw` 保留完整 jsonl object。
- 语义判断集中在 `lib/message-semantics.ts`，组件禁止重复判断 `message.type === "user"` 来代表真实用户输入。
- 服务端读取 jsonl 后先 normalize，再 filter，再 order，再分页。前端不再等 `Load all` 后才启用 filter。
- 右侧导航栏改为用户输入轮次导航，数据由服务端基于全 session 语义消息生成。
- 第一版导航跳转采用“目标未加载时按 offset 继续加载到目标”的策略，不引入双向虚拟窗口。

## Dependency Graph

```text
types/claude.ts
  └── lib/message-semantics.ts
        ├── lib/claude-data.ts
        │     └── app/api/projects/[projectId]/sessions/[sessionId]/route.ts
        │           └── components/session-browser.tsx
        │                 ├── components/message-stream.tsx
        │                 └── components/message/message-nav-panel.tsx
        └── lib/message-grouping.ts
              └── components/message/message-turn.tsx
                    ├── components/message/user-message.tsx
                    └── components/message/tool-result-card.tsx
```

实现顺序：先类型与语义基础，再数据层查询语义，再迁移分组与展示，最后接入 filter UI 和右侧导航。

## Task List

### Phase 1: Semantic Foundation

#### Task 1: 建立 `SessionMessage` 产品语义类型（已完成）

**Description:** 扩展共享类型，增加 `SessionMessageKind`、`kind`、`filterType`、`UserTurnNavItem`，并调整 `MessageTurn` 支持 `toolResults`。

**Acceptance criteria:**

- `SessionMessage` 包含 `kind` 和 `filterType`。
- `MessageTurn` 能表达 `toolResults`，不再要求 tool result 藏在 `user` message 内。
- 新类型不使用 `any`。

**Verification:**

- 运行 `npm run test:run -- lib/message-grouping.test.ts`，允许因未迁移实现失败，但类型编译不应出现新增语法错误。
- 运行 `npm run lint`。

**Dependencies:** None

**Files likely touched:**

- `types/claude.ts`
- `lib/message-grouping.test.ts`

**Estimated scope:** Small

#### Task 2: 实现 `lib/message-semantics.ts` 与单元测试（已完成）

**Description:** 新增集中语义层，负责 raw jsonl object 到 semantic `SessionMessage[]` 的 normalize，包括 user、assistant、tool-result、metadata 判定和混合 content 拆分。

**Acceptance criteria:**

- string content user 被识别为 `kind: "user"`。
- 纯 `tool_result` user-role 消息被识别为 `kind: "tool-result"`。
- text + tool_result 混合 content 被拆成多个 semantic messages，且共享 raw。
- metadata 的 `filterType` 保留原始细类型。
- 提供用户输入 preview helper，供 navItems 使用。

**Verification:**

- 运行 `npm run test:run -- lib/message-semantics.test.ts`。
- 手动检查测试 fixture 中 raw 未被改写。

**Dependencies:** Task 1

**Files likely touched:**

- `lib/message-semantics.ts`
- `lib/message-semantics.test.ts`
- `types/claude.ts`

**Estimated scope:** Medium

### Checkpoint: Semantic Foundation

- `npm run test:run -- lib/message-semantics.test.ts` 通过。
- 没有组件层重复实现 user/tool-result 判定。
- 与用户确认 open question：`availableTypes` 排序是否采用 `user`、`assistant`、`tool-result` 优先。

### Phase 2: Server Query Semantics

#### Task 3: 迁移 `getSessionMessages` 到 normalize/filter/page 流程

**Description:** 修改 `lib/claude-data.ts` 的 session message 读取流程：读取 jsonl 后先 normalize 成 semantic messages，再按 `types` filter，随后应用 `order`、`offset`、`limit`。

**Acceptance criteria:**

- `getSessionMessages` 接受可选 `types: string[]` 参数。
- `total` 表示过滤后的总数。
- `unfilteredTotal` 表示未过滤的 semantic message 总数。
- `availableTypes` 来自全 session semantic messages。
- `navItems` 只包含真实用户输入。
- `hasMore` 基于过滤后的 total 计算。

**Verification:**

- 运行 `npm run test:run -- lib/claude-data.test.ts`。
- 新增测试覆盖 `types=user`、`types=tool-result`、filter-before-pagination。

**Dependencies:** Task 2

**Files likely touched:**

- `lib/claude-data.ts`
- `lib/claude-data.test.ts`
- `lib/message-semantics.ts`

**Estimated scope:** Medium

#### Task 4: API 支持语义 filter 参数与新响应字段

**Description:** 修改 session GET route，解析 `types` 查询参数并透传给 `getSessionMessages`，响应增加 `unfilteredTotal`、`availableTypes`、`navItems`。

**Acceptance criteria:**

- 支持 `?types=user,tool-result`。
- 空 `types` 等价于不过滤。
- 非法/空白 type 被清理，不造成 500。
- 响应包含 spec 要求的新字段。

**Verification:**

- 运行 `npm run test:run -- lib/claude-data.test.ts`。
- 手动请求 API，确认 `types=user` 不返回 tool result。

**Dependencies:** Task 3

**Files likely touched:**

- `app/api/projects/[projectId]/sessions/[sessionId]/route.ts`
- `lib/claude-data.ts`

**Estimated scope:** Small

### Checkpoint: Server Query

- `npm run test:run -- lib/message-semantics.test.ts lib/claude-data.test.ts` 通过。
- API 返回字段能支撑前端 filter 和 nav，不需要前端全量加载才能知道 filter types。

### Phase 3: Grouping and Message Rendering

#### Task 5: 让 `groupMessagesIntoTurns` 基于 `kind` 分组

**Description:** 修改分组算法，让 `kind: "user"` 才开启 turn，`kind: "tool-result"` 进入 `toolResults`，metadata 保持在 turn metadata 中。

**Acceptance criteria:**

- tool result 不再开启新的 turn。
- `user -> assistant -> tool-result -> assistant` 保持可读因果链。
- session 开头 metadata 不生成用户导航项。
- `extractToolResults` 改为从 `turn.toolResults` 或 semantic messages 中读取。

**Verification:**

- 运行 `npm run test:run -- lib/message-grouping.test.ts`。
- 测试覆盖 consecutive user、orphan assistant、prelude metadata。

**Dependencies:** Task 2

**Files likely touched:**

- `lib/message-grouping.ts`
- `lib/message-grouping.test.ts`
- `types/claude.ts`

**Estimated scope:** Medium

#### Task 6: 迁移 message 展示到 `kind` 分发

**Description:** 更新 message rendering，使 `UserMessage` 只负责真实用户输入，tool result 使用独立展示路径，`MessageTurn` 用 `turn.toolResults` 与 assistant tool_use 配对。

**Acceptance criteria:**

- `UserMessage` 不再渲染 `tool_result` block。
- tool result 以工具结果样式展示。
- `MessageTurn` 中 tool result 与 tool_use 仍可按 `tool_use_id` 配对。
- raw JSON 仍可查看原始 user-role tool_result。

**Verification:**

- 运行 `npm run test:run -- lib/message-grouping.test.ts`。
- 手动打开含 tool result 的 session，确认 tool result 不显示为用户气泡。

**Dependencies:** Task 5

**Files likely touched:**

- `components/message/message-turn.tsx`
- `components/message/user-message.tsx`
- `components/message/tool-result-card.tsx`
- `lib/message-grouping.ts`

**Estimated scope:** Medium

### Checkpoint: Rendering Semantics

- `npm run test:run -- lib/message-semantics.test.ts lib/message-grouping.test.ts` 通过。
- 真实 user、assistant、tool-result、metadata 都能正常展示。
- 手动验证 `30001` 中 tool result 不再伪装成用户输入。

### Phase 4: Filter UI Integration

#### Task 7: 前端接入服务端语义 filter

**Description:** 修改 `SessionBrowser`，使 filter chips 来自 API `availableTypes`，切换 filter 时重置 offset 并请求服务端，不再依赖 `isFullyLoaded`。

**Acceptance criteria:**

- filter 控件在未 `Load all` 时可用。
- 选择 `user` 会请求 `types=user`。
- 切换 filter 时清空当前 messages，重新加载第一页。
- `Load all` 加载当前 filter 条件下的全部匹配结果。
- 状态文案显示 filtered total，例如 `Showing 50 of 82 user messages`。

**Verification:**

- 运行 `npm run test:run`。
- 手动验证未 Load all 时 `user` / `tool-result` filter 可用。

**Dependencies:** Task 4

**Files likely touched:**

- `components/session-browser.tsx`
- `types/claude.ts`
- `app/api/projects/[projectId]/sessions/[sessionId]/route.ts`

**Estimated scope:** Medium

### Checkpoint: Filter Flow

- `npm run test:run` 通过。
- `user` filter 不出现 tool result。
- `tool-result` filter 只出现 tool result。
- 分页 remaining / total 语义正确。

### Phase 5: User Turn Navigation

#### Task 8: 将 `MessageNavPanel` 改为用户输入轮次导航

**Description:** 右侧导航栏从 compact metadata 分组列表改为真实用户输入列表，展示 preview 和时间，点击触发跳转。

**Acceptance criteria:**

- 导航项只来自 `navItems` 中的真实用户输入。
- 不显示 tool result、assistant、system、attachment 作为一级导航项。
- 空状态文案适配用户轮次，例如 `No user turns`。
- 点击导航项调用 `onNavigate(messageId, offset)`。

**Verification:**

- 运行 `npm run test:run -- components/message/message-nav-panel.test.tsx`。
- 手动验证右侧导航只列用户输入 preview。

**Dependencies:** Task 4

**Files likely touched:**

- `components/message/message-nav-panel.tsx`
- `components/message/message-nav-panel.test.tsx`
- `types/claude.ts`

**Estimated scope:** Medium

#### Task 9: 实现未加载导航目标的补加载跳转

**Description:** 更新 `SessionBrowser` 与 `MessageStream` 跳转逻辑。若目标 user message 未在当前 messages 中，根据 nav item offset 继续加载到目标进入列表，再滚动并高亮。

**Acceptance criteria:**

- 已加载目标：立即滚动并高亮。
- 未加载目标：显示 pending 状态，继续按当前查询条件加载，目标出现后滚动并高亮。
- pending 时避免重复点击触发并发加载。
- 如果目标因 filter 条件不匹配或请求失败，显示可理解错误或恢复 pending 状态。

**Verification:**

- 运行 `npm run test:run`。
- 手动打开长 session，点击远处导航项，验证自动加载、滚动、高亮。

**Dependencies:** Task 7, Task 8

**Files likely touched:**

- `components/session-browser.tsx`
- `components/message/message-nav-panel.tsx`
- `components/message-stream.tsx`

**Estimated scope:** Medium

### Checkpoint: Navigation Flow

- `npm run test:run` 通过。
- 长 session 中右侧导航可跳转到未加载用户输入。
- 过滤状态下导航和当前查询条件一致。

### Phase 6: Final Verification and Cleanup

#### Task 10: 全量回归与文档校准

**Description:** 做完整回归，更新 spec/plan 中实施中发生变化的决策，清理旧 compact nav 命名或过时测试断言。

**Acceptance criteria:**

- 不再有 UI 主逻辑使用 `message.type === "user"` 表示真实用户输入。
- 过时的 `Load all to enable filtering/navigation` 文案被移除或改写。
- 设计文档和计划文档与实际实现一致。

**Verification:**

- `npm run lint`
- `npm run test:run`
- `npm run build`
- 手动验证 `30001` session。

**Dependencies:** Task 1-9

**Files likely touched:**

- `docs/ys-powers/specs/2026-05-12-session-message-semantics-design.md`
- `docs/ys-powers/plans/2026-05-12-session-message-semantics.md`
- Any stale tests or UI copy touched by earlier tasks

**Estimated scope:** Small

## Parallelization Opportunities

- Task 2 完成后，Task 3（数据层）和 Task 5（分组）可以并行。
- Task 4 完成后，Task 7（filter UI）和 Task 8（nav panel UI）可以并行，但需要共享 API response contract。
- Task 6 和 Task 8 可部分并行，但最终都依赖 `kind` 类型和 semantic fixtures。

必须顺序执行：

- Task 1 -> Task 2。
- Task 3 -> Task 4 -> Task 7。
- Task 7 + Task 8 -> Task 9。

## Risks and Mitigations


| Risk                                                  | Impact      | Mitigation                                                             |
| ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| mixed content 拆分导致 message count 与 raw line count 不一致 | 用户理解成本上升    | 保留 raw，必要时在 JSON 面板显示原始 line；UI count 明确表示 semantic messages           |
| `types` filter 每次都遍历大 jsonl                           | filter 切换变慢 | 第一版沿用现有 100MB 上限；如性能不足，再加 per-session cache                            |
| 导航目标 offset 在过滤状态下不稳定                                 | 跳转错位        | navItems 的 offset 必须基于当前 query/filter 语义生成                             |
| 分组迁移影响 tool_use/tool_result 配对                        | 工具链展示回退     | 优先按 `tool_use.id` / `tool_result.tool_use_id` 测试覆盖                     |
| 前端状态同时处理 sort/page/filter/nav pending 变复杂             | 竞态请求或重复加载   | 复用 `requestIdRef` 和 `AbortController`，filter/sort/pageSize 改变时统一 reset |


## Open Questions

- `availableTypes` 固定排序是否采用 `user`、`assistant`、`tool-result` 优先，其余 metadata 按字母排序？: 是的
- 右侧导航 preview 截断长度采用 50 字符是否合适？合适
- 第一版未加载导航目标采用“继续加载到 offset”，是否接受目标很远时的等待时间？接受
- semantic message count 与 raw line count 不一致时，是否需要在 UI 文案中解释？不理解

