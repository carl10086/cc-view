---
title: Projects 列表页设计 Spec
date: 2026-05-02
feature: projects-list-page
author: Claude
status: draft
---

## 1. Objective

### 目标
构建 cc-view 的第一个可交付页面：Projects 列表页。该页面读取 `~/.claude/projects/` 目录，展示用户所有使用过的 Claude Code 项目，以卡片形式呈现关键信息。

### 用户价值
- 一目了然查看所有 Claude Code 项目
- 快速了解每个项目的活跃程度（session 数量、最后修改时间）
- 作为入口点击进入项目详情页，进一步查看 sessions

### Acceptance Criteria（验收标准）
- [ ] 页面路径 `/projects` 可正常访问
- [ ] 正确读取 `~/.claude/projects/` 下的所有项目目录
- [ ] 每个项目展示：名称（目录名）、最后修改时间、session 数量
- [ ] 项目卡片可点击进入 `/projects/[id]`（详情页可留空或展示占位信息）
- [ ] 空状态处理：当没有项目时展示友好提示
- [ ] 响应式布局：桌面端网格卡片，移动端单列
- [ ] TypeScript 类型完整，无 `any`

---

## 2. Commands

### 开发命令

```bash
# 安装依赖
bun install

# 开发服务器
bun run dev

# 类型检查
bun run type-check

# 构建
bun run build

# 启动生产服务器
bun run start
```

### shadcn/ui 组件安装

```bash
npx shadcn add card
npx shadcn add badge
npx shadcn add skeleton
```

---

## 3. Project Structure

本需求涉及的新增/修改文件：

```
cc-view/
├── app/
│   ├── layout.tsx              # 根布局：添加全局导航栏（Logo + 导航链接）
│   ├── page.tsx                # 首页：重定向到 /projects 或展示欢迎页
│   ├── globals.css             # Tailwind 指令 + 基础样式
│   ├── projects/
│   │   └── page.tsx            # Projects 列表页（Server Component）
│   └── projects/[projectId]/
│       └── page.tsx            # 项目详情页（占位，展示项目名称即可）
│
├── lib/
│   └── claude-data.ts          # 核心数据层：读取 ~/.claude/projects/ 的函数
│
├── components/
│   ├── ui/                     # shadcn/ui 组件（自动生成）
│   ├── project-card.tsx        # 项目卡片组件（Client Component）
│   └── project-list.tsx        # 项目列表容器（Server Component）
│
├── types/
│   └── claude.ts               # Claude 相关类型定义
│
├── next.config.ts              # Next.js 配置（output: standalone 预留）
├── tailwind.config.ts          # Tailwind 配置
└── tsconfig.json               # TypeScript 配置
```

---

## 4. Code Style

### 通用规范
- **语言**：TypeScript，严格模式开启
- **组件**：优先使用 Server Component（`async function`），需要交互再用 `"use client"`
- **导入顺序**：React/Next → 第三方库 → 本地组件 → 本地工具 → 类型
- **命名**：组件 PascalCase，函数/变量 camelCase，常量 UPPER_SNAKE_CASE
- **文件命名**：页面用 `page.tsx`，布局用 `layout.tsx`，组件用 `kebab-case.tsx`

### 数据层规范（`lib/claude-data.ts`）
```typescript
// 所有文件系统操作集中在此模块
// 不直接在任何 page.tsx 里使用 fs

export interface ProjectInfo {
  id: string;           // 目录名作为 ID
  name: string;         // 显示名称（做适当美化）
  path: string;         // 完整路径
  sessionCount: number; // sessions/ 目录下的子目录数量
  lastModified: Date;   // 目录最后修改时间
}

export async function getProjects(): Promise<ProjectInfo[]>
export async function getProjectById(id: string): Promise<ProjectInfo | null>
```

### 组件规范
- Props 必须显式定义接口
- 不用 `any`，不用 `@ts-ignore`
- Client Component 尽量小，把数据获取留给 Server Component

---

## 5. Testing Strategy

### 本需求测试范围

| 类型 | 内容 | 优先级 |
|------|------|--------|
| 单元测试 | `lib/claude-data.ts` 中的数据解析函数 | P1 |
| 集成测试 | `/projects` 页面渲染，包含真实文件读取 | P2 |
| 视觉测试 | 卡片布局、空状态、响应式 | P3（手动验证） |

### 测试命令

```bash
# 运行单元测试
bun test

# 运行特定文件
bun test lib/claude-data.test.ts
```

### 关键测试用例
1. `getProjects()` 正确返回项目数组，按最后修改时间倒序
2. `getProjects()` 处理空目录返回 `[]`
3. `getProjectById()` 存在时返回数据，不存在返回 `null`
4. 项目名包含特殊字符时正确处理

---

## 6. Boundaries

### 必须做的（Always Do）
- [ ] 所有 `fs` 操作必须在 `lib/claude-data.ts` 中封装
- [ ] Server Component 中直接调用数据层函数（不走 API Route）
- [ ] 项目 ID 使用原始目录名（URL-encoded 处理特殊字符）
- [ ] 错误边界处理：`fs` 读取失败时展示错误 UI，不 crash

### 必须先问再做（Ask First）
- 修改 `~/.claude` 目录结构或写入任何文件
- 引入除 shadcn/ui 之外的 UI 库
- 添加用户认证或访问控制

### 绝对不做（Never Do）
- [ ] 不写入 `~/.claude` 任何文件（只读）
- [ ] 不暴露用户敏感路径（如 home 目录绝对路径，只展示相对名）
- [ ] 不在 Client Component 中直接 `fs` 读取
- [ ] 不添加本需求以外的页面或功能（如 settings、telemetry）

---

## 7. Data Flow

```
用户访问 /projects
    │
    ▼
app/projects/page.tsx (Server Component)
    │
    ▼
lib/claude-data.ts: getProjects()
    │
    ▼
fs.readdir("~/.claude/projects/")
fs.stat() 获取修改时间
fs.readdir("sessions/") 获取数量
    │
    ▼
返回 ProjectInfo[]
    │
    ▼
Server Component 渲染 HTML
    │
    ▼
浏览器展示卡片列表
```

---

## 8. UI 设计

### 页面布局
```
┌─────────────────────────────────────┐
│  Logo    Projects   Sessions   Settings │  ← 导航栏
├─────────────────────────────────────┤
│                                     │
│  Projects (12)                      │  ← 页面标题 + 数量
│                                     │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ cc-view  │ │ cc-code  │ │ cc-... │ │  ← 项目卡片网格
│  │ 5 sessions│ │ 12 ses...│ │ ...    │ │
│  │ 2天前    │ │ 1周前    │ │ ...    │ │
│  └──────────┘ └──────────┘ └────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### 卡片元素
- **标题**：项目显示名称（目录名做简短处理）
- **Badge**：session 数量（如 "5 sessions"）
- **元信息**：最后修改时间（相对时间，如 "2天前"）
- **交互**：整卡可点击，hover 有阴影/边框高亮

### 空状态
```
┌─────────────────────────────────────┐
│                                     │
│           📁                        │
│      暂无项目                       │
│   还没有使用过 Claude Code          │
│                                     │
└─────────────────────────────────────┘
```

---

## 9. Dependencies

### 核心依赖（create-next-app 自带）
- next
- react
- react-dom
- typescript
- tailwindcss

### 需额外安装
- `date-fns` — 相对时间格式化（lastModified → "2天前"）
- `lucide-react` — 图标（shadcn/ui 已依赖）

### shadcn/ui 组件
- card
- badge
- skeleton（加载状态）

---

## 10. Notes

### 关于 `~/.claude/projects/` 的结构
实际目录名示例：`-Users-carlyu-soft-projects-cc-view`
- ID 直接使用此字符串（URL 中需要做 encodeURIComponent）
- 显示名称可以去除前缀 `-Users-carlyu-` 做简化，但保留完整名作为 fallback

### 关于 session 数量统计
当前先简单统计 `~/.claude/projects/[id]/sessions/` 下的子目录数量。后续可以深化为读取 `history.jsonl` 获取更准确的消息数。

### 性能考虑
- `~/.claude/projects/` 下项目数通常 < 100，直接 `fs` 读取即可，无需缓存
- 如有性能问题，后续可加 `unstable_cache` 或文件监听
