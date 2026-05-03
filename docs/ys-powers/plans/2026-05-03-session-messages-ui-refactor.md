# Plan: Session Messages UI Refactor

## 背景

基于 Spec `docs/specs/session-messages-ui-refactor.md`，对 session 详情页 messages 区域进行 UI 重构。目标：让对话脉络更清晰、关键内容更易扫描。

## 依赖图

```
现有数据流（不变）
API → session-browser.tsx → message-stream.tsx
                             ↓
                       message-card.tsx
                        /    |    \
                  user   assistant   compact
                            /    \
                      thinking   tool_use
                                 ↓
                            tool_result (未渲染)

目标架构（垂直切片后）
message-stream.tsx → MessageTurn[]
       ↓
 message-turn.tsx
 ┌─ user-message.tsx
 ┌─ assistant-message.tsx
 │    ├─ thinking-block.tsx
 │    └─ tool-call-card.tsx (聚合 tool_use + result)
 └─ compact-message.tsx (含 json-tree.tsx)
```

## 垂直切片（5 个 Slice）

每个 Slice 都是端到端可验证的完整功能路径。

---

### Slice 1: Compact 消息美化 + 自研 JSON 树

**路径：** JSON 树组件 → Compact 消息组件 → 集成到现有 message-card

- 新建 `components/message/json-tree.tsx`
- 新建 `components/message/compact-message.tsx`
- 修改 `components/message-card.tsx`：替换现有 `CompactMessageCard`

**验收标准：**
- [ ] Compact 行有 6 种类型颜色编码
- [ ] Hover 显示核心字段摘要
- [ ] 点击展开 JSON 树（支持折叠/展开节点、键值颜色区分、复制按钮）
- [ ] 暗色模式正常

**验证：** 浏览器查看 compact 消息行颜色正确，JSON 树交互正常

---

### Slice 2: Thinking 块升级

**路径：** Thinking 块组件 → 集成到 Assistant 消息

- 新建 `components/message/thinking-block.tsx`
- 新建 `components/message/assistant-message.tsx`
- 修改 `components/message-card.tsx`：Assistant 类型分发到新组件

**验收标准：**
- [ ] Thinking 不再截断 500 字符
- [ ] 保留换行格式
- [ ] 默认折叠，点击展开
- [ ] 展开后最大高度限制 + 内部滚动条

**验证：** 打开包含 thinking 的 assistant 消息，确认完整内容可滚动查看

---

### Slice 3: Tool 调用链聚合

**路径：** Tool 调用卡片 → 集成到 Assistant 消息

- 新建 `components/message/tool-call-card.tsx`
- 修改 `components/message/assistant-message.tsx`
- 实现 tool_use / tool_result 顺序配对逻辑

**验收标准：**
- [ ] Tool_use 和对应 tool_result 聚合为一张卡片
- [ ] 头部显示工具名 + 折叠按钮
- [ ] 展开后输入参数和执行结果用 JSON 树展示
- [ ] 无 toolResult 时显示"等待结果"占位

**验证：** 浏览器查看包含 tool 调用的 session，确认成对聚合

---

### Slice 4: 轮次分组（架构级）

**路径：** 分组算法 → 轮次容器组件 → Stream 重构

- 修改 `types/claude.ts`：新增 `MessageTurn` 类型
- 新建 `lib/message-grouping.ts`：纯函数 `groupMessagesIntoTurns`
- 新建 `components/message/message-turn.tsx`
- 新建 `components/message/format-time.ts`
- 重构 `components/message-stream.tsx`
- 清理 `components/message-card.tsx`

**验收标准：**
- [ ] 消息严格按原始顺序分组
- [ ] User 消息开启新 turn
- [ ] Assistant、tool 归入同 turn
- [ ] Compact 元数据归入同 turn 或独立 turn
- [ ] Turn 间留白清晰（my-6），turn 内紧凑
- [ ] 保留 scrollRef 转发
- [ ] 空状态、加载、错误状态不受影响

**验证：** 浏览器查看 session，确认消息有轮次感，滚动和分页正常

---

### Slice 5: 回归验证

**路径：** 构建检查 → 功能回归

- 运行 `npm run build` 和 `npx tsc --noEmit`
- 验证 worktree 切换、分页加载、空状态、错误状态
- 验证暗色模式

**验收标准：**
- [ ] 构建无错误
- [ ] 类型检查无错误
- [ ] 分页、worktree、空状态、错误状态无回归
- [ ] 暗色模式样式一致

**验证：** 手动浏览器测试 + 构建输出

---

## 检查点（Checkpoint）

| 检查点 | 触发条件 | 审核内容 |
|--------|----------|----------|
| **CP-1** | Slice 1 完成后 | Compact 消息颜色和 JSON 树交互是否满意？ |
| **CP-2** | Slice 2+3 完成后 | Thinking 展示和 Tool 卡片是否符合预期？ |
| **CP-3** | Slice 4 完成后 | 轮次分组视觉效果是否接受？是否需要调整留白/边框？ |
| **CP-4** | Slice 5 完成后 | 构建通过，功能无回归，可以结束 |

## 关键决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| JSON 组件 | 自研 | 避免 React 19 兼容性风险，基于 shadcn 风格 |
| 轮次分组边界 | 消息顺序严格保持原始文件顺序 | 用户明确要求 |
| Thinking 默认状态 | 折叠 | 内容经常很长，避免占满一屏 |
| Tool 配对策略 | 按出现顺序索引配对 | LLM 约束了顺序必须对应 |
