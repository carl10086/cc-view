# 删除 Session 与 Worktree 功能设计

## 1. Objective（目标）

为 cc-view 仪表盘增加两项数据管理能力：

1. **删除单个 Session**：允许用户从 sidebar 中删除指定的 `.jsonl` 文件，但禁止删除正在运行（近期活跃）的 session。
2. **删除单个 Worktree**：允许用户从 worktree 选择器中删除整个 worktree 目录（包含其下所有 session）。

提升数据管理的灵活性和安全性。

## 2. Commands / API（接口）

### 2.1 DELETE `/api/projects/[projectId]/sessions/[sessionId]`

删除指定 session 的 `.jsonl` 文件。

**行为**：
- 安全校验：`isValidProjectId(projectId)` + `isValidSessionId(sessionId)`
- 活跃检测：检查文件 `mtime` 是否在 `ACTIVE_SESSION_THRESHOLD_MS`（默认 5 分钟）内，若是则返回 `409 Conflict`
- 成功：删除文件，返回 `204 No Content`
- 错误：
  - `404`：project 或 session 不存在
  - `409`：session 正在运行（近期有写入）
  - `500`：文件系统错误

### 2.2 DELETE `/api/projects/[projectId]/worktrees/[worktreeName]`

删除指定 worktree 目录及其所有内容。

**行为**：
- 安全校验：`isValidProjectId(projectId)` + worktreeName 合法性检查（复用 `buildWorktreeProjectId` 的校验逻辑）
- 路径构造：使用 `buildWorktreeProjectId(projectId, worktreeName)` 构造目录名
- 成功：`fs.rm(path, { recursive: true, force: true })`，返回 `204 No Content`
- 错误：
  - `404`：worktree 不存在
  - `500`：文件系统错误

## 3. Project Structure（文件变更）

```
lib/claude-data.ts
  └─ 新增 deleteSession(projectId, sessionId): Promise<boolean>
  └─ 新增 isSessionActive(filePath): Promise<boolean>（启发式 mtime 检测）

lib/worktree.ts
  └─ 新增 deleteWorktree(projectId, worktreeName): Promise<boolean>

app/api/projects/[projectId]/sessions/[sessionId]/route.ts
  └─ 新增 DELETE handler

app/api/projects/[projectId]/worktrees/[worktreeName]/route.ts
  └─ 新建文件，提供 DELETE handler

components/session-sidebar.tsx
  └─ 每个 session 项右侧添加删除按钮（hover 显示）
  └─ 新增 onSessionDelete 回调 prop
  └─ worktree 选择器右侧添加删除按钮
  └─ 新增 onWorktreeDelete 回调 prop

components/session-delete-dialog.tsx
  └─ 新建：Session 删除确认对话框

components/worktree-delete-dialog.tsx
  └─ 新建：Worktree 删除确认对话框
```

## 4. Code Style（代码风格）

- **安全**：复用现有 `isValidProjectId`、`isValidSessionId`、`validateProjectPath` 等校验函数，禁止目录遍历。
- **UI 一致性**：对话框样式复用 `ProjectDeleteDialog` 的视觉模式（红色警示图标、Cancel/Delete 按钮布局、backdrop）。
- **错误处理**：API 层使用 `try/catch` 区分文件系统错误；UI 层捕获 fetch 错误并显示 toast/alert（若项目已有错误反馈机制则复用）。
- **状态管理**：删除成功后，从本地 state 中移除被删项（不重新加载整个列表），保持 UI 响应速度。

## 5. Testing Strategy（测试策略）

| 层级 | 测试内容 | 目标 |
|------|---------|------|
| 单元 | `deleteSession` / `deleteWorktree` 核心逻辑 | 验证正常删除、路径校验、活跃检测逻辑 |
| API | `DELETE` handler 测试 | 验证 204、404、409 状态码及响应体 |
| 安全 | 路径遍历边界测试 | 确保 `../`、`\0`、绝对路径等输入被拒绝 |
| 组件 | 确认对话框交互测试 | 验证点击 Cancel 关闭、点击 Confirm 触发回调 |

## 6. Boundaries（边界与约束）

### 6.1 Always Do（必须做）
- 始终在删除前弹出确认对话框，明确告知用户不可恢复。
- 始终执行路径安全校验，拒绝任何可疑输入。
- 始终处理文件系统错误，避免静默失败。

### 6.2 Ask First（需先询问）
- 是否需要批量删除多个 session 的能力？
- 是否需要软删除/回收站机制（可恢复）？
- 是否需要删除操作的 undo 反馈（如 toast + 撤销按钮）？
- 活跃检测阈值（5 分钟）是否需要可配置？

### 6.3 Never Do（禁止做）
- 不删除正在运行（`mtime` 在阈值内）的 session。
- 不绕过 `isValidProjectId` / `validateProjectPath` 安全校验。
- 不在没有确认对话框的情况下直接执行删除操作。
- 不修改 `session_id`（文件名），因此本次需求暂不支持 rename 功能。
