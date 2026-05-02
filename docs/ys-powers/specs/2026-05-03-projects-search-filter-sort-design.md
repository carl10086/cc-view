# Projects 列表搜索 / 过滤 / 排序设计

- **状态**：Draft
- **创建日期**：2026-05-03
- **目标分支**：`feat/projects-search-filter-sort`
- **影响页面**：`http://localhost:3000/projects`

---

## 1. Objective（目标）

为 `/projects` 列表页增加客户端搜索、最近活跃过滤、多维排序能力，提升用户在项目较多时的查找效率。所有交互状态写入 URL query params，使搜索结果可分享、可刷新保留。

### 1.1 用户故事

- 作为用户，我希望能按项目名称模糊搜索，快速定位特定项目
- 作为用户，我希望能按"最近活跃时间"过滤，专注于近期在用的项目
- 作为用户，我希望能切换排序维度（最近活跃 / Session 数量 / 名称），按需排列
- 作为用户，我希望刷新或分享 URL 后，搜索/过滤/排序状态保持不变

### 1.2 Acceptance Criteria（验收标准）

| # | 条件 | 验证方式 |
|---|------|----------|
| AC-1 | 工具栏在 `/projects` 顶部渲染，包含搜索框、时间过滤下拉、排序下拉 | 浏览器目视 + DOM 检查 |
| AC-2 | 搜索框输入大小写不敏感子串，列表实时过滤；输入有 250ms debounce | 键入 "PROJ" / "proj" 结果一致；高频输入不卡顿 |
| AC-3 | 时间过滤 5 档：`Any time` / `Today` / `Last 7 days` / `Last 30 days` / `Last 90 days`，过滤依据 `lastModified` | 切换档位，列表只剩对应区间项目 |
| AC-4 | 排序维度 3 个：`Recent`（默认 `lastModified` desc）/ `Sessions`（`sessionCount` desc）/ `Name`（A-Z），每项可切升降序 | 切换并目视确认顺序 |
| AC-5 | URL 同步：`?q=&period=&sort=&order=`；刷新后 UI 状态完全还原 | URL 复制到新标签验证 |
| AC-6 | 计数文案显示 `N projects · M shown`；M 等于过滤后数量；M < N 时颜色提示 | 目视 |
| AC-7 | 当过滤结果为 0 时，显示空态提示并提供"清除过滤"按钮 | 输入不存在的关键词验证 |
| AC-8 | 工具栏操作不触发 SSR 重新请求（getProjects 不重复调用） | 浏览器 Network 面板观察 |

### 1.3 Out of Scope（不在范围内）

- 服务端分页 / 服务端过滤
- 多关键词、AND / OR 组合、正则搜索
- Worktree 维度过滤、Session 数量范围过滤
- 持久化用户偏好到 localStorage
- 移动端独立设计（沿用现有响应式 grid）

---

## 2. Commands（开发与验证命令）

```bash
# 安装依赖（如有需要）
pnpm install

# 启动 dev server
pnpm dev
# → 浏览器访问 http://localhost:3000/projects

# 类型检查
pnpm tsc --noEmit

# Lint
pnpm lint

# 测试（已有 vitest 在 lib/claude-data.test.ts）
pnpm test
```

---

## 3. Project Structure（文件结构与改动）

### 3.1 新增文件

| 文件 | 职责 |
|------|------|
| `lib/project-filters.ts` | 纯函数：`filterProjects()` / `sortProjects()` / 类型 `Period` `SortKey` `SortOrder`；URL params parse / serialize |
| `lib/project-filters.test.ts` | 上述纯函数的 vitest 单测 |
| `components/projects-toolbar.tsx` | Client Component：搜索框 + 时间下拉 + 排序下拉；通过 `useRouter` + `useSearchParams` 同步 URL |
| `components/projects-view.tsx` | Client Component：接收完整 `projects[]`，读 URL state 后调用 filter/sort，再渲染 `ProjectList` 与计数 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `app/projects/page.tsx` | 仍保持 server component；将 `<ProjectList>` 替换为 `<ProjectsView projects={projects} />`；标题计数移至 `ProjectsView` 内（因为依赖过滤后数量） |
| `components/project-list.tsx` | 不变（或仅小调整：空态文案保留，但当过滤导致空时由 `ProjectsView` 自定义渲染，不走 `ProjectList` 内置空态） |

### 3.3 数据流

```
app/projects/page.tsx (Server)
   │ getProjects() → ProjectInfo[]
   ▼
components/projects-view.tsx (Client)
   │ useSearchParams() → { q, period, sort, order }
   │ filterProjects(projects, { q, period })
   │ sortProjects(filtered, { sort, order })
   ├──► components/projects-toolbar.tsx (受控，更新 URL)
   └──► components/project-list.tsx (展示 grid)
```

### 3.4 URL Schema

| 参数 | 取值 | 默认（省略时） |
|------|------|---------|
| `q` | 任意字符串（trim 后非空） | 无搜索 |
| `period` | `today` / `7d` / `30d` / `90d` | `any`（不写入 URL） |
| `sort` | `recent` / `sessions` / `name` | `recent`（不写入 URL） |
| `order` | `asc` / `desc` | sort=recent/sessions 默认 desc，sort=name 默认 asc（默认值不写入 URL） |

> 设计原则：默认值不写入 URL，保持 URL 简洁；只显式写非默认值。

---

## 4. Code Style（代码风格）

- **TypeScript**：严格类型；导出的字面量联合类型用 `as const` + `typeof` 派生
- **组件**：纯函数 + props，避免内部副作用；`projects-toolbar.tsx` / `projects-view.tsx` 顶部加 `"use client"`
- **样式**：沿用 Tailwind v4 + shadcn/ui 既有组件（`Input` / `Select` / `Button`）；不引入新的 UI 库
- **state**：URL 是单一事实源；toolbar 不维护本地 state（除搜索框 debounce 中间态）
- **debounce**：250ms，使用简单的 `useEffect + setTimeout` 实现，不引入 lodash
- **命名**：`kebab-case` 文件名；导出 `PascalCase` 组件 / `camelCase` 函数
- **不写注释解释 what**，仅在不直观处加 why（参考 `.claude/rules/code.md`）

---

## 5. Testing Strategy（测试策略）

### 5.1 单元测试（必须）

`lib/project-filters.test.ts` 覆盖：

- `filterProjects`：
  - 空 query 返回原数组
  - query 大小写不敏感
  - query 包含特殊字符（`.` `-` `_`）
  - period 边界：今天 0 点 / 7 天前同一时刻 / 90 天前
  - 组合：query + period
- `sortProjects`：
  - 三种 sort key × 升降序，共 6 种组合
  - 同值时保持稳定（lastModified 相同则不交换）
- URL params 序列化 / 解析：
  - 默认值不写入
  - 非法值（如 `period=foo`）回退到默认
  - 双向往返（serialize → parse 还原一致）

### 5.2 浏览器手动验证（必须）

按 §1.2 的 AC-1 ~ AC-8 在 dev server 上逐项点过：

- [ ] 工具栏渲染正常
- [ ] 搜索大小写不敏感 + debounce 顺滑
- [ ] 5 档时间过滤生效
- [ ] 3 维度排序生效，可切升降序
- [ ] URL 同步：刷新还原、复制到新标签还原
- [ ] 计数文案准确
- [ ] 空过滤结果显示空态 + 清除按钮
- [ ] toolbar 操作不触发 page-level SSR refetch（Network 面板观察）

### 5.3 不需要测试的项

- `ProjectsView` / `ProjectsToolbar` 组件渲染快照（视觉变化频繁，价值低）
- 跨浏览器兼容（沿用项目既有约定）

---

## 6. Boundaries（边界）

### 6.1 Always do（必须做）

- ✅ 客户端 filter / sort 用纯函数 + 单测覆盖
- ✅ URL 是状态单一事实源；刷新可还原
- ✅ 工具栏使用 shadcn/ui 已有组件（`Input` / `Select`），保持视觉一致
- ✅ 类型严格：`Period` / `SortKey` / `SortOrder` 为字面量联合
- ✅ 修改前先验收 acceptance criteria 全部通过

### 6.2 Ask first（先问再动）

- ❓ 引入任何新依赖（包括 lodash、fuse.js、qs 等）
- ❓ 修改 `lib/claude-data.ts` 或 `getProjects()` 的返回结构
- ❓ 改 URL Schema（参数名、取值集合）
- ❓ 把工具栏样式偏离单行布局（如改为折叠面板）
- ❓ 增加范围之外的过滤/排序维度

### 6.3 Never do（绝不做）

- ❌ 不在客户端组件里 fetch 项目数据；数据仍由 server component 拿
- ❌ 不写 localStorage / sessionStorage 持久化
- ❌ 不引入 fuzzy match 库（用 `String.prototype.includes` 即可）
- ❌ 不改 `ProjectCard` 的视觉与字段
- ❌ 不在过滤函数里产生副作用（log / 网络请求等）
- ❌ 不"顺手"重构 `ProjectList` / `ProjectCard` 的不相关代码

---

## 7. Risks & Mitigations（风险与对策）

| 风险 | 对策 |
|------|------|
| `useSearchParams` 在 Next.js 16 下需要 Suspense 边界 | `ProjectsView` 用 `<Suspense>` 包裹（在 `app/projects/page.tsx` 中）；fallback 渲染 grid 骨架 |
| URL 频繁更新触发路由刷新 | 用 `router.replace(url, { scroll: false })`；搜索 debounce 后再写 URL |
| 大量项目下排序卡顿 | 当前 projects 量级小（个位/十位数）；先 baseline 不优化；如未来 > 200 项再考虑 useMemo |
| 时区差异导致 "Today" 边界不一致 | 用 `new Date()` 本地时区计算 `startOfDay`；不依赖 UTC |

---

## 8. Open Questions（待定）

暂无。所有关键点已在 §1-§6 锁定。如实施过程中遇到歧义，按 §6.2 处理。
