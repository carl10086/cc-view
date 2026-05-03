# Tasks: Session Messages UI Refactor

## Task 1: 自研 JSON 树组件
- [ ] 创建 `components/message/json-tree.tsx`
- **Acceptance:**
  - 支持对象/数组/基本类型的递归渲染
  - 对象和数组可折叠（默认折叠到第 1 层）
  - 颜色编码：键名 gray-500、字符串 green-600、数字 blue-600、布尔/null purple-500
  - 折叠按钮用 ChevronRight/ChevronDown 图标
  - 右上角有"Copy"按钮，点击复制完整 JSON
  - shadcn 风格：圆角、小字号 text-xs、中性背景
  - 暗色模式兼容
- **Verify:** 在临时页面或 story 中渲染一个复杂 JSON，测试折叠/展开/复制
- **Files:** `components/message/json-tree.tsx`

## Task 2: Thinking 块 + Compact 消息组件
- [ ] 创建 `components/message/thinking-block.tsx`
- [ ] 创建 `components/message/compact-message.tsx`
- [ ] 修改 `components/message-card.tsx`，引入上述组件
- **Acceptance:**
  - Thinking 取消 500 字符截断，保留换行格式
  - Thinking 默认折叠，展开后限制最大高度 + 内部滚动
  - Compact 消息有 6 种类型颜色编码
  - Compact 消息 hover 显示核心字段摘要
  - Compact 消息点击展开 JSON 树（替代 `<pre>`）
- **Verify:** 浏览器查看 thinking 块完整展示、compact 行颜色区分
- **Files:** `components/message/thinking-block.tsx`, `components/message/compact-message.tsx`, `components/message-card.tsx`

## Task 3: Tool 调用链卡片
- [ ] 创建 `components/message/tool-call-card.tsx`
- **Acceptance:**
  - 接收 `toolUse` 和可选 `toolResult` 两个消息对象
  - 头部显示工具名 + wrench 图标 + 折叠按钮
  - 展开后：输入参数用 JSON 树展示、执行结果用 JSON 树或文本展示
  - 无 toolResult 时显示"等待结果"占位
  - 暗色模式兼容
- **Verify:** 浏览器查看 tool 卡片展开/折叠、JSON 树嵌套正常
- **Files:** `components/message/tool-call-card.tsx`

## Task 4: 轮次分组算法
- [ ] 创建 `lib/message-grouping.ts`
- [ ] 扩展 `types/claude.ts`（如需 MessageTurn 类型）
- **Acceptance:**
  - 纯函数 `groupMessagesIntoTurns(messages: SessionMessage[]): MessageTurn[]`
  - 规则：user 开新 turn；assistant/tool 归入当前 turn；其他 compact 有当前 turn 则归入 metadata，否则独立 turn
  - 消息顺序严格保持原始顺序
  - 不遗漏任何消息（输入输出长度一致验证）
- **Verify:** 单元测试或 console.log 验证边界情况（以 system 开头、连续 user、无 assistant 等）
- **Files:** `lib/message-grouping.ts`, `types/claude.ts`

## Task 5: 轮次容器 + Stream 重构
- [ ] 创建 `components/message/message-turn.tsx`
- [ ] 重构 `components/message-stream.tsx` 渲染轮次列表
- [ ] 创建 `components/message/format-time.ts`
- [ ] 清理 `components/message-card.tsx`
- **Acceptance:**
  - MessageTurn 组件包裹一轮消息，turn 间留白清晰（my-6 或 border）
  - Turn 内消息紧凑（gap-1）
  - 保留 scrollRef 转发
  - 空状态、加载状态、错误状态不受影响
  - 暗色模式样式一致
- **Verify:** 浏览器查看轮次分组效果、滚动正常、分页加载正常
- **Files:** `components/message/message-turn.tsx`, `components/message-stream.tsx`, `components/message/format-time.ts`, `components/message-card.tsx`

## Task 6: 回归验证
- [ ] 运行构建和类型检查
- [ ] 验证 worktree 切换
- [ ] 验证分页加载
- [ ] 验证空状态和错误状态
- **Acceptance:**
  - `npm run build` 通过
  - `npx tsc --noEmit` 无错误
  - 暗色模式切换正常
  - 所有现有功能无回归
- **Verify:** 手动浏览器测试 + 构建输出
- **Files:** 全局
