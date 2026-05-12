# Markdown 渲染功能实施计划

## Context

当前 assistant 消息使用纯文本 `<p>` 标签渲染，用户希望使用 Markdown 渲染提升可读性。

## 需求范围

| 特性 | 状态 |
|------|------|
| A: 基础文本格式（粗体、斜体、链接、列表、引用） | ✅ |
| B: 代码块 + 语法高亮 | ✅ |
| C: 表格 | ✅ |
| D: 数学公式 | ❌ 不需要 |
| XSS 防护 | ❌ 不需要 |
| 复制按钮 | ❌ 不需要 |
| Thinking Block 美化 | ❌ 保持纯文本 |

## 依赖关系

```
package.json
    ↓
assistant-message.tsx
    ↓
globals.css (可选)
```

## 实施步骤

### Step 1: 安装依赖

```bash
npm install react-markdown remark-gfm rehype-highlight
```

**验证**: `package.json` 中出现新依赖

---

### Step 2: 重构 assistant-message.tsx

**文件**: `components/message/assistant-message.tsx`

**修改内容**:

1. 添加 import:
```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
```

2. 替换 textItems 渲染逻辑

---

### Step 3: 添加 CSS 样式（可选）

**文件**: `app/globals.css`

如需自定义 markdown 样式，可添加代码块背景色等。

**验证**: 代码块有语法高亮背景色

## 验收标准

1. **基础格式**: 粗体、斜体、链接、列表、引用能正确渲染
2. **代码块**: 有语法高亮，无复制按钮
3. **表格**: 能正确显示表格结构
4. **无报错**: 页面加载和控制台无错误

## 关键文件

| 文件 | 作用 |
|------|------|
| `components/message/assistant-message.tsx` | 主要修改文件 |
| `package.json` | 添加依赖 |
| `app/globals.css` | 可选：添加 markdown 样式 |

## 风险评估

- **低风险**: react-markdown 是成熟库，API 稳定
- **样式冲突**: prose 类名可能与现有样式冲突，已使用 `max-w-none` 避免宽度限制
