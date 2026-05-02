---
title: Projects 列表页开发计划
date: 2026-05-02
feature: projects-list-page
spec: ../specs/2026-05-02-projects-list-page-design.md
author: Claude
status: draft
---

## 依赖关系图

```
┌─────────────────┐     ┌─────────────────┐
│   types/claude  │────▶│ lib/claude-data │
│   .ts           │     │ .ts             │
└─────────────────┘     └────────┬────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ app/projects/ │      │ app/projects/   │      │ app/layout.tsx  │
│ page.tsx      │      │ [id]/page.tsx   │      │ (导航栏)        │
│ (列表页)      │      │ (详情页占位)    │      │                 │
└───────┬───────┘      └─────────────────┘      └─────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  components/project-list.tsx            │
│  components/project-card.tsx            │
│  components/ui/* (shadcn/ui)            │
└─────────────────────────────────────────┘
```

**依赖规则**：下层模块不依赖上层；同层可并行。

---

## 任务列表（垂直切片）

### Task 1: 初始化 Next.js 15 项目 + shadcn/ui

**目标**：搭建项目骨架，能运行开发服务器。

**文件变更**：
- `package.json` — 依赖管理
- `next.config.ts` — Next.js 配置
- `tsconfig.json` — TypeScript 配置
- `tailwind.config.ts` — Tailwind 配置
- `app/globals.css` — 全局样式
- `app/layout.tsx` — 根布局（基础版，无导航）
- `app/page.tsx` — 首页占位
- `components/ui/` — shadcn/ui 初始化

**执行步骤**：
1. `bun create next-app@latest .`（或等效手动初始化）
2. `npx shadcn@latest init` — 初始化 shadcn/ui
3. 配置 Tailwind + TypeScript
4. 验证 `bun run dev` 在 `http://localhost:3000` 正常显示

**验收标准**：
- [ ] `bun run dev` 启动无报错
- [ ] 浏览器访问 `http://localhost:3000` 看到 Next.js 默认欢迎页
- [ ] `bun run build` 构建成功
- [ ] shadcn/ui 命令可用（`npx shadcn add button` 测试）

**验证命令**：
```bash
curl -s http://localhost:3000 | grep -q "Next.js" && echo "OK"
```

---

### Task 2: 类型定义 + 数据层实现

**目标**：封装读取 `~/.claude/projects/` 的数据层，可被上层复用。

**文件变更**：
- `types/claude.ts` — `ProjectInfo` 等类型
- `lib/claude-data.ts` — `getProjects()`, `getProjectById()`
- `lib/claude-data.test.ts` — 单元测试（可选，如测试框架就绪）

**执行步骤**：
1. 定义 `ProjectInfo` 接口（id, name, path, sessionCount, lastModified）
2. 实现 `getProjects()`：
   - 读取 `~/.claude/projects/`
   - 过滤隐藏文件（`.` 开头）
   - 对每个目录：
     - `fs.stat()` 获取 `lastModified`
     - 读取 `sessions/` 子目录数（不存在则 0）
     - 解析显示名（目录名最后一段，如 `cc-view`）
   - 按 `lastModified` 倒序排序
3. 实现 `getProjectById()`
4. 错误处理：目录不存在返回 `[]`，单个项目读取失败跳过不打断整体

**验收标准**：
- [ ] `getProjects()` 返回正确类型的数组
- [ ] 项目名解析正确（`-Users-carlyu-soft-projects-cc-view` → `cc-view`）
- [ ] session 数量统计正确
- [ ] 按最后修改时间倒序排列
- [ ] 空目录返回 `[]`
- [ ] 异常目录（无权限、非目录）被跳过，不抛错

**验证方式**：
```typescript
// 在临时脚本中测试
import { getProjects } from './lib/claude-data'
const projects = await getProjects()
console.log(projects.length > 0, projects[0].name, projects[0].sessionCount)
```

---

### Checkpoint 1（检查点）

**进入条件**：Task 1 和 Task 2 均完成。
**检查内容**：
- 项目能跑起来 ✓
- 能正确读取本地数据 ✓
- 数据类型完整 ✓

**通过后**：进入 UI 开发阶段。

---

### Task 3: 全局布局 + 导航栏

**目标**：所有页面共享的导航和视觉框架。

**文件变更**：
- `app/layout.tsx` — 根布局（加导航栏）
- `app/globals.css` — 确保 Tailwind + shadcn 主题正确

**执行步骤**：
1. 更新 `layout.tsx`：
   - html + body 基础结构
   - 顶部导航栏：Logo（cc-view）+ 链接（Projects）
   - 使用 shadcn 的导航组件或自定义
2. 移动端适配：导航栏折叠或简化

**验收标准**：
- [ ] 所有页面顶部有统一导航栏
- [ ] 导航栏包含 "Projects" 链接指向 `/projects`
- [ ] 移动端不溢出

**验证方式**：浏览器访问 `/` 和 `/projects`，导航栏一致显示。

---

### Task 4: Projects 列表页核心 UI

**目标**：实现 `/projects` 页面，展示项目卡片列表。

**文件变更**：
- `app/projects/page.tsx` — 列表页（Server Component）
- `components/project-list.tsx` — 列表容器
- `components/project-card.tsx` — 项目卡片（Client Component）
- `components/ui/card.tsx`, `badge.tsx`, `skeleton.tsx` — shadcn/ui 组件

**执行步骤**：
1. 安装 shadcn/ui 组件：`npx shadcn add card badge skeleton`
2. 创建 `project-card.tsx`：
   - Props: `ProjectInfo`
   - 展示：项目名称（大标题）、session badge（如 "5 sessions"）、相对时间（"2天前"）
   - 整卡可点击，链接到 `/projects/[id]`
   - hover 效果（阴影/边框）
3. 创建 `project-list.tsx`：
   - 接收 `projects: ProjectInfo[]`
   - 网格布局：`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
   - 空状态处理
4. 创建 `app/projects/page.tsx`：
   - async Server Component
   - 调用 `getProjects()`
   - 渲染 `ProjectList`
   - 加载态用 `Skeleton`

**验收标准**：
- [ ] `/projects` 页面正常渲染
- [ ] 项目卡片展示正确信息（名称、session 数、时间）
- [ ] 响应式：手机单列，平板双列，桌面三列
- [ ] 卡片可点击进入详情页
- [ ] 无项目时展示空状态 UI
- [ ] 加载时有 Skeleton 占位

**验证方式**：浏览器访问 `/projects`，检查卡片数量、内容、点击跳转。

---

### Task 5: 项目详情页（占位）

**目标**：实现 `/projects/[projectId]` 路由，点击卡片有反馈。

**文件变更**：
- `app/projects/[projectId]/page.tsx` — 详情页

**执行步骤**：
1. 创建动态路由目录 `app/projects/[projectId]/`
2. `page.tsx`：
   - async Server Component，接收 `{ params: { projectId } }`
   - URL-decode `projectId`
   - 调用 `getProjectById()`
   - 展示：项目显示名、原始目录名、session 数量、最后修改时间
   - 返回按钮链接到 `/projects`
3. 未找到项目时展示 404 风格页面

**验收标准**：
- [ ] 点击卡片正确跳转到 `/projects/[projectId]`
- [ ] 页面展示项目基本信息
- [ ] 项目不存在时展示友好错误页面
- [ ] URL 中特殊字符正确处理（encode/decode）

**验证方式**：
- 从 `/projects` 点击卡片跳转
- 直接访问 `/projects/不存在的ID` 看错误页面

---

### Checkpoint 2（检查点）

**进入条件**：Task 3、4、5 均完成。
**检查内容**：
- 页面跳转流畅 ✓
- UI 视觉正常 ✓
- 数据展示正确 ✓

**通过后**：进入收尾阶段。

---

### Task 6: 首页 + 错误处理 + 视觉调优

**目标**：完善用户体验，处理边界情况。

**文件变更**：
- `app/page.tsx` — 首页（重定向到 `/projects` 或展示概览）
- `app/error.tsx` — 错误边界（`~/.claude` 目录不存在时的友好提示）
- `app/projects/error.tsx` — 项目页错误边界
- `lib/utils.ts` — 辅助函数（如时间格式化）

**执行步骤**：
1. 更新 `app/page.tsx`：
   - 方案 A：Server Component 重定向到 `/projects`
   - 方案 B：展示欢迎页 + "进入 Projects" 按钮
   - **建议**：先做 B（有信息量），后续可改 A
2. 创建 `app/error.tsx`：
   - "无法读取 Claude Code 数据" 提示
   - 检查 `~/.claude/projects/` 是否存在
3. 时间格式化：
   - 安装 `date-fns`
   - 封装 `formatRelativeTime(date: Date): string`
4. 视觉调优：
   - 卡片间距、阴影、颜色微调
   - 空状态图标和文案

**验收标准**：
- [ ] 首页有内容（非空白），能引导到 Projects
- [ ] `~/.claude` 目录不存在时展示错误提示（不 crash）
- [ ] 时间显示为相对时间（"2天前"、"1小时前"）
- [ ] 空状态有图标 + 文案

**验证方式**：
- 临时重命名 `~/.claude` 目录，刷新页面看错误提示
- 恢复后正常展示

---

## 执行顺序

```
Task 1 (初始化项目)
    │
    ▼
Task 2 (数据层)
    │
    ├──▶ Checkpoint 1
    │
    ▼
Task 3 (布局+导航) ───┐
    │                  │
    ▼                  │
Task 4 (列表页) ◀──────┘  (Task 3 和 4 可轻微并行，但 4 依赖布局)
    │
    ▼
Task 5 (详情页)
    │
    ├──▶ Checkpoint 2
    │
    ▼
Task 6 (收尾)
```

---

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| `~/.claude` 目录权限问题 | Task 2 失败 | 错误处理：无权限时返回空数组，error.tsx 提示 |
| `bun create next-app` 与现有 `.git` 冲突 | Task 1 失败 | 手动初始化，不覆盖 `.git` |
| shadcn/ui 初始化失败 | Task 1/4 受阻 | fallback 到纯 Tailwind 组件 |
| 项目目录名含特殊字符 | Task 4/5 URL 错误 | 严格 encode/decode，加测试 |

---

## 完成定义（Definition of Done）

- [ ] 所有 6 个 Task 完成
- [ ] 两个 Checkpoint 通过
- [ ] 浏览器手动验证：/projects 能看到正确的项目卡片
- [ ] `bun run build` 构建成功
- [ ] 无 TypeScript 类型错误
- [ ] `~/.claude` 目录只读，无写入
