# Plan: 清理空 Session 与级联空 Worktree

## Spec 引用

`docs/ys-powers/specs/2026-05-04-cleanup-empty-sessions-design.md`

## 依赖图

```
lib/claude-data.ts  (新增 cleanupEmptySessions)
    ↓
app/api/projects/[projectId]/cleanup/route.ts  (POST handler)
    ↓
app/projects/[projectId]/page.tsx  (服务端数据获取)
    ↓
components/cleanup-dialog.tsx  (客户端弹窗)
    ↓
page.tsx 整合 (按钮状态 + API 调用 + 刷新)
```

## 垂直切片

按"可独立验证的完整功能路径"切片，而非按水平分层。

---

### Slice 1: 后端清理逻辑

**范围：** 数据层函数 + API endpoint。可独立测试，不依赖 UI。

**任务：**

- [ ] **Task 1.1:** `lib/claude-data.ts` 新增 `cleanupEmptySessions(projectId: string)`
  - 遍历 project 主目录下的 `.jsonl` 文件，删除 `messageCount === 0` 的
  - 遍历各 worktree 目录下的 `.jsonl` 文件，同样删除空的
  - 统计删除的 session 数
  - 检查哪些 worktree 因此 `sessionCount === 0`，删除这些 worktree 目录
  - 统计删除的 worktree 数
  - 返回 `{ deletedSessions, deletedWorktrees }`
  - 文件系统错误静默跳过，不阻断流程

- [ ] **Task 1.2:** `app/api/projects/[projectId]/cleanup/route.ts` 实现 POST handler
  - 调用 `cleanupEmptySessions`
  - 返回 JSON: `{ deletedSessions, deletedWorktrees }`
  - 错误时返回 500

**验证：**
- `curl -X POST http://localhost:3000/api/projects/<projectId>/cleanup` 返回正确计数
- 手动检查文件系统：空 session 被删、空 worktree 被删、非空资源保留

---

### Checkpoint 1

- [ ] API 单独测试通过（curl 或测试脚本）
- [ ] TypeScript `npx tsc --noEmit` 无错误
- [ ] `npm run build` 成功

---

### Slice 2: 前端交互

**范围：** 弹窗组件 + 页面集成。依赖 Slice 1 的 API。

**任务：**

- [ ] **Task 2.1:** `components/cleanup-dialog.tsx` 清理确认弹窗
  - 使用原生 `<dialog>` 元素（与 `project-delete-dialog.tsx` 风格一致）
  - Props: `isOpen`, `estimatedSessions`, `estimatedWorktrees`, `onConfirm`, `onCancel`
  - 展示警告图标 + 预估删除数量
  - 确认按钮红色，取消按钮灰色
  - 操作完成后展示结果（"已删除 X 个空会话，Y 个空 worktree"）

- [ ] **Task 2.2:** `app/projects/[projectId]/page.tsx` 集成清理功能
  - 在 project 信息卡片的合适位置添加"清理空会话"按钮
  - 按钮仅在存在空 session 时显示（根据当前 sessions/worktreeSessions 数据判断）
  - 点击打开弹窗，传递预估数量
  - 确认后 `fetch POST /api/projects/[projectId]/cleanup`
  - 成功后：关闭弹窗 → `router.refresh()` 刷新页面数据 → 展示结果 toast 或弹窗结果态

**验证：**
- 手动测试：创建空 session → 进入 project 页 → 点击清理 → 确认 → 验证文件被删、页面刷新
- 手动测试：worktree 变空后自动消失
- 手动测试：无非空 session 时按钮隐藏或禁用

---

### Checkpoint 2

- [ ] 端到端手动测试通过（创建→清理→验证）
- [ ] 构建成功 `npm run build`
- [ ] 无 console error / warning

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 文件系统并发操作失败 | 部分资源未清理 | 每个文件/目录独立 try-catch，返回实际成功计数 |
| 用户误删 | 数据丢失 | 必须确认弹窗；只删空 session |
| 级联删除 worktree 逻辑错误 | 误删非空 worktree | 删除 session 后重新统计目录内文件数，严格 `=== 0` 才删 |

## 任务顺序

1. Task 1.1 → Task 1.2 → **Checkpoint 1** → Task 2.1 → Task 2.2 → **Checkpoint 2**
