# Spec: Session 按时间批量删除

## Objective

在 SessionSidebar 中增加按时间筛选的批量删除功能，允许用户一次性删除多个符合条件的 session。

**用户故事：**
- 作为用户，我浏览 project 时积累了大量旧 session
- 我选择"3 天前"的时间范围，系统筛选出符合条件的 session
- 我勾选要删除的 session（默认全选），点击"批量删除"
- 系统弹出确认对话框，展示即将删除的 session 列表
- 确认后系统逐个删除，并显示操作结果

**验收标准：**
1. 时间筛选器支持：1 天 / 3 天 / 1 周 / 全部
2. 筛选后符合条件的 session 显示 checkbox
3. 支持全选 / 取消全选
4. 删除前弹出确认对话框，展示 session 列表
5. 删除过程中显示进度/loading 状态
6. 删除完成后更新 sidebar 列表

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui（复用现有组件风格）
- 原生 `<dialog>` 元素

## Commands

```bash
# 开发
npm run dev

# 构建
npm run build

# 测试
npm run test:run
```

## Project Structure

```
components/session-sidebar.tsx           # 修改：添加时间筛选器 + checkbox + 批量操作栏
components/session-batch-delete-dialog.tsx # 新增：批量删除确认对话框
components/time-filter-select.tsx          # 新增：时间筛选器组件
lib/claude-data.ts                         # 修改：新增批量删除逻辑（可选）
```

## Code Style

**时间筛选器组件：**
```tsx
interface TimeFilterSelectProps {
  value: string
  onChange: (value: string) => void
}

const TIME_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "1 天前", value: "1d" },
  { label: "3 天前", value: "3d" },
  { label: "1 周前", value: "1w" },
]
```

**批量删除对话框数据：**
```tsx
interface BatchDeleteDialogProps {
  sessions: SessionInfo[]
  onConfirm: () => void
  onCancel: () => void
}
```

**筛选逻辑：**
```tsx
function filterSessionsByTime(sessions: SessionInfo[], timeFilter: string): SessionInfo[] {
  if (timeFilter === "all") return sessions
  
  const now = Date.now()
  const thresholds: Record<string, number> = {
    "1d": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
  }
  
  const threshold = thresholds[timeFilter]
  return sessions.filter(s => now - s.lastModified.getTime() > threshold)
}
```

## Testing Strategy

**手动测试场景：**

| 场景 | 操作 | 预期结果 |
|------|------|---------|
| 时间筛选 | 选择"3 天前" | 只显示 lastModified > 3 天的 session，且显示 checkbox |
| 全选 | 点击"全选" | 所有符合条件的 session 被勾选 |
| 取消全选 | 再次点击"全选" | 所有 checkbox 取消勾选 |
| 部分选择 | 手动勾选 2 个 | "已选 2 项 · 批量删除"按钮可用 |
| 无选中 | 未勾选任何项 | 批量删除按钮禁用 |
| 确认删除 | 点击删除，确认 | 调用 API 逐个删除，对话框关闭，列表刷新 |
| 取消删除 | 点击取消 | 对话框关闭，不做任何操作 |

**单元测试（可选）：**
- `filterSessionsByTime` 函数边界测试

## Boundaries

- **Always：**
  - 操作前必须弹出确认对话框，展示将要删除的 session 列表
  - 只删除选中的 session，不删除未选中的
  - 保留单个 session 的删除按钮（hover 显示）
  - 删除过程中禁用操作，防止重复点击

- **Ask first：**
  - 是否需要在服务端新增批量删除 API（还是复用现有单个删除 API 逐个调用）
  - 是否需要添加软删除/回收站机制
  - 是否需要 undo 功能

- **Never：**
  - 删除正在运行（5 分钟内活跃）的 session
  - 不经过确认直接删除
  - 跨 worktree 批量删除（限制在当前 active worktree）

## Success Criteria

- [ ] Sidebar 顶部出现时间筛选器（全部 / 1 天 / 3 天 / 1 周）
- [ ] 选择非"全部"时，符合条件的 session 显示 checkbox
- [ ] 全选/取消全选功能正常工作
- [ ] 底部显示"已选 X 项 · 批量删除"按钮
- [ ] 点击批量删除弹出确认对话框，展示 session 列表
- [ ] 确认后逐个调用 DELETE API 删除选中的 session
- [ ] 删除完成后 sidebar 列表自动刷新
- [ ] 未选择任何 session 时，批量删除按钮禁用
- [ ] 单个 session 的删除功能不受影响
- [ ] TypeScript 无错误，构建成功

## Open Questions

1. 批量删除是调用现有单个删除 API 逐个删除，还是在服务端新增批量删除 API？
   → 建议先复用现有 API（简单），如果性能有瓶颈再考虑批量 API

2. 删除过程中如果某个 session 删除失败（如 409 活跃），如何处理？
   → 建议：跳过失败的，继续删除其他，最后汇总结果（成功 X 个，失败 Y 个）
