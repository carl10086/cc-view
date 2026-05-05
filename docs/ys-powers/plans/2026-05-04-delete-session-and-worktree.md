# 删除 Session 与 Worktree — 实现计划

## 1. 概述

基于 Spec `docs/ys-powers/specs/2026-05-04-delete-session-and-worktree-design.md`，将工作拆分为 **4 个垂直切片**（端到端完整路径），每个切片可独立开发、测试和验证。

---

## 2. 依赖图

### 2.1 Session 删除调用链

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UI Layer                                                               │
│  SessionSidebar ──► SessionDeleteDialog ──► SessionBrowser (fetch)     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  API Layer                                                              │
│  DELETE /api/projects/[projectId]/sessions/[sessionId]/route.ts        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Data Layer                                                             │
│  lib/claude-data.ts ──► deleteSession() / isSessionActive()            │
│                              │                                          │
│                              ▼                                          │
│                       fs.unlink(filePath)                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Worktree 删除调用链

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UI Layer                                                               │
│  SessionSidebar ──► WorktreeDeleteDialog ──► SessionBrowser (fetch)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  API Layer                                                              │
│  DELETE /api/projects/[projectId]/worktrees/[worktreeName]/route.ts    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Data Layer                                                             │
│  lib/worktree.ts ──► deleteWorktree()                                  │
│                              │                                          │
│                              ▼                                          │
│                       fs.rm(path, { recursive: true })                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 共享依赖

- `lib/claude-data.ts` 中的 `isValidProjectId`、`isValidSessionId`、`validateProjectPath`
- `lib/worktree.ts` 中的 `buildWorktreeProjectId`、`WORKTREE_MARKER`
- `ProjectDeleteDialog` 的视觉模式（红色警示图标、Cancel/Delete 按钮布局）
- `components/ui/card.tsx` 等 shadcn/ui 组件

---

## 3. 垂直切片任务

### 🔲 Slice 1: Session 删除端到端

**目标**：用户可以在 SessionSidebar 中选中一个 session，点击删除按钮，确认后永久删除该 `.jsonl` 文件；若 session 近期活跃则禁止删除。

#### Task 1.1 — 数据层：`deleteSession` + `isSessionActive`

**文件**：`lib/claude-data.ts`

**内容**：
- 新增 `isSessionActive(filePath: string, thresholdMs?: number): Promise<boolean>`
  - 读取文件 `mtime`
  - 若 `Date.now() - mtime.getTime() < thresholdMs`（默认 5 分钟 = 300000ms），返回 `true`
  - 文件不存在时返回 `false`
- 新增 `deleteSession(projectId: string, sessionId: string): Promise<{ success: boolean; error?: "not_found" | "active" | "unknown" }>`
  - 校验 `isValidProjectId` + `isValidSessionId`
  - 构造文件路径：`path.join(PROJECTS_DIR, projectId, sessionId)`
  - 调用 `validateProjectPath` 确保路径安全
  - 调用 `isSessionActive`，若活跃则返回 `{ success: false, error: "active" }`
  - 执行 `fs.unlink`，成功返回 `{ success: true }`

**验收标准**：
- [ ] `deleteSession` 对有效输入返回 `success: true`
- [ ] `deleteSession` 对无效 projectId 返回 `success: false, error: "not_found"`
- [ ] `deleteSession` 对近期修改的文件返回 `success: false, error: "active"`
- [ ] `deleteSession` 对路径遍历输入（`../`、`\0`）安全拒绝

**验证步骤**：
```bash
npm run test:run -- lib/claude-data
```
（若尚无测试，则通过临时脚本验证核心逻辑）

---

#### Task 1.2 — API 层：Session DELETE Handler

**文件**：`app/api/projects/[projectId]/sessions/[sessionId]/route.ts`

**内容**：
- 在现有 GET handler 旁新增 DELETE handler
- 解析 `projectId` 和 `sessionId`（注意 `decodeURIComponent`）
- 调用 `deleteSession(decodedProjectId, decodedSessionId)`
- 响应映射：
  - `success: true` → `204 No Content`
  - `error: "not_found"` → `404 { error: "Session not found" }`
  - `error: "active"` → `409 { error: "Session is currently active" }`
  - 其他 → `500 { error: "Failed to delete session" }`

**验收标准**：
- [ ] 成功删除返回 204
- [ ] 不存在的 session 返回 404
- [ ] 活跃的 session 返回 409
- [ ] 路径遍历输入返回 404（安全拒绝）

**验证步骤**：
```bash
npm run test:run -- app/api/projects/\[projectId\]/sessions/\[sessionId\]/route.test.ts
```

---

#### Task 1.3 — UI 层：Session 删除交互

**文件**：
- 新建 `components/session-delete-dialog.tsx`
- 修改 `components/session-sidebar.tsx`
- 修改 `components/session-browser.tsx`

**内容**：
- `SessionDeleteDialog`：复用 `ProjectDeleteDialog` 视觉模式
  - props: `session: SessionInfo | null`, `onConfirm: () => void`, `onCancel: () => void`
  - 显示 session 标题（或 id 前 8 位）、消息数量、"This action cannot be undone."
- `SessionSidebar`：
  - 每个 session 项右侧添加删除按钮（`Trash2` 图标，hover 时显示 `opacity-0 group-hover:opacity-100`）
  - 新增 prop `onSessionDelete: (sessionId: string) => void`
  - 点击删除按钮时调用 `onSessionDelete`
- `SessionBrowser`：
  - 维护 `sessionToDelete: SessionInfo | null` state
  - 将 `onSessionDelete` 传递给 `SessionSidebar`
  - 渲染 `SessionDeleteDialog`
  - `onConfirm` 时：
    1. `fetch(DELETE /api/projects/.../sessions/...)`
    2. 若 204：从 `currentSessions` state 中移除被删 session，重置 `selectedId`
    3. 若 409：显示错误提示（alert 或 toast）
    4. 若其他错误：显示通用错误提示

**验收标准**：
- [ ] SessionSidebar 中每个 session 悬停时显示删除图标
- [ ] 点击删除图标弹出确认对话框
- [ ] 点击 Cancel 关闭对话框，不执行删除
- [ ] 点击 Delete 调用 API，成功后从列表移除
- [ ] 删除活跃 session 时显示错误提示

**验证步骤**：
```bash
npm run test:run -- components/session-delete-dialog.test.tsx
```
+ 手动启动 dev server 验证交互：
```bash
npm run dev
```

---

### 🔲 Slice 2: Worktree 删除端到端

**目标**：用户可以在 SessionSidebar 的 worktree 选择器旁删除整个 worktree 目录（含所有 session）。

#### Task 2.1 — 数据层：`deleteWorktree`

**文件**：`lib/worktree.ts`

**内容**：
- 新增 `deleteWorktree(projectId: string, worktreeName: string): Promise<{ success: boolean; error?: "not_found" | "unknown" }>`
  - 复用 `buildWorktreeProjectId` 内部的校验逻辑（禁止 `..`、`/`、`\`、`WORKTREE_MARKER`）
  - 构造 worktree 目录名：`buildWorktreeProjectId(projectId, worktreeName)`
  - 构造完整路径：`path.join(PROJECTS_DIR, worktreeId)`
  - 调用 `validateProjectPath` 确保路径安全（需要导入或复制该函数）
  - 检查目录是否存在，不存在返回 `{ success: false, error: "not_found" }`
  - 执行 `fs.rm(path, { recursive: true, force: true })`
  - 成功返回 `{ success: true }`

**验收标准**：
- [ ] `deleteWorktree` 对有效输入返回 `success: true`
- [ ] `deleteWorktree` 对不存在的 worktree 返回 `success: false, error: "not_found"`
- [ ] `deleteWorktree` 对非法 worktreeName 安全拒绝
- [ ] 删除后目录及其内容均被移除

**验证步骤**：
```bash
npm run test:run -- lib/worktree
```

---

#### Task 2.2 — API 层：Worktree DELETE Handler

**文件**：新建 `app/api/projects/[projectId]/worktrees/[worktreeName]/route.ts`

**内容**：
- 导出 `DELETE` handler
- 解析 `projectId` 和 `worktreeName`（注意 `decodeURIComponent`）
- 调用 `deleteWorktree(decodedProjectId, decodedWorktreeName)`
- 响应映射：
  - `success: true` → `204 No Content`
  - `error: "not_found"` → `404 { error: "Worktree not found" }`
  - 其他 → `500 { error: "Failed to delete worktree" }`

**验收标准**：
- [ ] 成功删除返回 204
- [ ] 不存在的 worktree 返回 404
- [ ] 非法输入返回 404（安全拒绝）

**验证步骤**：
```bash
npm run test:run -- app/api/projects/\[projectId\]/worktrees/\[worktreeName\]/route.test.ts
```

---

#### Task 2.3 — UI 层：Worktree 删除交互

**文件**：
- 新建 `components/worktree-delete-dialog.tsx`
- 修改 `components/session-sidebar.tsx`
- 修改 `components/session-browser.tsx`

**内容**：
- `WorktreeDeleteDialog`：复用 `ProjectDeleteDialog` 视觉模式
  - props: `worktree: WorktreeInfo | null`, `projectName: string`, `onConfirm: () => void`, `onCancel: () => void`
  - 显示 worktree 名称、session 数量、"This will remove all sessions in this worktree. This action cannot be undone."
- `SessionSidebar`：
  - 在 worktree 选择器（`select` 元素）右侧添加删除按钮（`Trash2` 图标）
  - 新增 prop `onWorktreeDelete: (worktreeName: string) => void`
  - 仅当 `activeWorktree !== null` 时显示删除按钮（不允删除 main）
  - 点击删除按钮时调用 `onWorktreeDelete`
- `SessionBrowser`：
  - 维护 `worktreeToDelete: WorktreeInfo | null` state
  - 将 `onWorktreeDelete` 传递给 `SessionSidebar`
  - 渲染 `WorktreeDeleteDialog`
  - `onConfirm` 时：
    1. `fetch(DELETE /api/projects/.../worktrees/...)`
    2. 若 204：从 `worktrees` 和 `worktreeSessions` state 中移除被删 worktree，重置 `activeWorktree` 为 null
    3. 若其他错误：显示通用错误提示

**验收标准**：
- [ ] Worktree 选择器旁显示删除图标（仅当选中非 main worktree 时）
- [ ] 点击删除图标弹出确认对话框
- [ ] 点击 Cancel 关闭对话框，不执行删除
- [ ] 点击 Delete 调用 API，成功后从列表和选择器中移除

**验证步骤**：
```bash
npm run test:run -- components/worktree-delete-dialog.test.tsx
```
+ 手动启动 dev server 验证交互

---

### 🔲 Slice 3: 测试覆盖

**目标**：所有新增代码均有自动化测试覆盖。

#### Task 3.1 — 数据层单元测试

**文件**：`lib/claude-data.test.ts`（新建或追加）

**内容**：
- `isSessionActive` 测试：
  - 近期修改的文件 → `true`
  - 很久以前修改的文件 → `false`
  - 不存在的文件 → `false`
  - 自定义 threshold → 正确计算
- `deleteSession` 测试（mock fs）：
  - 正常删除 → `success: true`
  - 活跃 session → `success: false, error: "active"`
  - 非法 projectId → `success: false, error: "not_found"`
  - 非法 sessionId（`../test.jsonl`）→ `success: false, error: "not_found"`

**验收标准**：
- [ ] 所有分支覆盖（正常、活跃、不存在、非法输入）

---

#### Task 3.2 — API 路由测试

**文件**：
- 新建 `app/api/projects/[projectId]/sessions/[sessionId]/route.test.ts`
- 新建 `app/api/projects/[projectId]/worktrees/[worktreeName]/route.test.ts`

**内容**：
- Session DELETE handler 测试（mock `deleteSession`）：
  - 204、404、409、500 场景
  - URL encoding 处理（含特殊字符的 projectId/sessionId）
- Worktree DELETE handler 测试（mock `deleteWorktree`）：
  - 204、404、500 场景
  - URL encoding 处理

**验收标准**：
- [ ] 两个路由文件均有完整测试
- [ ] 测试通过

---

#### Task 3.3 — 组件测试

**文件**：
- 新建 `components/session-delete-dialog.test.tsx`
- 新建 `components/worktree-delete-dialog.test.tsx`

**内容**：
- 复用 `project-delete-dialog.test.tsx` 的测试模式
- 验证：null 时不渲染、有数据时渲染内容、Cancel 回调、Delete 回调、单复数处理

**验收标准**：
- [ ] 两个组件均有测试
- [ ] 测试通过

**验证步骤**：
```bash
npm run test:run
```

---

### 🔲 Slice 4: 集成验证

**目标**：端到端验证功能正确性、安全性、边界行为。

#### Task 4.1 — 手动端到端验证

**步骤**：
1. `npm run dev` 启动开发服务器
2. 打开一个有多 session 的 project
3. **Session 删除**：
   - 悬停到一个非活跃 session，点击删除图标
   - 确认对话框内容正确（标题、消息数、不可恢复警告）
   - 点击 Cancel，验证 session 仍在列表中
   - 再次点击删除，点击 Delete，验证 session 从列表消失
   - 验证右侧消息流自动切换到其他 session
4. **Worktree 删除**：
   - 切换到一个非 main worktree
   - 点击 worktree 选择器旁的删除图标
   - 确认对话框内容正确
   - 点击 Delete，验证 worktree 从选择器中消失，列表切换回 main 的 session
5. **活跃保护**：
   - 对一个正在使用的 session（或手动 touch 修改时间），尝试删除
   - 验证收到错误提示，文件未被删除

**验收标准**：
- [ ] Session 删除流程完整可用
- [ ] Worktree 删除流程完整可用
- [ ] 活跃 session 保护生效

---

#### Task 4.2 — 安全边界验证

**步骤**：
1. 使用 curl/Postman 直接调用 API：
   - `DELETE /api/projects/../etc/sessions/test.jsonl` → 期望 404
   - `DELETE /api/projects/test/sessions/../../../etc/passwd` → 期望 404
   - `DELETE /api/projects/test/worktrees/../other` → 期望 404
2. 验证服务器日志无异常堆栈泄露

**验收标准**：
- [ ] 所有路径遍历攻击均被安全拒绝（返回 404，不泄露文件系统信息）
- [ ] 无 500 内部错误暴露

---

## 4. 检查点（Checkpoints）

| 检查点 | 触发条件 | 验证动作 | 通过标准 |
|--------|---------|---------|---------|
| **Checkpoint 1** | Slice 1 全部完成 | 运行测试 + 手动验证 session 删除 | Session 删除端到端可用，测试通过 |
| **Checkpoint 2** | Slice 2 全部完成 | 运行测试 + 手动验证 worktree 删除 | Worktree 删除端到端可用，测试通过 |
| **Checkpoint 3** | Slice 3 + 4 完成 | 全量测试 + 安全边界验证 | `npm run test:run` 全部通过，安全测试通过 |

---

## 5. 风险评估与回退策略

| 风险 | 影响 | 缓解措施 | 回退策略 |
|------|------|---------|---------|
| 误删活跃 session | 高 | `isSessionActive` mtime 检测 + 确认对话框 | 检测阈值可快速调整；如有严重误报可临时禁用 409 检查 |
| 路径遍历漏洞 | 高 | 复用现有安全校验函数；独立安全测试 | 发现问题立即修复，回滚分支 |
| Worktree 删除误删主目录 | 高 | `buildWorktreeProjectId` 校验 + `validateProjectPath` | 代码审查时重点检查路径构造逻辑 |
| UI 状态不同步 | 中 | 删除成功后立即更新本地 state | 若发现 state 不一致，可改为强制刷新页面 |
| 测试环境差异 | 低 | mock 文件系统操作，不依赖真实 `~/.claude/projects` | 测试失败时检查 mock 是否完整 |

---

## 6. 计划确认

本计划共 **4 个垂直切片、11 个任务、3 个检查点**。每个切片均可独立推进，建议按 Slice 1 → Slice 2 → Slice 3 → Slice 4 的顺序执行，以便尽早交付可用功能。
