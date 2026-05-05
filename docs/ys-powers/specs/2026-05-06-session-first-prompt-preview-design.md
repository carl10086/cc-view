# Session First Prompt Preview - Design Spec

## 1. Objective（目标）

在 cc-view 的 session 列表中增加可读性，让每个 session 条目显示**第一条有意义的用户消息预览**（first prompt preview），使用户无需点击即可快速识别 session 内容。

**参考来源**：Claude Code `/resume` 命令的实现逻辑。

### Success Criteria（验收标准）

- [ ] `SessionSidebar` 每个 session 条目在 title 下方显示一行 `firstPrompt` 预览（灰色小字，最多 60 字符，超出截断加 `…`）
- [ ] 预览内容取自 session 文件中第一条 `type === 'user'` 且非 meta 的消息的文本内容
- [ ] 处理多种内容格式：字符串、`content` 数组中的 `text` 块
- [ ] 跳过系统消息（`permission-mode`、`file-history-snapshot` 等）
- [ ] 无预览时不显示空行，保持现有布局不变
- [ ] 数据层改动不破坏现有 API 和行为

---

## 2. Commands / API Changes（命令与接口变更）

### 2.1 数据层：`lib/claude-data.ts`

**`readSessionMeta` → `readSessionPreview`**

- 重命名为 `readSessionPreview`，返回 `{ title, lineCount, firstPrompt }`
- `firstPrompt` 提取逻辑（参考 cc `getFirstMeaningfulUserMessageTextContent`）：
  1. 逐行读取 session 文件（`.jsonl`）
  2. 跳过 `type !== 'user'` 的消息
  3. 跳过 `isMeta === true` 的消息（如果存在该字段）
  4. 提取 `message.content`：
     - 字符串类型：直接使用
     - 数组类型：遍历所有 `type === 'text'` 的块，拼接 `text` 字段
  5. 清理文本：将换行符替换为空格，`trim()`
  6. 截断：最多保留 200 字符（存储时截断，UI 再按宽度截断）
  7. 如果没找到有意义的用户消息，`firstPrompt` 为 `null`

**`getSessions`**

- 调用 `readSessionPreview` 替代 `readSessionMeta`
- `SessionInfo` 增加 `firstPrompt: string | null`

### 2.2 类型定义：`types/claude.ts`

```typescript
export interface SessionInfo {
  id: string
  title: string | null
  firstPrompt: string | null  // ← 新增
  messageCount: number
  lastModified: Date
}
```

### 2.3 UI 层：`components/session-sidebar.tsx`

**采用方案 B：title 下方增加 preview 行**

布局层次（从上到下）：
```
┌──────────────────────────────────────────┐
│ [icon]  {title}                          │
│         {firstPrompt}          ← 新增    │
│         {count} · {time}                 │
└──────────────────────────────────────────┘
```

**具体改动（line 88-100 区域）**：

将现有的：
```tsx
<div className="min-w-0 flex-1">
  <p className="truncate text-sm font-medium ...">
    {session.title ?? session.id.slice(0, 8)}
  </p>
  <div className="mt-1 flex items-center gap-2 text-xs ...">
    <span>{session.messageCount} messages</span>
    ...
  </div>
</div>
```

改为：
```tsx
<div className="min-w-0 flex-1">
  <p className="truncate text-sm font-medium ...">
    {session.title ?? session.id.slice(0, 8)}
  </p>
  {session.firstPrompt && (
    <p className="mt-0.5 truncate text-xs text-neutral-500">
      {session.firstPrompt}
    </p>
  )}
  <div className={`flex items-center gap-2 text-xs ... ${session.firstPrompt ? 'mt-1' : 'mt-1'}`}>
    <span>{session.messageCount} messages</span>
    ...
  </div>
</div>
```

**样式规范**：
| 属性 | 值 | 说明 |
|------|-----|------|
| 字体大小 | `text-xs` | 与 metadata 同级，比 title 小一级 |
| 颜色 | `text-neutral-500` | 与 metadata 一致，灰色次要信息 |
| 上边距 | `mt-0.5` | 与 title 间距 2px，紧凑 |
| 溢出 | `truncate` | 超出容器时显示 `…` |
| 条件渲染 | `session.firstPrompt &&` | 无 preview 时不渲染，避免空行 |

**交互不变**：
- 点击区域仍为整个按钮
- 删除按钮的显示/隐藏逻辑不变
- hover 效果不变

---

## 3. Project Structure（项目结构变更）

```
lib/claude-data.ts          # readSessionMeta → readSessionPreview, firstPrompt 提取逻辑
types/claude.ts             # SessionInfo 增加 firstPrompt 字段
components/session-sidebar.tsx  # 增加 firstPrompt 预览显示
```

无新增文件，无目录结构变更。

---

## 4. Code Style（代码风格）

- 遵循现有代码风格：单引号、无分号、函数声明用 `function` 关键字
- 类型定义保持与现有 `SessionInfo` 一致的命名规范
- UI 样式使用现有 Tailwind 类，不引入新颜色或字体大小
- 保持 `readSessionPreview` 的防御性：try/catch 包裹 JSON.parse，无效行跳过

---

## 5. Testing Strategy（测试策略）

### 5.1 单元测试：`lib/claude-data.test.ts`

增加 `readSessionPreview` 的测试用例：

- **正常情况**：session 文件包含 user 消息，正确提取 firstPrompt
- **多种 content 格式**：
  - `message.content` 为字符串
  - `message.content` 为数组（含 text 块、tool_use 块等）
  - 混合数组（只提取 text 块的 text）
- **边界情况**：
  - 无 user 消息（全是系统消息）→ `firstPrompt` 为 `null`
  - user 消息 content 为空字符串 → `firstPrompt` 为 `null`
  - 超长文本 → 截断到 200 字符

### 5.2 集成测试：`components/session-sidebar.test.tsx`（如存在）

验证：
- 有 `firstPrompt` 时正确渲染预览行
- 无 `firstPrompt` 时不渲染空行
- 长文本正确截断显示

---

## 6. Boundaries（边界与约束）

### Always Do（必须做的）
- 保持现有 `SessionInfo` 的其他字段不变
- 保持 `getSessions` 的排序和过滤逻辑不变
- 保持 `SessionSidebar` 的交互（点击、删除）不变
- 防御性处理：session 文件格式异常时不崩溃

### Ask First（需先询问的）
- 是否需要在 project 列表中也显示类似的预览（当前仅针对 session 列表）
- 是否需要显示最后一条消息的预览（与 firstPrompt 并存）
- preview 字符数限制是否需要可配置

### Never Do（禁止做的）
- 不修改 `SessionMessage` 类型（与消息详情页无关）
- 不修改 API 路由的接口契约（`/api/projects/:id/sessions/:sessionId` 的返回格式不变）
- 不在 `readSessionPreview` 中读取整个文件（保持流式逐行读取，性能不变）
- 不引入新的依赖库

---

## 7. Implementation Plan（实现顺序）

1. **修改 `types/claude.ts`** — 增加 `firstPrompt` 字段
2. **修改 `lib/claude-data.ts`** — 实现 `readSessionPreview`，更新 `getSessions`
3. **修改 `components/session-sidebar.tsx`** — 增加预览显示
4. **补充测试** — `claude-data.test.ts` 中增加 `readSessionPreview` 测试
5. **验证** — 启动 dev server，确认 session 列表正确显示预览
