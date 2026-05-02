# Worktree Session Selector — 实现计划

## 依赖图

```
ProjectPage (server)
  ├── getProjectById() → ProjectInfo (含 worktrees[])
  ├── getSessions(projectId) → SessionInfo[] (main)
  └── SessionBrowser (client)
        ├── props: projectId, sessions (main), worktrees[]
        ├── state: activeWorktree: string | null
        ├── computed: effectiveProjectId
        ├── fetch() → /api/projects/{effectiveProjectId}/sessions
        ├── SessionSidebar
        │     └── worktree selector UI (dropdown)
        └── MessageStream
```

**关键依赖：**
- `SessionBrowser` 必须先接收 `worktrees` prop，才能渲染切换器
- `effectiveProjectId` 计算必须在 `useEffect` fetch 之前完成
- API 层无需改动，`isValidProjectId` 已经能正确校验 worktree 目录名

---

## 垂直切片

### Task 1: 数据流贯通 — 让 SessionBrowser 能加载 worktree 的 session

**目标：** 从 ProjectPage 把 worktrees 数据传到 SessionBrowser，内部能根据选中的 worktree 构造正确的 `effectiveProjectId` 并发起请求。

**改动文件：**
- `app/projects/[projectId]/page.tsx` — 传递 `worktrees` prop
- `components/session-browser.tsx` — 接收 `worktrees`，新增 `activeWorktree` / `effectiveProjectId` 状态，修改 `useEffect` 和 `loadMore` 使用 `effectiveProjectId`

**验收标准：**
1. `SessionBrowser` 接收 `worktrees: WorktreeInfo[]`
2. 当 `activeWorktree = "command-execution-alignment"` 时，`effectiveProjectId` 等于 `-Users-carlyu-soft-projects-ys-code--claude-worktrees-command-execution-alignment`
3. `useEffect` 依赖 `effectiveProjectId`，切换时能正确请求新 worktree 的 session
4. 手动验证：临时把 `activeWorktree` 写死为某个 worktree，确认 sidebar 加载的是该 worktree 的 sessions

**验证步骤：**
```bash
npm run build    # 类型检查通过
npm run dev      # 浏览器访问 ys-code，手动改 state 验证
```

---

### Task 2: 切换器 UI — 在 sidebar 顶部加入 worktree 选择控件

**目标：** 用户能直观看到当前有哪些 worktree，点击后切换 session 列表。

**改动文件：**
- `components/session-sidebar.tsx` — 新增 `worktrees`、`activeWorktree`、`onWorktreeChange` props，在 header 下方渲染 `<select>` 下拉框
- `components/session-browser.tsx` — 把状态和回调传给 `SessionSidebar`

**设计细节：**
- 无 worktree 时：完全不渲染 selector，保持现有 sidebar 样式
- 有 worktree 时：在 "Sessions" header 和列表之间插入一行 `<select>`
- 选项：`main` + 每个 worktree 的 `name`
- 右侧显示当前 worktree 的 session 数量

**注意：** `shadcn/ui` 的 `<Select>` 组件未安装，计划使用原生 `<select>` + Tailwind 样式，避免新增依赖。

**验收标准：**
1. `ys-code` 详情页 sidebar 顶部出现下拉框，选项为 `main`、`command-execution-alignment`、`webfetch-tool`...
2. 选择不同选项，sidebar 的 session 列表立即替换
3. `cc-view` 等无 worktree 项目不出现下拉框
4. 切换时右侧 message stream 清空并出现 loading 状态

**验证步骤：**
```bash
npx vitest run          # 测试通过
npm run dev             # 浏览器交互验证
```

---

### Task 3: 边界处理与打磨

**目标：** 处理各种边缘情况，保证体验完整。

**改动文件：**
- `components/session-browser.tsx` — 完善 AbortController、scroll reset、error 清空

**验收标准：**
1. 快速切换 worktree 时，旧的 fetch 被正确取消，不会出现竞态覆盖
2. 切换 worktree 后，`scrollRef.current.scrollTop = 0` 执行正确
3. 如果某个 worktree 没有 session，sidebar 显示 "No sessions found"（已有逻辑）
4. 切换 worktree 时，`selectedId` 重置为 `null` 或第一个 session，避免保留上一个 worktree 的选中态
5. 构建无错误：`npm run build` 通过

**验证步骤：**
```bash
npx vitest run          # 全部测试通过
npm run build           # 构建成功
npm run dev             # 手动验证 ys-code 和 cc-view
```

---

## Checkpoints

| 阶段 | 检查项 | 通过标准 |
|------|--------|----------|
| **Task 1 完成后** | 数据流是否正确 | 临时写死 state，能加载 worktree session |
| **Task 2 完成后** | UI 是否可用 | 下拉框出现，切换有效，无 worktree 项目不显示 |
| **Task 3 完成后** | 是否可交付 | 测试通过，构建通过，手动验证无异常 |

---

## 范围外（明确不做）

- 不修改 URL query 记录当前 worktree
- 不在项目列表页增加 worktree 快捷入口
- 不合并多个 worktree 的 session 到一个列表
- 不改动 API 路由或数据层函数签名
