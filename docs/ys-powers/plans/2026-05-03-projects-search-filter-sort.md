# Plan: Projects 列表搜索 / 过滤 / 排序

> **Spec**: `docs/ys-powers/specs/2026-05-03-projects-search-filter-sort-design.md`
> **Branch**: `feat/projects-search-filter-sort`（已创建）
> **目标保存路径**: `docs/ys-powers/plans/2026-05-03-projects-search-filter-sort.md`

---

## 1. Context（背景与动机）

`/projects` 页面当前是纯 server component，把 `getProjects()` 返回的数组直接铺成 grid。当项目数量增多，没有任何查找/排序手段会很难定位特定项目。本次改动加入客户端搜索 / 时间过滤 / 多维排序，所有状态通过 URL query params 同步，使结果可分享、可刷新还原。

需求的关键约束（来自 spec 与本次澄清）：
- 仅前端改造，不改 `getProjects()` 数据层，也不改服务端调用契约
- 不引入新 npm 依赖（搜索框 / 下拉用**原生** `<input>` / `<select>`，复用 `components/session-sidebar.tsx:31-45` 同款 Tailwind 样式）
- URL 是状态单一事实源（`?q=&period=&sort=&order=`），默认值不写入 URL

---

## 2. Architecture Overview（架构与数据流）

```
app/projects/page.tsx (Server, async)
   │ const projects = await getProjects()
   ▼
<Suspense fallback={<grid skeleton>}>
   <ProjectsView projects={projects} />        // Client Component (new)
       │
       │ const sp = useSearchParams()
       │ const { q, period, sort, order } = parseUrlState(sp)
       │ const visible = sortProjects(filterProjects(projects, { q, period }), { sort, order })
       ▼
       ┌──────────────────────────────────┐
       │ <ProjectsToolbar urlState=... /> │   // Client Component (new)
       │   - debounced <input> for q      │
       │   - <select> for period          │
       │   - <select> for sort + order    │
       │   - 写 URL via router.replace    │
       └──────────────────────────────────┘
       ┌──────────────────────────────────┐
       │ counter: "N projects · M shown" │
       └──────────────────────────────────┘
       ┌──────────────────────────────────┐
       │ visible.length === 0             │
       │   ? <EmptyState clearable />     │
       │   : <ProjectList projects=...>   │   // 不变，仍渲染 grid
       └──────────────────────────────────┘
```

### 复用的现有代码（已确认存在）

- `lib/utils.ts:5` — `cn()`：合并 className（`clsx` + `tailwind-merge`）
- `lib/utils.ts:13` — `pluralize(count, word)`：用于计数文案
- `components/project-list.tsx` — 不修改，作为子组件继续展示 grid
- `components/project-card.tsx` — 不修改
- `components/session-browser.tsx:1` — 参考的 `"use client"` 模式（server props → useMemo filter → 子组件）
- `components/session-sidebar.tsx:31-45` — 参考的原生 `<select>` Tailwind 样式
- `vitest.config.ts` — 已配 jsdom + globals + `@/` alias，可直接写 `*.test.ts`

### 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态源 | URL query params | spec 已锁定；可分享、可刷新还原 |
| 路由更新 API | `router.replace(href, { scroll: false })` | 不污染历史栈、保持滚动位置 |
| Debounce | 自实现（`useEffect + setTimeout`） | spec §4 禁止 lodash；250ms |
| 默认值处理 | 默认值**不**写入 URL | URL 简洁；`/projects` 即默认状态 |
| 时区基准 | 本地时区 `startOfDay` | spec §7：避免 UTC 边界差异 |
| 组件拆分 | View（容器）+ Toolbar（控件）+ ProjectList（已有） | View 持 URL 解析逻辑，Toolbar 仅消费/修改 |

---

## 3. Dependency Graph（依赖图）

```
Slice 1: lib/project-filters.ts  (纯函数 + 类型)
              │
              ├──► Slice 2: components/projects-view.tsx (集成到 page)
              │             │
              │             └──► Slice 3-5: toolbar 三个控件
              │                              │
              │                              └──► Slice 6: 空态 + 计数文案 polish
              │
              └──► lib/project-filters.test.ts (与 Slice 1 同时落地)
```

每个 slice 都是垂直切片：一条端到端路径、可独立验证、不留半成品。

---

## 4. Vertical Slices（任务拆分）

### Slice 1 — 纯函数核心 + 单测
**Files**:
- 新增 `lib/project-filters.ts`
- 新增 `lib/project-filters.test.ts`

**导出 API**（仅纯函数 + 类型，无 React）:
```ts
export type Period = "any" | "today" | "7d" | "30d" | "90d"
export type SortKey = "recent" | "sessions" | "name"
export type SortOrder = "asc" | "desc"

export interface FilterState { q: string; period: Period }
export interface SortState { sort: SortKey; order: SortOrder }

export function filterProjects(projects: ProjectInfo[], state: FilterState): ProjectInfo[]
export function sortProjects(projects: ProjectInfo[], state: SortState): ProjectInfo[]

export function parseUrlState(sp: URLSearchParams): FilterState & SortState
export function serializeUrlState(s: FilterState & SortState): string  // 返回 "?q=foo&period=7d" 或 ""
export function defaultSortOrder(sort: SortKey): SortOrder              // recent/sessions=desc, name=asc
```

**测试覆盖（spec §5.1 全部条目）**：
- `filterProjects`：空 query / 大小写不敏感 / 特殊字符 / period 5 档边界 / 组合
- `sortProjects`：3 sort × 2 order = 6 组合 + 同值稳定性
- `parseUrlState`：默认值省略 / 非法值回退 / 单参数 / 全参数
- `serializeUrlState`：默认值不写入 / 完整状态写入 / 双向往返一致

**Verification**:
- `pnpm test` 全绿（仅本文件）
- `pnpm tsc --noEmit` 通过

**Definition of Done**:
- 测试覆盖率覆盖 spec §5.1 所有条目
- 不依赖任何 React / Next API

---

### Slice 2 — ProjectsView 集成（无工具栏 UI）
**Files**:
- 新增 `components/projects-view.tsx`（`"use client"`）
- 修改 `app/projects/page.tsx`：用 `<Suspense><ProjectsView projects={projects} /></Suspense>` 替换 `<ProjectList>`，标题计数挪到 ProjectsView

**职责**:
- 接收 `projects: ProjectInfo[]` 作为 props
- 用 `useSearchParams()` 读取 URL state，调 `parseUrlState` 解析
- 用 `useMemo` 计算 `visible = sort(filter(projects, ...), ...)`
- 渲染：标题 + 计数文案（`N projects · M shown`）+ `<ProjectList projects={visible} />`
- 暂不渲染 toolbar UI（下个 slice 加）
- `Suspense` 包裹（Next.js 16 要求 `useSearchParams` 在 Suspense 边界内），fallback = grid skeleton

**Verification**:
- `pnpm dev`，浏览器访问 `/projects` —— 与改造前视觉一致
- 手工在地址栏拼 `?q=cc-view` —— 列表过滤生效，计数变成 `N projects · 1 shown`
- 拼 `?period=7d` / `?sort=name&order=asc` —— 各自生效
- Network 面板：toolbar 操作无新的 server roundtrip（本 slice 还无 toolbar，留给下 slice 验证）

**Definition of Done**:
- 视觉与现状不变（无 toolbar 时）
- URL params 直接生效

**🚦 Checkpoint A（Slice 1+2 完成）**: 数据层稳定，UI 还未交互。`pnpm test` + `pnpm tsc --noEmit` + `pnpm lint` 全绿；浏览器手贴 URL 三种验证全过。

---

### Slice 3 — Toolbar 搜索框（debounced）
**Files**:
- 新增 `components/projects-toolbar.tsx`（`"use client"`）
- 修改 `components/projects-view.tsx`：渲染 `<ProjectsToolbar urlState={...} />`

**实现要点**:
- Toolbar 接收当前 url state 作为 props，渲染受控 `<input>`（搜索框）
- `<input>` 的 `value` 用本地 state 跟随键盘输入（保持顺滑）
- 用 `useEffect + setTimeout` 实现 250ms debounce，到时调 `router.replace` 写 URL
- 复用 `session-sidebar.tsx` 的 Tailwind 类风格（`rounded-md border ... focus:outline-none`），加搜索 icon（`lucide-react` 已有 `Search`）
- placeholder: `"Search by name…"`
- `aria-label="Search projects by name"`

**Verification**:
- `pnpm dev`，键盘输入 "cc" —— 250ms 内地址栏出现 `?q=cc`，列表过滤
- 快速键入 5 个字符 —— Network 面板**只**有最后一次路由更新（debounce 生效）
- 清空输入框 —— `?q=` 从 URL 移除（默认值不写入）
- 大写小写混合输入 —— 结果一致（验证不区分大小写）

**Definition of Done**:
- 满足 AC-2

---

### Slice 4 — Toolbar 时间过滤下拉
**Files**:
- 修改 `components/projects-toolbar.tsx`：增加 5 档 `<select>`

**实现要点**:
- 5 个选项：`Any time` / `Today` / `Last 7 days` / `Last 30 days` / `Last 90 days`，对应 value `any/today/7d/30d/90d`
- 切换即写 URL（无 debounce）
- `aria-label="Filter by last active time"`

**Verification**:
- `pnpm dev`，切到 "Last 7 days" —— `?period=7d` 进 URL，列表只剩 7 天内项目
- 切回 "Any time" —— `period` 从 URL 消失
- 与搜索框组合：`q + period` 同时生效

**Definition of Done**:
- 满足 AC-3

---

### Slice 5 — Toolbar 排序下拉（含升降序切换）
**Files**:
- 修改 `components/projects-toolbar.tsx`：增加排序控件

**实现要点**:
- 一个 `<select>` 选 sort key：Recent / Sessions / Name
- 一个 button（`lucide-react` `ArrowUp/ArrowDown` icon）切 order asc↔desc
- 切换 sort 时若用户没显式设过 order，重置为该 key 的 default（recent/sessions=desc, name=asc）—— 用 `defaultSortOrder()`
- `aria-label` 完整覆盖

**Verification**:
- `pnpm dev`，切 sort=Sessions —— 列表按 sessionCount 降序；URL `?sort=sessions`
- 点切升降序 button —— URL 变 `?sort=sessions&order=asc`，列表反序
- 切到 Name —— 默认 A-Z；URL `?sort=name`（注意 order=asc 因为是 name 默认值，不写入）
- 三种 sort × 升降序 6 种组合都验证一遍

**Definition of Done**:
- 满足 AC-4
- URL Schema 与 spec §3.4 一致（默认值不写入）

**🚦 Checkpoint B（Slice 3-5 完成）**: 完整工具栏可用，AC-1 ~ AC-5 都过。

---

### Slice 6 — 空态、计数文案、最终打磨
**Files**:
- 修改 `components/projects-view.tsx`：visible.length === 0 时渲染自定义空态（带 "Clear filters" 按钮，点击 `router.replace('/projects')`）
- 计数文案样式：M < N 时颜色变更（如 `text-blue-600`），M === N 时常态
- 整体 a11y 检查：所有交互控件有 `aria-label`，键盘可操作

**Verification**（spec §5.2 全部 AC 一次走完）:
- [ ] **AC-1** 工具栏 3 个控件可见
- [ ] **AC-2** 搜索大小写不敏感 + 250ms debounce
- [ ] **AC-3** 5 档时间过滤
- [ ] **AC-4** 3 维度排序 × 升降序
- [ ] **AC-5** URL 同步：刷新还原 + 复制到新标签还原
- [ ] **AC-6** 计数文案：`N projects · M shown`，M<N 颜色提示
- [ ] **AC-7** 空过滤结果显示空态 + Clear 按钮一键清空
- [ ] **AC-8** Network 面板：工具栏操作无 page-level SSR refetch
- [ ] `pnpm test` 全绿
- [ ] `pnpm tsc --noEmit` 通过
- [ ] `pnpm lint` 通过

**Definition of Done**:
- 全部 8 条 AC 通过
- 三件套（test / tsc / lint）零错

**🚦 Checkpoint C（Slice 6 完成）**: 功能完整，准备 review + commit。

---

## 5. Risks & Mitigations

| 风险 | 触发场景 | 对策 |
|------|---------|------|
| `useSearchParams` 在 Next.js 16 须 Suspense | 直接用会运行时报错 | Slice 2 即引入 `<Suspense>` 包裹，fallback 是 grid skeleton |
| 频繁 URL 更新触发 `<Link>` 预取 / 路由刷新 | 输入时卡顿 | 用 `router.replace`（非 push）+ debounce + `{ scroll: false }` |
| 时区差异下 "Today" 边界不一致 | 跨时区分享 URL | 服务端不计算"today"；客户端按本地时区算 `startOfDay` |
| 列表过大时 useMemo 仍卡 | > 200 项 | 当前数据量小，不优化；spec §7 已记录 |
| 默认 order 处理出错（如切到 name 但 URL 还残留 `order=desc`） | URL 状态错位 | URL 解析时按 `sort` 推导 default，仅当 URL 显式不同才覆盖 |

---

## 6. Out of Scope（不动的代码）

- ❌ `lib/claude-data.ts` — 不动
- ❌ `getProjects()` 返回结构 — 不动
- ❌ `components/project-card.tsx` — 不动（样式、字段都不改）
- ❌ `components/project-list.tsx` — 不动（作为内部展示组件继续使用）
- ❌ `app/projects/[projectId]/page.tsx` — 不动（与项目详情页无关）

---

## 7. 验证手册（端到端）

完成 Slice 6 后按此清单走一遍即可宣布 done：

```bash
# 1. 三件套
pnpm test
pnpm tsc --noEmit
pnpm lint

# 2. 启动 dev server
pnpm dev
```

浏览器：

1. 访问 `/projects` —— 看到工具栏 + grid + 计数 `N projects · N shown`
2. 输入 "cc" —— 250ms 后 URL 加 `?q=cc`，grid 过滤，计数变 M shown 且着色
3. 时间下拉切 "Last 7 days" —— URL 加 `&period=7d`
4. 排序切 "Sessions" + 反序 —— URL 变 `&sort=sessions&order=asc`
5. 复制完整 URL 到新标签打开 —— 状态完整还原
6. 输入 "xyz123nothing" —— 显示空态 + Clear 按钮，点击回 `/projects`
7. Network 面板观察以上所有操作 —— 无 server data fetch

---

## 8. 文件清单（最终新增/修改）

| 操作 | 文件 |
|------|------|
| 新增 | `lib/project-filters.ts` |
| 新增 | `lib/project-filters.test.ts` |
| 新增 | `components/projects-view.tsx` |
| 新增 | `components/projects-toolbar.tsx` |
| 修改 | `app/projects/page.tsx`（替换 `<ProjectList>` → `<Suspense><ProjectsView/>`，标题计数下移） |
| 不动 | `components/project-list.tsx` |
| 不动 | `components/project-card.tsx` |
| 不动 | `lib/claude-data.ts` / `getProjects()` |
| 不动 | `types/claude.ts` / `ProjectInfo` |

新增 4 文件、修改 1 文件。最小变更面，零新依赖。
