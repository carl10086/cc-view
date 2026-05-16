# Message Types 文档页面 — 实现计划

## 依赖关系图

```
Slice 1: 主要消息类型卡片  ──┐
                              ├──→ Slice 4: 页面框架 + 导航 + 响应式
Slice 2: System 子类型表格  ──┤      （集成所有组件到 /docs/message-types）
                              │
Slice 3: Attachment 分类     ──┘
```

- **Slice 1-3 可并行**：各自独立的组件，无交叉依赖
- **Slice 4 依赖 1-3**：页面集成需要所有子组件就绪

---

## 任务清单

### Slice 1: 主要消息类型卡片区域

**目标**：实现 10 种 `filterType` 的可交互说明卡片，并在页面中渲染。

**文件变更**：
- `components/docs/message-type-card.tsx` — 单卡片组件
- `app/docs/message-types/page.tsx` — 集成主要类型区域

**组件设计**：
```typescript
interface MessageTypeCardProps {
  filterType: string
  label: string
  color: string        // Tailwind text class
  bgColor: string      // Tailwind bg class
  description: string
  exampleJson?: object // 可选：典型 JSON 结构
}
```

**验收标准**：
- [ ] 渲染 10 张卡片：user, assistant, system, attachment, last-prompt, permission-mode, file-history-snapshot, user-turn, queue-operation, ai-title
- [ ] 每张卡片展示 Label Badge（颜色与 `typeConfig` 一致）
- [ ] 每张卡片展示类型名称和详细说明
- [ ] 卡片 hover 效果：轻微上浮（`-translate-y-1`）+ 阴影加深
- [ ] JSON 示例默认可折叠，点击展开/收起
- [ ] 暗色/亮色主题自适应

**验证步骤**：
1. `npm run dev` 启动服务
2. 访问 `/docs/message-types`
3. 检查 10 张卡片是否全部渲染
4. 检查颜色是否与 `typeConfig` 一致
5. 测试卡片 hover 效果
6. 测试 JSON 折叠/展开
7. 切换系统暗色/亮色模式验证颜色

---

### Slice 2: System Message 子类型表格

**目标**：以表格形式展示 14 种 System Message 子类型及其说明。

**文件变更**：
- `components/docs/system-subtype-table.tsx` — 表格组件
- `app/docs/message-types/page.tsx` — 集成 System 区域

**组件设计**：
```typescript
interface SystemSubtype {
  subtype: string
  description: string
  example?: string
}

interface SystemSubtypeTableProps {
  subtypes: SystemSubtype[]
}
```

**验收标准**：
- [ ] 表格渲染 14 行，每行一个 subtype
- [ ] 列：Subtype 名称、说明、示例（可选）
- [ ] 表格行 hover 背景色变化（`hover:bg-muted/50`）
- [ ] 暗色/亮色主题自适应

**验证步骤**：
1. 访问 `/docs/message-types`
2. 向下滚动到 "System Message 子类型" 区域
3. 检查 14 行数据是否完整
4. 测试表格行 hover 效果
5. 切换主题验证颜色

---

### Slice 3: Attachment 子类型分类

**目标**：按 Hook/Skill/Agent 三个分类展示 Attachment 子类型。

**文件变更**：
- `components/docs/attachment-type-table.tsx` — 分类表格组件
- `app/docs/message-types/page.tsx` — 集成 Attachment 区域

**组件设计**：
```typescript
interface AttachmentCategory {
  name: string          // "Hook 相关", "Skill 相关", "Agent 相关"
  subtypes: {
    type: string
    description: string
  }[]
}

interface AttachmentTypeTableProps {
  categories: AttachmentCategory[]
}
```

**验收标准**：
- [ ] 三个分类区块依次渲染：Hook（9 种）、Skill（2 种）、Agent（2 种）
- [ ] 每个分类有独立标题和表格
- [ ] 表格设计与 System 子类型一致
- [ ] 暗色/亮色主题自适应

**验证步骤**：
1. 访问 `/docs/message-types`
2. 向下滚动到 "Attachment 子类型" 区域
3. 检查三个分类区块是否完整
4. 检查 Hook 分类 9 行、Skill 2 行、Agent 2 行
5. 切换主题验证颜色

---

### Slice 4: 页面框架、导航与响应式

**目标**：整合所有组件到完整页面，添加锚点导航和响应式支持。

**文件变更**：
- `app/docs/message-types/page.tsx` — 完整页面（集成 Slice 1-3）
- `app/docs/layout.tsx` — 文档布局（可选，如有需要）

**页面结构**：
```
/docs/message-types
├── 页面标题 + 简介
├── 锚点导航（右侧固定或顶部）
├── Slice 1: 主要消息类型（卡片网格）
├── Slice 2: System Message 子类型（表格）
├── Slice 3: Attachment 子类型（分类表格）
└── 返回顶部按钮
```

**验收标准**：
- [ ] 页面路由 `/docs/message-types` 可访问
- [ ] 页面标题："Message Types 文档"
- [ ] 右侧锚点导航：点击平滑滚动到对应章节
- [ ] 移动端：锚点导航变为顶部横向滚动或汉堡菜单
- [ ] 卡片网格响应式：桌面 3-4 列、平板 2 列、手机 1 列
- [ ] 表格横向滚动（避免移动端溢出）
- [ ] 暗色/亮色主题全局一致

**验证步骤**：
1. 访问 `/docs/message-types`
2. 点击右侧导航各锚点，验证平滑滚动
3. 浏览器窗口缩放到 375px 宽度，检查移动端布局
4. 检查卡片网格列数变化
5. 检查表格横向滚动
6. 切换系统暗色/亮色模式
7. `npm run build` 无报错

---

## Checkpoint 检查点

| 阶段 | 检查内容 | 通过标准 |
|------|---------|---------|
| **CP-1** | Slice 1-3 完成 | 三个独立组件均可单独渲染，单元测试通过（如有） |
| **CP-2** | Slice 4 集成完成 | `/docs/message-types` 页面完整访问，所有内容渲染正常 |
| **CP-3** | 验收测试 | 所有 7 条 Acceptance Criteria 勾选完成 |

---

## 风险与注意事项

1. **shadcn/ui 组件缺失**：当前仅有 `badge`, `card`, `skeleton`。Table 组件缺失时需要手动实现或使用原生 HTML table + Tailwind。
2. **颜色一致性**：必须与 `compact-message.tsx` 中的 `typeConfig` 完全同步，建议复用该配置对象。
3. **路由冲突**：`app/docs/` 目录下已有其他内容时需确认无冲突（当前为空）。

---

## 任务执行顺序

```
Phase 1: 并行开发独立组件
  ├── Task 1: Slice 1 — 主要消息类型卡片
  ├── Task 2: Slice 2 — System 子类型表格
  └── Task 3: Slice 3 — Attachment 分类

Phase 2: 集成与优化
  └── Task 4: Slice 4 — 页面框架 + 导航 + 响应式

Phase 3: 验收
  └── Task 5: 验证所有 Acceptance Criteria
```
