# Session First Prompt Preview - 实施计划

## 依赖图

```
types/claude.ts
    │
    ├──→ lib/claude-data.ts ──→ app/projects/[projectId]/page.tsx
    │                              (Server Component)
    │                                   │
    │                                   ↓
    └──→ components/session-sidebar.tsx ←── SessionBrowser
         (Client Component)
```

**关键数据流**：
```
page.tsx → getSessions() → readSessionMeta() → .jsonl 文件
                              ↓
                        SessionInfo[]
                              ↓
                        SessionBrowser → SessionSidebar
```

---

## 任务分解（垂直切片）

### Slice 1: 核心数据提取 + 类型定义 + 测试

**覆盖路径**：`.jsonl 文件 → readSessionPreview() → SessionInfo → 测试验证`

**涉及文件**：
- `types/claude.ts`
- `lib/claude-data.ts`
- `lib/claude-data.test.ts`

**任务步骤**：

1. **修改 `types/claude.ts`**
   - `SessionInfo` 增加 `firstPrompt: string | null`
   - **验收**：TypeScript 编译不报错

2. **实现 `readSessionPreview`**（替换 `readSessionMeta`）
   - 保持原有 `title` 和 `lineCount` 提取逻辑不变
   - 新增 `firstPrompt` 提取：
     - 逐行读取前 100 行（与 title 扫描范围一致，避免大文件性能问题）
     - 找到第一条 `type === 'user'` 的消息
     - 提取 `message.content`：
       - 字符串：直接使用
       - 数组：收集所有 `type === 'text'` 的 `text` 字段，空格拼接
     - 清理：换行符替换为空格，`trim()`
     - 截断：超过 200 字符截断加 `…`
     - 没找到则为 `null`
   - **验收**：
     - `readSessionPreview` 返回 `{ title, lineCount, firstPrompt }`
     - 原有 `title` 和 `lineCount` 逻辑不变

3. **更新 `getSessions`**
   - 调用 `readSessionPreview` 替代 `readSessionMeta`
   - `SessionInfo` 组装时增加 `firstPrompt: meta.firstPrompt`
   - **验收**：`getSessions` 返回的数组中每个元素都有 `firstPrompt` 字段

4. **补充单元测试**
   - 在 `lib/claude-data.test.ts` 中增加 `readSessionPreview` 测试：
     - 正常 user 消息（字符串 content）→ 正确提取
     - 数组 content（含 text/tool_use 混合）→ 只提取 text 块
     - 无 user 消息（全是系统消息）→ `firstPrompt` 为 `null`
     - 超长文本 → 截断到 200 字符
     - 空 content → `firstPrompt` 为 `null`
   - **验收**：`npm test` 或 `bun test` 全部通过

**验证命令**：
```bash
npx tsc --noEmit
bun test lib/claude-data.test.ts
```

---

### Slice 2: UI 渲染

**覆盖路径**：`SessionInfo[] → SessionSidebar → DOM 渲染`

**涉及文件**：
- `components/session-sidebar.tsx`

**任务步骤**：

1. **修改 `SessionSidebar` 组件**
   - 在 title `<p>` 和 metadata `<div>` 之间插入 preview 行：
     ```tsx
     {session.firstPrompt && (
       <p className="mt-0.5 truncate text-xs text-neutral-500">
         {session.firstPrompt}
       </p>
     )}
     ```
   - 保持现有 title、messageCount、lastModified、删除按钮逻辑完全不变
   - **验收**：
     - 有 `firstPrompt` 时显示灰色预览行
     - 无 `firstPrompt` 时不产生空行
     - 长文本自动截断显示 `…`

**验证方式**：
```bash
npm run dev
# 浏览器访问 http://localhost:3000/projects/<project-id>
# 确认 session 列表中每个条目显示 preview
```

---

## 检查点（Checkpoints）

| 检查点 | 验证内容 | 通过标准 |
|--------|----------|----------|
| CP-1 | Slice 1 完成后 | `tsc --noEmit` 无错误，单元测试全部通过 |
| CP-2 | Slice 2 完成后 | dev server 启动，session 列表 UI 正确显示 preview |
| CP-3 | 最终验证 | 无 `firstPrompt` 的 session 布局不塌陷；有 `firstPrompt` 的 session 三行布局清晰 |

---

## 风险与回滚

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `readSessionPreview` 性能下降 | session 列表加载变慢 | 只扫描前 100 行，与原有 title 扫描范围一致 |
| 某些 session 的 `message.content` 格式未知 | `firstPrompt` 提取错误 | 防御性编程：try/catch 包裹，异常时返回 `null` |
| UI 布局拥挤 | sidebar 条目过高 | preview 只用 `text-xs`，无 preview 时不占空间 |

**回滚策略**：
- Slice 1 可独立回滚：恢复 `readSessionMeta` 名称和返回类型，移除 `firstPrompt`
- Slice 2 可独立回滚：移除 SessionSidebar 中的 preview 行

---

## 实现顺序

1. **Slice 1**：类型 + 数据层 + 测试（不碰 UI）
2. **检查点 CP-1**：编译 + 测试通过
3. **Slice 2**：UI 渲染
4. **检查点 CP-2**：浏览器验证
