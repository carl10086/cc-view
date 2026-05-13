# Spec: 在 Messages 页面添加复制 Session ID 按钮

## Objective

在 Messages（Session Browser）页面中，为用户提供一键复制当前选中 session 的 `--resume {session_id}` 命令的功能，便于快速在终端中恢复指定 session。

**用户故事：**
- 作为 cc-view 用户，我在浏览历史 session 消息时，想要快速获取 `--resume` 命令，以便在 Claude Code 终端中恢复该 session 继续工作。

**成功标准：**
- [ ] 选中任意 session 后，页面 header 区域固定显示该 session 的 ID 和复制按钮
- [ ] 点击复制按钮后，剪贴板内容为 `--resume {session_id}` 格式
- [ ] 复制成功后，按钮图标在 1 秒内从复制图标变为 ✓ 图标，然后自动恢复
- [ ] 不引入新的外部依赖
- [ ] 不影响现有布局和交互

## Tech Stack

- Next.js 16 + React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui (现有组件: `Card`, `Badge`, `Button` 等)
- Lucide React (图标库)

## Commands

```bash
# 开发
npm run dev

# 构建
npm run build

# 类型检查
npm run type-check

# 测试
npm test
```

## Project Structure

```
app/
  projects/
    [projectId]/
      page.tsx           → 项目详情页（现有，不修改）
components/
  session-browser.tsx    → 核心修改文件：在 header 中添加复制按钮
  ui/                    → shadcn/ui 组件目录
lib/
  utils.ts               → 工具函数（cn 等）
types/
  claude.ts              → SessionInfo 类型定义（现有，不修改）
docs/ys-powers/specs/    → 本文档所在目录
```

## Code Style

**组件风格：** 使用函数组件 + Hooks，类型显式声明 Props 接口。

```tsx
// 示例：复制按钮组件
"use client"

import { useState, useCallback } from "react"
import { Copy, Check } from "lucide-react"

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    } catch {
      // 静默失败，不打扰用户
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      title="复制 --resume 命令"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "已复制" : "复制"}
    </button>
  )
}
```

**关键约定：**
- 客户端组件顶部标注 `"use client"`
- 使用 `useCallback` 包裹事件处理函数（如果作为 prop 传递）
- 图标使用 `lucide-react`
- Tailwind 类按布局 → 外观 → 交互 → 状态顺序组织
- 颜色使用 `neutral` 色系保持一致性

## Testing Strategy

**框架：** Vitest + React Testing Library（项目现有）

**测试范围：**
- 单元测试：`CopyButton` 组件的渲染和交互
  - 点击后调用 `navigator.clipboard.writeText` 并传入正确文本
  - 点击后图标变为 Check，1 秒后恢复为 Copy
  - 使用 `vi.useFakeTimers()` 控制定时器

**测试位置：** 与组件同级或 `__tests__/` 目录（遵循项目现有惯例）

**覆盖率期望：** 新增代码行覆盖率达到 100%

## Boundaries

**Always do:**
- 保持现有代码风格和命名约定
- 在修改前确认目标文件当前状态（避免基于过时代码修改）
- 修改后手动在浏览器中验证 UI 效果
- 确保 TypeScript 类型检查通过

**Ask first:**
- 修改现有 API 路由或数据结构
- 添加新的 npm 依赖
- 修改全局样式或主题配置

**Never do:**
- 修改与需求无关的代码（如 sidebar、message stream、API 路由等）
- 删除或重命名现有组件/函数
- 提交未测试的代码
- 引入大型 UI 库（如 Radix UI 新组件、Toast 库等）仅为此小功能

## Success Criteria

1. **功能正确性**
   - 选中 session 后，header 区域显示 `Session: {id}` 和复制按钮
   - 复制内容为 `--resume {session_id}`（id 前后无多余空格）
   - 复制失败时不抛出未处理异常

2. **交互体验**
   - 按钮始终可见（不依赖 hover）
   - 点击后 1 秒内显示成功状态（✓ 图标），然后自动恢复
   - 视觉风格与现有 UI 一致（neutral 色系、圆角、字号）

3. **代码质量**
   - TypeScript 无类型错误
   - 通过现有 lint 规则
   - 新增代码有对应的单元测试

## Open Questions

- [x] ~~按钮位置~~ → 确定在右侧消息区域 header 中
- [x] ~~复制反馈方式~~ → 确定使用图标瞬时变化（✓ → 恢复）
- [x] ~~工作空间策略~~ → 确定使用 feature branch `feat/copy-session-id`
