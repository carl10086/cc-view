# Spec: Project 删除与空项目清理功能

## Objective

为 cc-view 仪表盘添加 project 删除能力，解决 0 sessions 的 project 长期堆积问题。

**用户故事：**
- 作为 cc-view 用户，我可以在项目卡片上点击删除，清理不再需要的 project
- 作为 cc-view 用户，我可以一键筛选出所有 0 sessions 的 project，快速定位可删除项

**成功标准：**
- [ ] 点击 project 卡片上的删除按钮，弹出确认对话框，确认后删除 project 及其关联 worktree
- [ ] 删除后页面自动刷新，project 从列表消失
- [ ] 筛选工具栏新增 "Empty" 按钮，点击后只显示 `sessionCount === 0` 的 project
- [ ] 删除操作不会越界（只能删除 `~/.claude/projects` 下的目录）
- [ ] 删除失败时显示错误提示（如权限不足、目录非空等）

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- 文件系统操作：`fs.promises` (Node.js)

## 副作用分析

**对 Claude Code 的影响：**

1. **数据丢失风险**：删除 project 目录会永久移除该 project 下的所有 `.jsonl` session 文件，不可恢复
2. **运行时冲突**：如果 Claude Code 正在该 project 下运行并持有文件句柄，删除可能导致：
   - 正在写入的 session 数据丢失
   - 进程报错（但通常不影响 Claude Code 主进程）
3. **安全边界**：通过 `isValidProjectId` 校验确保只能删除 `~/.claude/projects` 下的目录，防止路径遍历

**缓解措施：**
- 删除前弹窗确认，明确告知删除不可逆
- 建议用户只删除已知不再使用的 project

## Commands

```bash
# 开发
npm run dev

# 测试
npm test

# 构建
npm run build
```

## Project Structure

```
app/
  api/
    projects/
      [projectId]/
        route.ts          → DELETE 端点（新增）
components/
  project-card.tsx        → 添加删除按钮
  project-delete-dialog.tsx → 删除确认对话框（新增）
  projects-toolbar.tsx    → 添加 Empty 筛选按钮
  projects-view.tsx       → 集成删除逻辑
lib/
  claude-data.ts          → 添加 deleteProject() 函数
  project-filters.ts      → 扩展筛选条件（emptyOnly）
types/
  claude.ts               → 类型定义（不变）
```

## Code Style

```typescript
// 函数命名：动词开头，小驼峰
export async function deleteProject(projectId: string): Promise<void>

// 组件命名：大驼峰，Props 接口显式声明
interface ProjectDeleteDialogProps {
  project: ProjectInfo
  onDelete: () => void
  onCancel: () => void
}

// 错误处理：try/catch + 返回 null/void，不抛异常到 UI
// UI 层用 toast 或内联错误展示
```

## Testing Strategy

- **单元测试**：`lib/project-filters.test.ts` 补充 `emptyOnly` 筛选逻辑
- **单元测试**：`lib/claude-data.test.ts` 补充 `deleteProject` 的边界情况（无效 ID、不存在目录）
- **组件测试**：`projects-toolbar.test.tsx` 验证 Empty 按钮切换筛选状态
- **手动验证**：
  1. 创建一个测试 project（0 sessions）
  2. 点击 Empty 筛选，确认该 project 显示
  3. 点击删除，确认对话框弹出
  4. 确认删除，验证目录已移除
  5. 验证页面刷新后 project 消失

## Boundaries

- **Always:**
  - 删除前调用 `isValidProjectId` 校验路径安全
  - 删除后刷新页面数据（revalidatePath 或客户端刷新）
  - 关联 worktree 一并删除（通过 `parseWorktree` 识别）
  - 运行测试后再提交

- **Ask first:**
  - 添加新的 npm 依赖
  - 修改 Claude Code 核心数据目录结构（本项目只读/删，不写）
  - 添加批量删除（当前 scope 为单项目删除）

- **Never:**
  - 删除 `~/.claude/projects` 以外的任何目录
  - 静默失败（删除失败必须有错误提示）
  - 添加回收站/软删除机制（超出当前 scope）

## Implementation Plan

### Phase 1: 数据层与 API（约 30 分钟）
1. `lib/claude-data.ts` — 添加 `deleteProject(id)` 函数
   - 校验 `isValidProjectId`
   - 删除主 project 目录
   - 扫描并删除关联 worktree 目录
2. `app/api/projects/[projectId]/route.ts` — 新建 DELETE handler
   - 调用 `deleteProject`
   - 返回 204（成功）或 400/500（失败）

### Phase 2: 筛选功能（约 20 分钟）
1. `lib/project-filters.ts` — 扩展 `FilterState` 添加 `emptyOnly?: boolean`
2. `components/projects-toolbar.tsx` — 添加 "Empty" toggle 按钮
3. `components/projects-view.tsx` — 传递 emptyOnly 状态

### Phase 3: UI 删除交互（约 40 分钟）
1. `components/project-delete-dialog.tsx` — 新建确认对话框
2. `components/project-card.tsx` — 添加删除按钮（hover 显示）
3. `components/project-list.tsx` — 可选：透传删除回调
4. 集成 API 调用 + 成功/错误处理

### Phase 4: 测试与验证（约 30 分钟）
1. 补充单元测试
2. 手动验证删除流程
3. 验证 Empty 筛选

## Open Questions

无（需求已澄清）。
