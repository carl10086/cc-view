# Plan: Session Sidebar 删除按钮溢出修复

## 概述

修复 session sidebar 中删除按钮在文本较长时被挤出可视区域的问题。

**任务数量**：1 个（单一组件修改）
**预计时间**：< 30 分钟

---

## 任务拆分

### 任务 1：修改 session-sidebar.tsx 布局

**文件**：`components/session-sidebar.tsx`

**改动清单**：

1. **第7行**：`SIDEBAR_PREVIEW_MAX` 从 `50` 改为 `80`
2. **第83行**：外层容器 class 添加 `relative`
   - 修改前：`className={`group flex cursor-pointer items-center ...`}`
   - 修改后：`className={`group relative flex cursor-pointer items-center ...`}`
3. **第91行**：左侧按钮 class 添加 `min-w-0`
   - 修改前：`className="flex-1 px-4 py-3 text-left"`
   - 修改后：`className="flex-1 min-w-0 px-4 py-3 text-left"`
4. **第122行**：删除按钮改为 absolute 定位
   - 修改前：`className="mr-3 rounded-md p-1.5 ..."`
   - 修改后：`className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 ..."`

**验收标准**：
- [ ] `SIDEBAR_PREVIEW_MAX` 值为 80
- [ ] 外层容器有 `relative` class
- [ ] 左侧按钮有 `min-w-0` class
- [ ] 删除按钮有 `absolute right-3 top-1/2 -translate-y-1/2` class

**验证方式**：
```bash
# 类型检查
npm run type-check

# 开发预览
npm run dev
# 手动测试：创建长文本 session，hover 确认删除按钮可见
```

---

## 依赖关系

```
任务 1
  ↓
  完成
```

---

## 后续步骤

1. 任务完成后进行手动测试
2. 确认删除功能正常工作
3. 提交代码
