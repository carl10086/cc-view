# Spec: Session Sidebar 删除按钮溢出修复

## Objective

修复 session sidebar 中删除按钮在文本较长时被挤出可视区域的问题。

**用户场景**：用户在 session 列表中浏览较长文本的 session 时，看不到删除按钮，无法进行删除操作。

**验收标准**：
1. 当 session 的 firstPrompt 或 title 文本较长时，删除按钮始终可见
2. 删除按钮通过 hover 操作显示，与现有行为一致
3. 修复后的布局在各种文本长度下均保持正确的视觉对齐

## Tech Stack

- Next.js 16 + React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui

**涉及文件**：
- `components/session-sidebar.tsx` — 核心修改
- `components/session-delete-dialog.tsx` — 无需修改

## Commands

```bash
# 开发预览
npm run dev

# 类型检查
npm run type-check

# 构建
npm run build
```

## Project Structure

```
components/
  session-sidebar.tsx       # 修改：修复删除按钮溢出
  session-delete-dialog.tsx # 无需修改
```

## Code Style

**修改模式**：对现有 session sidebar item 布局结构调整

**修改前**（第81-128行）：
```tsx
<div className={`group flex cursor-pointer items-center ...`}>
  <button className="flex-1 px-4 py-3 text-left">
    ...
  </button>
  {onSessionDelete && (
    <button className="mr-3 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 ...">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )}
</div>
```

**修改后**：
```tsx
<div className={`group relative flex cursor-pointer items-center ...`}>
  <button className="flex-1 min-w-0 px-4 py-3 text-left">
    ...
  </button>
  {onSessionDelete && (
    <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 ...">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )}
</div>
```

**关键改动**：
1. 外层容器添加 `relative` 定位
2. 删除按钮改为 `absolute right-3 top-1/2 -translate-y-1/2`
3. 左侧按钮添加 `min-w-0` 防止 flex 子项被内容撑开

## Testing Strategy

**手动测试**：
1. 创建文本较长的 session（firstPrompt > 50 字符）
2. 在 sidebar 中找到该 session
3. Hover 该 session 项
4. 确认删除按钮始终可见且位置正确
5. 点击删除按钮，确认 dialog 正常弹出

**测试场景**：
- 短文本 session（< 50 字符）
- 长文本 session（> 100 字符）
- 极限长度文本（接近容器宽度）
- 选中状态 + hover 状态叠加

## Boundaries

- **Always**: 保持现有 hover 显示行为不变
- **Ask first**: 修改其他组件的样式
- **Never**: 修改删除逻辑后端（服务端 5 分钟活跃判断保持不变）

## Success Criteria

1. [ ] `SIDEBAR_PREVIEW_MAX` 从 50 改为 80
2. [ ] 外层容器添加 `relative` 定位
3. [ ] 删除按钮改为 `absolute` 定位，使用 `right-3 top-1/2 -translate-y-1/2`
4. [ ] 左侧按钮添加 `min-w-0` class
5. [ ] 手动测试：长文本 session 的删除按钮始终可见
6. [ ] 手动测试：删除功能正常工作

## Open Questions

无
