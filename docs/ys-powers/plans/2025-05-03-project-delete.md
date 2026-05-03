# Plan: Project 删除与空项目清理

## 依赖图

```
lib/claude-data.ts ─────┬─── deleteProject()
                        │       └── 依赖: isValidProjectId, PROJECTS_DIR, parseWorktree
                        │
lib/project-filters.ts ─┼─── FilterState.emptyOnly
                        │       └── 依赖: ProjectInfo.sessionCount
                        │
app/api/projects/       │
  [projectId]/          │
    route.ts ───────────┘       (新增 DELETE handler)
        └── 依赖: deleteProject

components/projects-toolbar.tsx ─── Empty toggle 按钮
    └── 依赖: FilterState, serializeUrlState

components/project-delete-dialog.tsx ─── 确认对话框 (新增)
    └── 无外部依赖（纯 UI）

components/project-card.tsx ─── 删除按钮触发 dialog
    └── 依赖: project-delete-dialog.tsx

components/project-list.tsx ─── 透传 onDelete 回调
    └── 依赖: project-card.tsx

components/projects-view.tsx ─── 集成所有逻辑
    └── 依赖: project-list.tsx, projects-toolbar.tsx, DELETE API
```

## 垂直切片

按**端到端可验证**原则切片，每个任务独立完成一条用户路径：

| 切片 | 覆盖路径 | 涉及文件 |
|------|---------|---------|
| **Task 1** | Empty 筛选 → 列表过滤 | `lib/project-filters.ts`, `components/projects-toolbar.tsx`, `components/projects-view.tsx` |
| **Task 2** | API 调用 → 文件系统删除 | `lib/claude-data.ts`, `app/api/projects/[projectId]/route.ts`, `lib/claude-data.test.ts` |
| **Task 3** | 点击删除 → 确认 → 调用 API → 刷新列表 | `components/project-delete-dialog.tsx`, `components/project-card.tsx`, `components/project-list.tsx`, `components/projects-view.tsx` |

## 任务详情

### Task 1: Empty 筛选功能

**目标：** 在 Toolbar 增加 "Empty" 切换按钮，点击后列表只显示 `sessionCount === 0` 的 project。

**文件变更：**
- `lib/project-filters.ts` — 扩展 `FilterState` 添加 `emptyOnly?: boolean`，`filterProjects` 增加过滤逻辑
- `components/projects-toolbar.tsx` — 添加 Empty toggle 按钮
- `components/projects-view.tsx` — 传递 emptyOnly 状态

**验收标准：**
1. URL 参数包含 `empty=1` 时，`filterProjects` 只返回 `sessionCount === 0` 的项目
2. Toolbar 上的 Empty 按钮可以切换激活/非激活状态
3. 切换 Empty 按钮后，项目列表实时过滤，URL 同步更新
4. Empty 与其他筛选条件（搜索、时间）可叠加使用

**验证步骤：**
```bash
# 单元测试
npm test -- lib/project-filters.test.ts

# 手动验证
npm run dev
# 1. 打开 /projects
# 2. 点击 "Empty" 按钮
# 3. 确认列表只显示 sessionCount === 0 的项目
# 4. 与搜索框叠加测试
```

---

### Task 2: 后端删除 API

**目标：** 提供 `DELETE /api/projects/[projectId]` 端点，安全删除 project 目录及其关联 worktree。

**文件变更：**
- `lib/claude-data.ts` — 新增 `deleteProject(projectId: string): Promise<void>` 函数
- `app/api/projects/[projectId]/route.ts` — 新建 DELETE handler
- `lib/claude-data.test.ts` — 添加 `deleteProject` 安全测试

**关键实现细节：**
1. `deleteProject` 内部逻辑：
   - 调用 `isValidProjectId` 校验路径安全
   - 读取 `PROJECTS_DIR` 下所有目录，找出 `parseWorktree(e.name)?.mainId === projectId` 的关联 worktree
   - 使用 `fs.rm(dir, { recursive: true, force: true })` 删除主目录和所有关联 worktree
2. DELETE handler 返回：
   - `204 No Content` — 删除成功
   - `400 Bad Request` — projectId 非法
   - `404 Not Found` — 目录不存在
   - `500 Internal Server Error` — 删除失败（权限等）

**验收标准：**
1. 对有效 projectId 调用 DELETE，主目录和关联 worktree 被物理删除
2. 对包含 `..` 的 projectId 返回 400，不执行任何文件操作
3. 对不存在的 projectId 返回 404
4. 删除后再次 GET 该 project，返回 404

**验证步骤：**
```bash
# 单元测试
npm test -- lib/claude-data.test.ts

# 手动验证（curl）
curl -X DELETE http://localhost:3000/api/projects/some-test-project
# 验证目录已删除
```

---

### Task 3: 前端删除交互

**目标：** Project Card 上增加删除入口，点击后弹出确认对话框，确认后调用 API 删除并刷新列表。

**文件变更：**
- `components/project-delete-dialog.tsx` — 新建确认对话框组件
- `components/project-card.tsx` — 添加删除按钮（hover 时显示或常驻右上角菜单）
- `components/project-list.tsx` — 透传 `onDelete` 回调
- `components/projects-view.tsx` — 管理 dialog 状态，调用 DELETE API，成功后刷新

**UI 设计决策：**
- shadcn/ui 未安装 dialog/button，使用原生 `<dialog>` 元素 + Tailwind 样式
- 删除按钮放在 Card 右上角，hover 整个 Card 时显示（避免日常视觉噪音）
- 确认对话框内容："Delete `<project.name>`? This will remove N sessions and cannot be undone."
- 按钮样式：Cancel（次要）+ Delete（红色危险）

**状态管理：**
- `ProjectsView` 维护 `deletingProject: ProjectInfo | null`
- 点击删除 → `setDeletingProject(project)` → dialog 打开
- 确认 → `fetch(DELETE)` → `setDeletingProject(null)` → `router.refresh()`
- 取消 → `setDeletingProject(null)`

**验收标准：**
1. 鼠标 hover Project Card 时，右上角显示删除图标按钮
2. 点击删除按钮，弹出确认对话框，显示 project 名称和 session 数量
3. 点击 Cancel，对话框关闭，无 API 调用
4. 点击 Delete，调用 DELETE API，对话框关闭，页面刷新，project 从列表消失
5. API 失败时显示错误信息（可用 `alert` 或内联提示，不引入新依赖）

**验证步骤：**
```bash
npm run dev
# 1. 创建一个测试 project（0 sessions）
mkdir -p ~/.claude/projects/test-empty-project
# 2. 打开 /projects，找到该 project
# 3. hover Card，点击删除图标
# 4. 确认对话框内容正确
# 5. 点击 Delete，验证目录已删除，列表已刷新
# 6. 重复测试 Cancel 行为
```

---

## 检查点

| 检查点 | 位置 | 验证内容 |
|--------|------|---------|
| **CP1** | Task 1 完成后 | Empty 筛选能正确过滤列表，URL 参数同步 |
| **CP2** | Task 2 完成后 | curl DELETE 能正确删除目录和 worktree，非法 ID 返回 400 |
| **CP3** | Task 3 完成后 | 端到端删除流程可用，确认对话框正常，错误有反馈 |
| **CP4** | 全部完成后 | `npm test` 全通过，`npm run build` 无报错 |

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 误删活跃 project | 数据丢失 | 确认对话框明确提示 session 数量；建议只删除 Empty project |
| 删除时 Claude Code 正在写入 | session 损坏 | 属于已知限制，在 spec 中已说明；不引入文件锁机制 |
| 无 dialog 组件可用 | 需手写 dialog | 使用原生 `<dialog>` + Tailwind，不引入新依赖 |
| worktree 识别遗漏 | 孤儿目录残留 | 复用 `getProjects` 中的 `parseWorktree` 逻辑，确保一致 |

## 执行顺序

```
Task 1 (Empty 筛选)
    │
    ▼
CP1 — 手动验证筛选功能
    │
    ▼
Task 2 (后端删除 API)
    │
    ▼
CP2 — curl 验证 API
    │
    ▼
Task 3 (前端删除交互)
    │
    ▼
CP3 — 端到端手动验证
    │
    ▼
CP4 — 全量测试 + 构建通过
```

Task 1 和 Task 2 可并行开发，但建议按顺序执行以减少上下文切换。
