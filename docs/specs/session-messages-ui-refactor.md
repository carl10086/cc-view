# Spec: Session Messages UI Refactor

## Objective

重构 session 详情页的 messages 区域，让对话脉络更清晰、关键内容更易扫描。

**目标用户：** 需要回顾 Claude Code session 完整交互过程的使用者。

**成功标准：**
- 一眼能看到 "user 问了什么 → AI 怎么想的 → AI 回了什么 → 调用了哪些 tool" 的完整因果链
- Thinking 和 JSON 元数据有专门的美化展示，不再被截断或纯文本硬塞
- 大量消息时有清晰的扫描节奏，不视觉疲劳
- 现有功能（分页、worktree 切换、加载状态）不受影响

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5.x
- Tailwind CSS v4
- shadcn/ui (现有组件库)
- Lucide React (现有图标库)

**依赖策略：** JSON 树形组件优先自研（递归渲染 + Tailwind），避免引入 React 19 兼容性未知的第三方库。若自研超预期复杂度，再评估 `@microlink/react-json-view`。

## Commands

```bash
# 开发
npm run dev

# 构建验证
npm run build

# 类型检查
npx tsc --noEmit

# 代码风格检查
npm run lint
```

## Project Structure

已有结构保持不变，新增/修改范围：

```
components/
  session-browser.tsx       # 修改：两栏布局容器，加入轮次分组数据转换
  message-stream.tsx        # 修改：渲染轮次列表而非平铺消息列表
  message-card.tsx          # 重构：拆分为多个子组件
  message/
    user-message.tsx        # 新增：用户消息气泡
    assistant-message.tsx   # 新增：助手消息（含 thinking、text、tool 链）
    tool-call-card.tsx      # 新增：tool_use + tool_result 聚合卡片
    thinking-block.tsx      # 新增：可折叠 thinking 块
    json-tree.tsx           # 新增：自研 JSON 树形折叠组件
    compact-message.tsx     # 新增：带颜色编码的元数据行
    message-turn.tsx        # 新增：轮次容器组件
    format-time.ts          # 新增：时间格式化工具（从 message-card 提取）
types/
  claude.ts                 # 现有，可能扩展轮次相关类型
```

## Code Style

**组件结构：**
```tsx
// 函数组件 + 显式返回类型 + interface props
interface ToolCallCardProps {
  toolUse: SessionMessage
  toolResult?: SessionMessage
}

export function ToolCallCard({ toolUse, toolResult }: ToolCallCardProps): JSX.Element {
  // ...
}
```

**Tailwind 类名顺序：** 布局 → 尺寸 → 间距 → 外观 → 交互 → 暗色模式
```tsx
// Good
<div className="flex h-full items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 hover:bg-neutral-200 dark:bg-neutral-800">

// Bad
<div className="px-4 flex dark:bg-neutral-800 bg-neutral-100 hover:bg-neutral-200 gap-2 rounded-lg items-center h-full py-2">
```

**状态命名：** `[名词, set名词]`，布尔状态用 `is`/`has`/`show` 前缀
```tsx
const [showThinking, setShowThinking] = useState(false)
const [isExpanded, setIsExpanded] = useState(false)
```

## Testing Strategy

- **手动验证为主：** UI 改动以浏览器视觉验证为准
- **关键逻辑单元测试：** 轮次分组算法、tool_use/tool_result 匹配逻辑
- **回归检查：** 分页加载、worktree 切换、空状态、错误状态
- **测试位置：** 若写单元测试，放在 `__tests__/components/` 或与被测文件同目录的 `.test.ts` 文件

## Boundaries

- **Always:**
  - 保持现有数据流（API 端点 `/api/projects/.../sessions/...` 不变）
  - 保持 TypeScript 类型安全，不Any化
  - 修改前先读取目标文件最新内容
  - 删除自己改动导致的未使用 import/变量

- **Ask first:**
  - 引入新的 npm 依赖
  - 修改 API 端点或数据模型
  - 改变现有的分页参数（500条/页）
  - 删除看似未使用的旧组件/函数（可能是其他页面在用）

- **Never:**
  - 修改 `.jsonl` 文件的解析逻辑或数据结构
  - 引入消息编辑/发送/删除功能
  - 破坏现有 worktree 切换和分页加载行为
  - 修改相邻文件（如 project 列表页、settings 页）

## Implementation Phases

### Phase 1: 基础组件升级（低风险高价值）

1. **Thinking 块升级**
   - 取消 500 字符硬截断 (`slice(0, 500)`)
   - 保留换行格式（移除 `replace(/\n/g, " ")`）
   - 容器限制最大高度 + 内部滚动，默认折叠，点击展开
   - 组件：`thinking-block.tsx`

2. **JSON 树形组件（自研）**
   - 支持：对象/数组/基本类型的层级渲染
   - 可折叠节点（对象和数组）
   - 键名灰色，字符串绿色，数字蓝色，布尔/null 紫色
   - 复制到剪贴板按钮
   - 组件：`json-tree.tsx`

3. **Compact 消息美化**
   - 类型颜色编码：system=灰、attachment=琥珀、ai-title=紫、queue=蓝、permission-mode=青、file-history-snapshot=绿
   - Hover 显示核心字段摘要（tooltip 或行内展开）
   - 点击展开 JSON 树（替代现在的 `<pre>`）
   - 组件：`compact-message.tsx`

4. **重构 message-card.tsx**
   - 拆分为独立子组件文件，主文件只做类型分发
   - 提取 `formatTime` 到独立工具文件

### Phase 2: 轮次分组（架构级改动）

5. **轮次分组算法**
   - 输入：平铺的 `SessionMessage[]`
   - 输出：`MessageTurn[]`，每个 turn 包含：
     - `user?: SessionMessage`
     - `assistant?: SessionMessage`
     - `tools: SessionMessage[]` (tool_use + tool_result)
     - `metadata: SessionMessage[]` (穿插的 system/attachment 等)
   - 分组规则：
     - 遇到 `user` 类型 → 新开一个 turn
     - `assistant` 归入当前 turn
     - `tool_use` 和 `tool_result` 归入当前 turn 的 tools 数组
     - 其他 compact 类型 → 若当前有未关闭的 turn，归入其 metadata；否则作为独立 turn
   - 位置：`lib/message-grouping.ts`

6. **轮次容器组件**
   - 视觉包裹：轻量边框或背景色区分不同 turn
   - Turn 之间留白加大（`gap-6` 或 `my-6`）
   - Turn 内消息紧凑（`gap-1`）
   - 显示轮次序号或 user 消息的时间作为 turn 标题
   - 组件：`message-turn.tsx`

7. **MessageStream 升级**
   - 渲染 `MessageTurn[]` 而非平铺 `SessionMessage[]`
   - 保留 `forwardRef` 用于滚动控制

### Phase 3: Tool 调用链（信息聚合）

8. **Tool 调用卡片**
   - 聚合 `tool_use` 和对应的 `tool_result`
   - 匹配逻辑：按顺序配对，tool_result 通常紧跟 tool_use（通过索引或内容关联验证）
   - 展示结构：
     - 头部：工具名（wrench 图标）+ 折叠/展开按钮
     - 展开后：输入参数（JSON 树）+ 执行结果（JSON 树或文本）
   - 暗色模式兼容
   - 组件：`tool-call-card.tsx`

9. **AssistantMessage 升级**
   - 把 thinking、text、tool 链整合为统一的 assistant 展示
   - Thinking 默认折叠，text 默认展开，tool 链默认折叠

## Success Criteria

- [ ] Thinking 块完整展示（不再截断 500 字符），保留换行，可折叠，有滚动条
- [ ] JSON 面板替换为自研树形组件，支持折叠展开、键值颜色区分
- [ ] Compact 消息有 6 种类型颜色编码，hover 显示核心摘要
- [ ] 消息按轮次分组，user→assistant→tools 聚合在同一 turn 内，turn 间留白清晰
- [ ] Tool 调用链聚合 tool_use 和 tool_result 为一张可展开卡片
- [ ] `npm run build` 无错误，`npx tsc --noEmit` 无类型错误
- [ ] 现有功能正常：分页加载、worktree 切换、空状态、错误状态、JSON 按钮
- [ ] 暗色模式样式一致

## Open Questions

1. **轮次边界处理：** 若 session 以非 user 消息开头（如 system 或 assistant），是作为独立 turn 还是归入后续 user 的 turn？
2. **Thinking 默认状态：** 默认折叠还是展开？（考虑到"经常很长"，倾向默认折叠）
3. **Tool 匹配策略：** tool_result 是否总是紧跟对应 tool_use？如果中间穿插其他消息，如何配对？
4. **长 JSON 性能：** 单条消息的 raw JSON 可能很大（MB 级附件），JSON 树组件是否需要虚拟化或延迟展开？
