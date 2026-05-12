# Markdown 渲染功能设计

## 1. 目标

美化 assistant 消息的 UI，使用 Markdown 渲染提升可读性。

## 2. 需求范围

### 2.1 支持的 Markdown 特性

- **A**: 基础文本格式（粗体、斜体、链接、列表、引用）
- **B**: 代码块 + 语法高亮（使用 highlight.js）
- **C**: 表格（tables）

### 2.2 代码块

- 使用 `rehype-highlight` 进行语法高亮
- 不添加复制按钮（用户选择 B）

### 2.3 Thinking Block

- 不做美化，保持纯文本显示（用户选择 N）

### 2.4 安全

- 不添加 XSS 防护（用户选择不需要）

## 3. 技术方案

### 3.1 依赖

```bash
npm install react-markdown remark-gfm rehype-highlight
```

- `react-markdown`: React Markdown 渲染核心
- `remark-gfm`: GitHub Flavored Markdown 支持（表格、任务列表等）
- `rehype-highlight`: 代码块语法高亮（基于 highlight.js）

### 3.2 样式

使用 Tailwind CSS 兼容的 markdown 样式类名。

## 4. 修改文件

| 文件 | 修改内容 |
|------|---------|
| `components/message/assistant-message.tsx` | 使用 `<ReactMarkdown>` 替换纯文本渲染 |
| `app/globals.css` | 添加 markdown 样式（可选，如需自定义） |

## 5. 验收标准

1. Assistant 消息中的 Markdown 文本能正确渲染
2. 代码块有语法高亮效果
3. 表格能正确显示
4. 页面加载无报错
