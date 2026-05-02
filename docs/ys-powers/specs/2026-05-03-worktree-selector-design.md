# Worktree Session Selector

## Objective

为项目详情页的 SessionBrowser 增加 worktree 切换能力，让用户可以在主项目（main）和各个 git worktree 之间切换，查看对应 worktree 下的 session 列表。

当前问题：`ys-code` 等项目有多个 worktree（对应不同 feature branch），但项目详情页只能看到主目录的 session，worktree 中的 session 完全不可访问。

## Core Features & Acceptance Criteria

1. **Worktree 检测与展示**
   - 项目详情页 header 下方显示当前项目拥有的 worktree 列表
   - 没有 worktree 的项目保持现有 UI，不显示任何切换器
   - 有 worktree 的项目显示紧凑的 dropdown/tab 切换器

2. **切换行为**
   - 默认选中 `main`（主项目目录）
   - 切换 worktree 时，sidebar 的 session 列表完全替换为新 worktree 的 sessions
   - 右侧 message stream 清空并显示 loading 状态
   - scroll position 重置到顶部

3. **数据流**
   - `ProjectPage` 从 `getProjectById` 获取 `worktrees: WorktreeInfo[]` 并传给 `SessionBrowser`
   - `SessionBrowser` 维护 `activeWorktree: string | null` 状态
   - `effectiveProjectId` 计算规则：`main` 用原 `projectId`，worktree 用 `{projectId}--claude-worktrees-{worktreeName}`
   - 复用现有 `/api/projects/{id}/sessions` API，无需新增接口

4. **UI 细节**
   - 切换器放在 sidebar 顶部，session 列表上方
   - 样式与现有 shadcn/ui 组件保持一致
   - 显示当前选中 worktree 的 session 数量

## Commands

开发/验证命令：

```bash
# 启动开发服务器
npm run dev

# 运行测试
npx vitest run

# 类型检查
npx tsc --noEmit

# 构建验证
npm run build
```

## Project Structure

变更涉及文件：

```
app/projects/[projectId]/page.tsx       # 传递 worktrees 给 SessionBrowser
components/session-browser.tsx          # 新增 worktree 状态和切换 UI
components/session-sidebar.tsx          # 可能需要在顶部预留切换器插槽
```

无需改动：
- `lib/claude-data.ts` — getSessions 逻辑已支持任意合法 projectId
- `app/api/projects/[projectId]/sessions/*` — API 无需变更

## Code Style

- 复用现有的 `Badge`、`Card`、`Select` 等 shadcn/ui 组件
- Tailwind CSS 工具类优先，不新增自定义 CSS
- 状态变更使用 React `useState` + `useEffect`，保持与现有组件一致
- `useEffect` 中继续使用 `AbortController` 防止竞态

## Testing Strategy

1. **单元测试**
   - `lib/claude-data.test.ts` 中已有 worktree 相关测试，无需新增
   - 重点验证 `effectiveProjectId` 计算逻辑（可用 vitest 快速覆盖）

2. **手动验证**
   - 访问 `ys-code` 项目详情页，确认 worktree 切换器出现
   - 切换不同 worktree，确认 sidebar session 列表变化
   - 访问无 worktree 的项目（如 `cc-view`），确认切换器隐藏
   - 验证切换时的 loading 状态和错误处理

## Boundaries

**Always do:**
- 切换 worktree 时取消正在进行的 fetch（AbortController）
- 保持无 worktree 项目的现有行为不变
- 使用现有的类型定义，不引入新概念

**Ask first about：**
- 是否需要在 URL query 中记录当前选中的 worktree（刷新后保持状态）
- 是否需要在项目列表页直接跳转到特定 worktree

**Never do：**
- 修改 API 路由或数据层接口签名
- 把不同 worktree 的 session 合并到一个列表里展示
- 新增外部依赖
