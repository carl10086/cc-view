# Plan: Session 按时间批量删除

## 概述

在 SessionSidebar 中增加按时间筛选的批量删除功能。

**任务数量**：4 个
**预计时间**：1-2 小时
**分支**：`feat/batch-delete-sessions-by-time`

---

## 任务拆分（垂直切片）

### 任务 1：创建时间筛选器组件

**文件**：`components/time-filter-select.tsx`（新建）

**内容**：
- 定义 `TIME_OPTIONS` 常量（全部 / 1 天 / 3 天 / 1 周）
- 实现 select 下拉组件
- 导出 `TimeFilterSelectProps` 类型

**验收标准**：
- [ ] 组件渲染 4 个选项
- [ ] 选择后能触发 `onChange` 回调
- [ ] 样式与现有 UI 一致（shadcn select 风格）

**验证方式**：
```bash
# 类型检查
npx tsc --noEmit
```

**依赖**：无

---

### 任务 2：创建批量删除确认对话框

**文件**：`components/session-batch-delete-dialog.tsx`（新建）

**内容**：
- 复用现有 `session-delete-dialog.tsx` 的 dialog 模式
- 展示将要删除的 session 列表（标题或 ID）
- Confirm / Cancel 按钮
- 支持删除中的 loading 状态

**验收标准**：
- [ ] 对话框正确展示 session 列表
- [ ] 点击 Cancel 关闭对话框
- [ ] 点击 Confirm 触发 `onConfirm` 回调
- [ ] 删除过程中按钮禁用并显示 loading

**验证方式**：
```bash
npx tsc --noEmit
```

**依赖**：无

---

### 任务 3：Sidebar 集成时间筛选 + checkbox + 批量操作

**文件**：`components/session-sidebar.tsx`（修改）

**内容**：
1. **添加时间筛选器**：在 "Sessions" 标题下方插入 `TimeFilterSelect`
2. **添加筛选状态**：`timeFilter` state，默认 "all"
3. **添加 checkbox 显示逻辑**：当 `timeFilter !== "all"` 时，符合条件的 session 显示 checkbox
4. **添加选中状态**：`selectedSessionIds: Set<string>`
5. **添加全选/取消全选**：按钮 + 逻辑
6. **添加批量操作栏**：底部显示 "已选 X 项 · 批量删除"
7. **集成确认对话框**：点击批量删除时打开 `SessionBatchDeleteDialog`

**关键逻辑**：
```tsx
const filteredSessions = useMemo(() => {
  if (timeFilter === "all") return sessions
  // 按时间筛选
}, [sessions, timeFilter])

const selectableSessions = useMemo(() => {
  // 只返回符合时间条件的
}, [filteredSessions])
```

**验收标准**：
- [ ] 时间筛选器显示在 Sessions 标题下方
- [ ] 选择非"全部"时，checkbox 出现
- [ ] 全选/取消全选功能正常
- [ ] 底部批量操作栏显示正确
- [ ] 未选中时批量删除按钮禁用
- [ ] 单个 session 删除按钮不受影响

**验证方式**：
```bash
npm run build
# 手动测试：dev 模式下验证 UI 交互
```

**依赖**：任务 1（时间筛选器组件）

---

### 任务 4：批量删除 API 调用 + 结果处理

**文件**：`components/session-browser.tsx`（修改）+ `components/session-sidebar.tsx`（修改，传递 callback）

**内容**：
1. 在 `SessionBrowser` 中实现 `handleBatchDelete` 函数
2. 逐个调用 `DELETE /api/projects/.../sessions/...`
3. 处理成功/失败：
   - 成功：从 `currentSessions` 中移除
   - 失败（409 活跃）：记录失败，继续下一个
   - 其他错误：记录失败
4. 删除完成后显示结果（alert 或 toast）
5. 重置选中状态

**伪代码**：
```tsx
async function handleBatchDelete(sessionIds: string[]) {
  const results = { success: 0, failed: 0, errors: [] }
  
  for (const id of sessionIds) {
    try {
      const res = await fetch(`/api/.../sessions/${id}`, { method: "DELETE" })
      if (res.status === 204) {
        results.success++
        setCurrentSessions(prev => prev.filter(s => s.id !== id))
      } else {
        results.failed++
      }
    } catch {
      results.failed++
    }
  }
  
  alert(`删除完成：成功 ${results.success} 个，失败 ${results.failed} 个`)
}
```

**验收标准**：
- [ ] 逐个调用 DELETE API
- [ ] 删除成功的 session 从列表中移除
- [ ] 删除失败的不阻断其他删除
- [ ] 完成后显示结果汇总
- [ ] 选中状态被重置

**验证方式**：
```bash
npm run build
# 手动测试：创建多个旧 session，批量删除验证
```

**依赖**：任务 3（Sidebar 的批量操作 UI）

---

## 依赖关系图

```
任务 1: 时间筛选器组件
  ↓
任务 2: 批量删除对话框
  ↓
任务 3: Sidebar 集成 UI
  ↓
任务 4: 批量删除 API 调用
```

**说明**：
- 任务 1 和 2 可以并行开发（无依赖）
- 任务 3 依赖任务 1
- 任务 4 依赖任务 3

---

## Checkpoints

- **Checkpoint 1**（任务 1-2 完成后）：UI 组件可独立渲染，类型检查通过
- **Checkpoint 2**（任务 3 完成后）：完整 UI 流程可交互，手动测试筛选/全选/对话框
- **Checkpoint 3**（任务 4 完成后）：端到端流程完整，可实际删除 session

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 逐个删除 API 性能差（大量 session） | 高 | 限制批量删除数量（如最多 50 个），或后续优化为服务端批量 API |
| checkbox 和现有删除按钮冲突 | 中 | 确保两者互不干扰，checkbox 只在筛选模式下显示 |
| 全选时误删重要 session | 高 | 确认对话框展示完整列表，用户必须二次确认 |

---

## 后续步骤

1. 任务 1-2 并行开发
2. 任务 3 集成 UI
3. 任务 4 实现删除逻辑
4. 手动测试所有场景
5. 提交代码
