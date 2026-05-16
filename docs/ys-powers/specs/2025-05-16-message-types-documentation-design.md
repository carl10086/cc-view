# Message Types 用户文档 Spec

## Objective

为 cc-view 项目创建一套完整的 Message Types 用户文档，以静态 HTML 页面形式呈现，帮助用户理解 Claude Code 会话中各种消息类型的含义和用途。

当前会话浏览器页面 (`/projects/:projectId`) 已能动态显示当前会话中存在的 `filterType`，但缺少对每种类型的详细说明。本 Spec 定义一个独立的静态文档页面，系统性地介绍所有消息类型。

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | 构建项目（包含静态页面） |
| `npm run dev` | 启动开发服务器预览文档页面 |

---

## Project Structure

```
app/
  docs/
    message-types/
      page.tsx              # Next.js 页面路由：/docs/message-types
components/
  docs/
    message-type-card.tsx   # 单类型说明卡片
    message-type-section.tsx # 类型分组区块
    attachment-type-table.tsx # Attachment 子类型表格
public/
  docs/
    message-types-meta.json # 类型元数据（用于生成静态内容）
```

---

## Code Style

- TypeScript + React + Tailwind CSS
- 使用 shadcn/ui 组件（Card, Badge, Table, Separator）
- 暗色/亮色主题自适应（`dark:` 前缀）
- 与现有 `typeConfig` 颜色体系保持一致

---

## Testing Strategy

- 视觉验证：启动 dev server，检查 `/docs/message-types` 页面渲染
- 内容验证：对照 refer 源码确认所有类型定义完整
- 响应式验证：在移动端和桌面端检查布局

---

## Feature: Message Types 文档页面

### 需求1：主要消息类型说明

页面顶部展示会话中所有主要 `filterType` 的说明卡片。

#### 类型清单（基于 `typeConfig` + 源码分析）

| filterType | Label | 颜色 | 说明 |
|-----------|-------|------|------|
| `user` | USER | 蓝色 | 用户发送的消息，包含文本、图片或文件输入 |
| `assistant` | (自定义) | 绿色 | AI 助手回复的消息，可能包含文本、工具调用或思考过程 |
| `system` | SYSTEM | 灰色 | 系统内部事件，包括信息提示、API 错误、紧凑边界等 |
| `attachment` | ATTACH | 琥珀色 | 钩子执行结果或技能列表等附加信息 |
| `last-prompt` | prompt | 灰色 | 最后一次发送给模型的完整提示词 |
| `permission-mode` | perms | 青色 | 权限模式变更记录 |
| `file-history-snapshot` | files | 绿色 | 文件历史快照，记录某时刻的文件状态 |
| `user-turn` | turns | 蓝色 | 用户对话轮次标记 |
| `queue-operation` | queue | 蓝色 | 队列操作记录，如任务排队、执行状态 |
| `ai-title` | title | 紫色 | AI 生成的会话标题 |

#### 卡片内容

每个卡片包含：
- Label Badge（带颜色）
- 类型名称（`filterType`）
- 详细说明：该类型在 Claude Code 中的具体作用
- 数据示例：该类型消息的典型 JSON 结构（可选折叠）

### 需求2：System Message 子类型说明

`system` 类型包含多个 `subtype`，需要单独说明。

#### System 子类型清单（基于 refer 源码）

| Subtype | 说明 |
|---------|------|
| `informational` | 一般信息提示，如操作完成通知 |
| `permission_retry` | 权限请求重试事件 |
| `bridge_status` | 与外部系统（如 IDE）连接状态变更 |
| `scheduled_task_fire` | 定时任务触发通知 |
| `stop_hook_summary` | Hook 停止执行后的摘要 |
| `turn_duration` | 单轮对话耗时统计 |
| `away_summary` | 用户离开期间的活动摘要 |
| `memory_saved` | 记忆保存确认（如重要信息被记录） |
| `agents_killed` | Agent 进程被终止通知 |
| `api_metrics` | API 调用指标（token 使用量、延迟等） |
| `local_command` | 本地命令执行状态 |
| `compact_boundary` | 会话紧凑化边界标记（上下文压缩点） |
| `microcompact_boundary` | 微紧凑化边界标记 |
| `api_error` | API 调用错误通知 |

### 需求3：Attachment 子类型分类说明

`attachment` 类型包含多种子类型，需要分类展示。

#### Attachment 分类体系

**A. Hook 相关附件**

| 子类型 | 说明 |
|--------|------|
| `hook_success` | Hook 执行成功，附带结果数据 |
| `hook_error_during_execution` | Hook 执行过程中发生错误 |
| `hook_non_blocking_error` | 非阻塞性错误，不影响主流程 |
| `hook_blocking_error` | 阻塞性错误，需要处理后才能继续 |
| `hook_cancelled` | Hook 被取消执行 |
| `hook_system_message` | 系统级别的 Hook 消息 |
| `hook_additional_context` | Hook 提供的额外上下文 |
| `hook_stopped_continuation` | Hook 停止后续执行 |
| `hook_permission_decision` | Hook 权限决策结果 |

**B. Skill 相关附件**

| 子类型 | 说明 |
|--------|------|
| `skill_listing` | 可用技能列表 |
| `skill_discovery` | 技能发现结果 |

**C. Agent 相关附件**

| 子类型 | 说明 |
|--------|------|
| `agent_listing_delta` | Agent 列表变更（增量更新） |
| `agent_mention` | Agent 被提及的事件 |

### 需求4：页面布局

```
+--------------------------------------------------+
|  Message Types 文档                                |
|  了解 Claude Code 会话中每种消息类型的含义          |
+--------------------------------------------------+
|                                                  |
|  ## 主要消息类型                                  |
|  +----------+ +----------+ +----------+         |
|  | user     | | assistant| | system   | ...     |
|  +----------+ +----------+ +----------+         |
|                                                  |
|  ## System Message 子类型                         |
|  +------------------------------------------+   |
|  | 表格：subtype | 说明 | 示例               |   |
|  +------------------------------------------+   |
|                                                  |
|  ## Attachment 子类型                             |
|  ### Hook 相关                                   |
|  +------------------------------------------+   |
|  | 表格...                                    |   |
|  +------------------------------------------+   |
|  ### Skill 相关                                  |
|  +------------------------------------------+   |
|  ### Agent 相关                                  |
|  +------------------------------------------+   |
|                                                  |
+--------------------------------------------------+
```

### 需求5：交互设计

- 卡片 hover 效果：轻微上浮 + 阴影加深
- 表格行 hover：背景色变化
- JSON 示例：可折叠展开（默认收起）
- 锚点导航：页面右侧显示目录，点击滚动到对应章节

---

## Boundaries

### Always Do
- 保持与现有 `typeConfig` 颜色定义一致
- 使用 Next.js App Router 的静态页面路由
- 暗色/亮色主题自适应
- 内容基于 refer 源码真实类型定义

### Ask First About
- 新增 `filterType` 类型时的同步更新策略
- 是否需要从 JSONL 文件自动生成类型文档

### Never Do
- 不要修改现有会话浏览器的过滤逻辑
- 不要添加未在源码中定义的类型
- 不要引入外部依赖（仅使用已有 shadcn/ui 组件）

---

## Acceptance Criteria

1. [ ] 访问 `/docs/message-types` 页面能正常渲染
2. [ ] 页面展示所有 10 种主要 `filterType` 的说明卡片
3. [ ] 页面展示所有 14 种 System Message 子类型
4. [ ] 页面展示所有 Attachment 子类型（按 Hook/Skill/Agent 分类）
5. [ ] 颜色与现有 `typeConfig` 定义一致
6. [ ] 暗色/亮色主题切换正常
7. [ ] 页面在移动端显示正常（响应式布局）

---

## References

- 当前项目类型定义：`types/claude.ts`
- 当前项目类型配置：`components/message/compact-message.tsx`
- Claude Code 源码类型：refer/src/utils/messages.ts, refer/src/utils/attachments.ts
