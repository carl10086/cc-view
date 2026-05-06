# Session Custom Title and Preview UI - Design Spec

## 1. Objective（目标）

在 cc-view 的 session 列表中支持 **Claude Code `/rename` 命令设置的自定义标题**（`custom-title`），并优化无自定义标题时的 preview 视觉突出度，提升 session 识别效率。

### Success Criteria（验收标准）

- [ ] `readSessionPreview` 正确解析 session 文件中的 `type: "custom-title"` 条目
- [ ] `custom-title` 优先级高于 `ai-title`，作为 `SessionInfo.title` 的值
- [ ] Sidebar 中：有 `custom-title` 时只显示标题，不显示 `firstPrompt`
- [ ] Sidebar 中：无 `custom-title` 时 `firstPrompt` 颜色加深（`text-neutral-700`），位置调整至 title 上方
- [ ] Header 区域：无 `custom-title` 时 `firstPrompt` 颜色加深，边框同步调整
- [ ] 数据层改动不破坏现有 API 和行为
- [ ] 测试覆盖 `custom-title` 解析逻辑

---

## 2. Commands / API Changes（命令与接口变更）

无新命令或 API 端点。仅修改现有数据层函数和 React 组件。

### 2.1 数据层：`lib/claude-data.ts`

**`readSessionPreview`**

- 在扫描 session 文件前 100 行时，增加对 `type === "custom-title"` 的检测
- `customTitle` 优先级高于 `aiTitle`：
  ```typescript
  if (obj.type === "custom-title" && obj.customTitle) {
    title = obj.customTitle  // 直接覆盖，优先级最高
  } else if (!title && obj.type === "ai-title" && obj.aiTitle) {
    title = obj.aiTitle
  }
  ```
- 返回结构不变：`{ title: string | null, lineCount: number, firstPrompt: string | null }`

---

## 3. Project Structure（项目结构）

### 修改文件

| 文件 | 改动说明 |
|------|---------|
| `lib/claude-data.ts` | `readSessionPreview` 增加 `custom-title` 解析逻辑 |
| `components/session-sidebar.tsx` | 条件渲染：有 custom-title 时隐藏 firstPrompt；无 custom-title 时加深颜色并调整位置 |
| `components/session-browser.tsx` | Header 区域 preview 颜色加深 |
| `lib/claude-data.test.ts` | 添加 `custom-title` 解析测试 |

---

## 4. Code Style（代码风格）

- 遵循现有 Tailwind CSS 类名模式
- 颜色使用 `text-neutral-*` 体系，不使用自定义色值
- 条件渲染使用 `&&` 短路运算，保持与现有代码一致
- TypeScript 类型严格，不引入 `any`

---

## 5. Testing Strategy（测试策略）

### 5.1 单元测试：`lib/claude-data.test.ts`

新增测试用例：

```typescript
describe("readSessionPreview custom-title", () => {
  it("prioritizes custom-title over ai-title", async () => {
    // custom-title 在 ai-title 之后出现，应覆盖前者
  })

  it("falls back to ai-title when no custom-title", async () => {
    // 只有 ai-title，title 应为其值
  })

  it("hides firstPrompt when custom-title exists", async () => {
    // 验证 UI 逻辑：有 custom-title 时不渲染 preview
  })
})
```

### 5.2 回归测试

- 运行 `npx vitest run` 确保现有测试全部通过
- 运行 `npm run build` 确保 TypeScript 编译无错误

---

## 6. Boundaries（边界与约束）

### Always Do（必须做）
- 优先读取 `custom-title`，其次 `ai-title`
- 加深无 custom-title 时的 preview 视觉权重
- 保持现有功能不受影响

### Ask First（需询问）
- 是否需要在 Header 区域添加 session 标题显示（而不仅是 preview）
- preview 字号是否需要从 `text-xs` 调整为 `text-sm`

### Never Do（禁止做）
- 修改 session 文件内容（只读）
- 引入新的依赖库
- 改变 `SessionInfo` 类型结构（不添加新字段）
