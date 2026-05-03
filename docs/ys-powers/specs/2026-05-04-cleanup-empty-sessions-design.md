# Spec: 清理空 Session 与级联空 Worktree

## Objective

在项目详情页提供一键清理功能，删除当前 project 主目录及各 worktree 下所有空 session（`messageCount === 0`），并级联删除因此变为空的 worktree。

**用户故事：**
- 作为用户，我浏览 project 详情页时，发现大量空 session 占用列表空间
- 我点击"清理空会话"按钮，确认后系统批量删除空 session
- 如果某个 worktree 因此变为空（无 session），该 worktree 目录也被自动删除
- 操作完成后，我看到删除统计（X 个 session，Y 个 worktree），页面数据自动刷新

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- 原生 `<dialog>` 元素（与现有 `project-delete-dialog.tsx` 风格一致）
- Node.js `fs.promises` 文件系统操作

## Commands

```bash
# 开发
npm run dev

# 构建
npm run build

# 测试
npm test

# TypeScript 检查
npx tsc --noEmit
```

## Project Structure

```
app/api/projects/[projectId]/cleanup/route.ts    → 清理 API endpoint（新增）
app/projects/[projectId]/page.tsx                → 项目详情页（修改：添加按钮和弹窗）
lib/claude-data.ts                               → 数据层（修改：新增 cleanupEmptySessions 函数）
components/cleanup-dialog.tsx                    → 清理确认弹窗组件（新增）
```

## Code Style

**API Response 格式：**
```ts
interface CleanupResult {
  deletedSessions: number   // 实际删除的空 session 数
  deletedWorktrees: number  // 级联删除的空 worktree 数
}
```

**错误处理：** 文件系统错误静默处理（跳过不可读文件），不阻断整体流程。最终返回实际成功删除的计数。

**UI 风格：** 沿用 project-delete-dialog 的原生 `<dialog>` 模式，黄色警告图标，红色确认按钮。

## Testing Strategy

- **API 测试**：使用内存 mock fs 测试 cleanup endpoint（隔离测试，不触碰真实文件系统）
- **组件测试**：`cleanup-dialog.tsx` 的打开/关闭/确认回调测试
- **集成测试**：手动验证 — 创建空 session 文件 → 点击清理 → 验证文件被删、worktree 级联删除

## Boundaries

- **Always：**
  - 操作前必须弹出确认对话框
  - 返回精确的删除计数给用户
  - 页面数据在操作后自动刷新
  - 只删除当前 project 下的资源

- **Ask first：**
  - 引入新的 npm 依赖
  - 修改 API URL 设计
  - 更改"空 session"的定义标准

- **Never：**
  - 删除非空 session（`messageCount > 0`）
  - 删除尚有 session 的 worktree
  - 跨 project 删除资源
  - 跳过确认直接执行删除

## Success Criteria

- [ ] Project 详情页出现"清理空会话"按钮（当存在空 session 时显示，否则隐藏或禁用）
- [ ] 点击按钮弹出确认对话框，展示将要删除的资源预估数量
- [ ] 确认后调用 `POST /api/projects/[projectId]/cleanup`
- [ ] API 正确删除所有 `messageCount === 0` 的 session 文件
- [ ] API 正确级联删除因此 `sessionCount === 0` 的 worktree 目录
- [ ] 对话框展示操作结果（"已删除 X 个空会话，Y 个空 worktree"）
- [ ] 页面 session 列表和 worktree 列表自动刷新
- [ ] 无可删除资源时按钮禁用或隐藏
- [ ] 所有测试通过，TypeScript 无错误，构建成功

## Open Questions

1. 是否需要在 project 列表页（`/projects`）也显示空 session/worktree 数量提示？→ 本次不做，保持详情页单一入口
2. 级联删除 worktree 是否需要在确认弹窗中单独列出？→ 建议展示预估数量时合并说明（"将删除 X 个空会话，可能级联清理 Y 个空 worktree"）
