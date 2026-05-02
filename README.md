# cc-view

Claude Code 数据可视化仪表盘。读取本地 `~/.claude/projects/` 目录，展示项目列表、会话历史和消息流。

## 功能

- **项目列表**：浏览所有 Claude Code 项目，显示会话数量和最近活动时间
- **项目详情**：查看单个项目的元数据（名称、ID、会话数、最后活跃时间）
- **Worktree 切换**：支持在同一个项目的主目录和多个 git worktree 之间切换，每个 worktree 展示独立的会话列表
- **会话浏览**：按时间倒序列出项目的所有 `.jsonl` 会话文件
- **消息流**：分页加载会话中的消息，展示 AI 和用户的完整对话历史
- **消息详情**：展开查看单条消息的原始 JSON 数据结构

## 技术栈

- Next.js 16 + React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- date-fns
- lucide-react

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看效果。

构建生产版本：

```bash
npm run build
```

## 项目结构

```
app/                    # Next.js App Router 页面
  page.tsx              # 首页（重定向到 /projects）
  projects/
    page.tsx            # 项目列表页
    [projectId]/        # 项目详情页（动态路由）
      page.tsx
  api/                  # API 路由
    projects/
      [projectId]/
        sessions/
          [sessionId]/route.ts

components/             # React 组件
  project-card.tsx      # 项目卡片
  session-browser.tsx   # 会话浏览器（客户端组件）
  session-sidebar.tsx   # 会话侧边栏
  message-stream.tsx    # 消息流
  message-card.tsx      # 单条消息卡片

lib/                    # 工具函数和数据层
  claude-data.ts        # 文件系统数据读取层
  claude-data.test.ts   # 数据层测试
  worktree.ts           # Worktree ID 构建工具
  utils.ts              # 通用工具函数

types/                  # TypeScript 类型定义
  claude.ts             # 项目、会话、消息类型
```

## 数据来源

本项目读取本地文件系统 `~/.claude/projects/` 目录下的数据：

- 每个子目录代表一个项目
- 目录名格式为 `-Users-{username}-{path}`，编码了原始项目路径
- `.jsonl` 文件是会话记录，每行一个 JSON 对象
- Worktree 目录名格式为 `{mainId}--claude-worktrees-{worktreeName}`

## 测试

```bash
npm test
```

当前测试覆盖数据层的安全校验（path traversal 防护）、分页逻辑和 worktree ID 构建。

## 开发约定

- 使用 `/` 开头的技能命令（如 `/spec`、`/plan`、`/build`、`/review`、`/ship`）进行结构化开发
- 设计文档保存在 `docs/ys-powers/specs/` 和 `docs/ys-powers/plans/`
- `refer/` 目录为三方参考项目的软链接（已加入 `.gitignore`）
