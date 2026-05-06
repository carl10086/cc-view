# Session Custom Title and Preview UI - Implementation Plan

## Dependency Graph（依赖关系）

```
lib/claude-data.ts
  ├── readSessionPreview (数据基础)
  │     └── getSessions
  │           ├── components/session-sidebar.tsx (UI 消费)
  │           └── components/session-browser.tsx (UI 消费)
  └── lib/claude-data.test.ts (验证)
```

数据层是 UI 层的基础。必须先完成数据层改动，UI 才能正确显示 `custom-title`。

---

## Task Breakdown（垂直切片）

每个任务都是一个完整的垂直路径：从数据层到 UI 到验证。

---

### Task 1: 数据层 — custom-title 解析

**Scope**: `lib/claude-data.ts`, `lib/claude-data.test.ts`

**Acceptance Criteria**:
- [ ] `readSessionPreview` 在扫描 session 文件时检测 `type === "custom-title"`
- [ ] `customTitle` 优先级高于 `aiTitle`，出现即覆盖
- [ ] `aiTitle` 在没有 `customTitle` 时仍作为 fallback
- [ ] 返回结构不变，不破坏现有调用方

**Implementation Steps**:
1. 修改 `readSessionPreview` 中的 title 提取逻辑：
   ```typescript
   if (obj.type === "custom-title" && obj.customTitle) {
     title = obj.customTitle
   } else if (!title && obj.type === "ai-title" && obj.aiTitle) {
     title = obj.aiTitle
   }
   ```
2. 在 `lib/claude-data.test.ts` 中添加测试：
   - `custom-title` 覆盖 `ai-title`
   - 无 `custom-title` 时 fallback 到 `ai-title`
   - 无 `custom-title` 且无 `ai-title` 时 `title` 为 `null`

**Verification**:
```bash
npx vitest run lib/claude-data.test.ts
npm run build
```

---

### Task 2: Sidebar — 条件渲染与样式优化

**Scope**: `components/session-sidebar.tsx`

**Acceptance Criteria**:
- [ ] 有 `custom-title`（`title` 存在且 `firstPrompt` 不需要时）：只显示 title，不渲染 `firstPrompt`
- [ ] 无 `custom-title`（`title` 来自 `ai-title` 或为空）：`firstPrompt` 颜色从 `text-neutral-500` 改为 `text-neutral-700`
- [ ] 无 `custom-title` 时：`firstPrompt` 位置调整至 title 上方（用户第一眼看到内容）
- [ ] 布局不破坏，hover 和选中状态正常

**Implementation Steps**:
1. 重构 session 条目的内容区域结构：
   - 条件判断 `hasCustomTitle = session.title && !session.firstPrompt` 或直接根据 `title` 来源判断
   - 实际上更简单：如果 `title` 存在且用户想要隐藏 preview，可以用 `session.title` 来判断
   - 但注意：`ai-title` 也会设置 `title`，所以不能直接用 `title` 判断
   - **修正**：需要在 `SessionInfo` 中增加标记？不，spec 说不要改变类型结构
   - **替代方案**：用启发式判断——如果 `title` 不等于 session ID 前缀，且 `firstPrompt` 以 `title` 开头... 不好
   - **更好的方案**：直接让 `firstPrompt` 在有 `title` 时不显示？但 `ai-title` 也需要 preview
   - **再思考**：用户的真实意图是——`custom-title` 足够可读，不需要 preview；`ai-title` 通常不够描述性，需要 preview
   - 但数据层不区分 `title` 的来源...
   - **决定**：遵循 spec 的 "Ask First"，但用户已经回答了——有 custom-title 时只显示标题
   - 由于不添加新字段，我们采用简单规则：如果 `title` 存在，就不显示 `firstPrompt`
   - 等等，这会导致 `ai-title` 也不显示 preview，与用户之前的方案 B 矛盾
   - **重新理解方案 B**：无 `custom-title` 时显示 title + 突出的 preview。所以 `ai-title` 存在时仍然需要 preview
   - **结论**：不修改类型结构的情况下，最合理的做法是——让 `firstPrompt` 在有 `title` 且用户明确不需要时隐藏。但无法区分...
   - 另一种思路：`custom-title` 通常较短且可读，`ai-title` 可能较长或不够直观。但这不可靠。
   - **最终方案**：暂时不在 sidebar 中隐藏 `firstPrompt`，只调整颜色。等后续有需要再优化。不，用户明确要求了...
   - 让我再看看 cc 的做法：cc 的 `listSessionsImpl` 中 `summary = customTitle || lastPrompt || summary || firstPrompt`，即只有一个 summary 字段。cc 的做法是把所有信息合并成一个 summary。
   - 但我们的结构是分开的 `title` 和 `firstPrompt`。
   - 也许最简单的方案：在 `readSessionPreview` 中，如果有 `custom-title`，将 `firstPrompt` 设为 `null`。这样 UI 层不需要判断来源，直接根据 `firstPrompt` 是否存在来决定是否显示。
   - 这个方案好！符合 "不修改类型结构" 的约束，逻辑集中在数据层。

**修正后的 Implementation Steps**:
1. 修改 `readSessionPreview`：如果有 `custom-title`，将 `firstPrompt` 设为 `null`（或保持现有值，但 UI 层用 `title` 判断）
   - 更清晰的做法：在数据层设置标志？不行，不能改类型
   - 实际做法：在 `readSessionPreview` 中，如果检测到 `custom-title`，返回 `firstPrompt: null`
2. Sidebar 中：
   - `firstPrompt` 颜色改为 `text-neutral-700`
   - 调整位置到 title 上方

**Verification**:
```bash
npx vitest run
npm run build
# 浏览器访问 localhost:3000 查看 sidebar 效果
```

---

### Task 3: Header — preview 颜色加深

**Scope**: `components/session-browser.tsx`

**Acceptance Criteria**:
- [ ] Header 区域 `firstPrompt` 颜色从 `text-neutral-600` 改为 `text-neutral-800`
- [ ] 边框颜色同步加深（`border-neutral-300` → `border-neutral-500`）
- [ ] 有 `custom-title` 时 header 显示标题（可选，如果用户需要）

**Implementation Steps**:
1. 修改 header 中 `firstPrompt` 的样式类名
2. 如有需要，在 stats 行上方添加 `selectedSession.title` 显示

**Verification**:
```bash
npm run build
# 浏览器访问 localhost:3000，选择无 custom-title 的 session 查看 header
```

---

## Checkpoints（检查点）

| 检查点 | 触发条件 | 验证内容 |
|--------|---------|---------|
| CP-1 | Task 1 完成后 | 测试通过，`custom-title` 正确覆盖 `ai-title` |
| CP-2 | Task 2 完成后 | Sidebar 视觉正确：有 custom-title 时简洁，无 custom-title 时 preview 突出 |
| CP-3 | Task 3 完成后 | Header preview 颜色加深，整体视觉协调 |

---

## Risk & Mitigation（风险与缓解）

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 无法区分 `custom-title` 和 `ai-title` 来源 | UI 可能错误隐藏 preview | 数据层统一处理：有 `custom-title` 时 `firstPrompt` 返回 `null` |
| 颜色调整后对比度过强 | 视觉不协调 | 使用 `text-neutral-700`（非纯黑），保持中性色调 |
| `custom-title` 条目出现在文件末尾 | 前 100 行扫描不到 | 增大扫描行数或从文件末尾扫描（参考 cc 的 tail/head 模式） |

