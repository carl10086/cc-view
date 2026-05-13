# Plan: 在 Messages 页面添加复制 Session ID 按钮

## 依赖图

```
┌─────────────────┐     ┌─────────────────┐
│   CopyButton    │────▶│  SessionBrowser │
│  (新增组件)      │     │  (修改集成)      │
└─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ copy-button.test│     │   page.tsx      │
│   (单元测试)     │     │  (无修改，展示)  │
└─────────────────┘     └─────────────────┘
```

**说明：**
- `CopyButton` 是纯展示组件，仅依赖 React + Lucide 图标
- `SessionBrowser` 已有 `selectedSession` 数据，直接传入 `session.id` 即可
- 无需修改 `SessionSidebar`、`MessageStream`、API 路由等其他模块

## 工作切片（垂直划分）

### 任务 1：实现 CopyButton 组件（含测试）

**目标：** 创建一个可复用的复制按钮组件，支持点击复制文本和成功状态反馈。

**文件变更：**
- `components/copy-button.tsx`（新增）
- `components/copy-button.test.tsx`（新增）

**实现要点：**
- 接收 `text: string` prop，表示要复制的内容
- 使用 `navigator.clipboard.writeText()` 写入剪贴板
- 使用 `useState` 跟踪 `copied` 状态
- 成功复制后：图标变为 `Check`，1 秒后通过 `setTimeout` 恢复为 `Copy`
- 错误处理：静默失败，不抛异常
- 样式：与现有 UI 一致（neutral 色系、`text-xs`、圆角、hover 效果）

**验收标准：**
- [ ] 组件能正确渲染 `Copy` 图标和"复制"文字
- [ ] 点击后调用 `navigator.clipboard.writeText(text)`
- [ ] 点击后图标变为 `Check`，文字变为"已复制"
- [ ] 1 秒后图标和文字自动恢复原始状态
- [ ] 复制失败时不抛出未捕获异常

**验证步骤：**
1. 运行 `npm test -- copy-button` 通过所有单元测试
2. TypeScript 类型检查通过：`npx tsc --noEmit`

---

### 任务 2：在 SessionBrowser Header 中集成 CopyButton

**目标：** 在消息区域 header 中显示当前 session ID 并提供一键复制 `--resume` 命令的功能。

**文件变更：**
- `components/session-browser.tsx`（修改）

**实现要点：**
- 在 `total > 0` 的 header block 内，于 `Row 1: stats + controls` 和 `Row 1.5: firstPrompt` 之间插入新行
- 新行内容：`Session: {selectedSession.id}` + `CopyButton`
- 传给 `CopyButton` 的 `text` 为 `` `--resume ${selectedSession.id}` ``
- 仅在 `selectedSession` 存在时显示
- 使用 `font-mono` 显示 session ID，与项目中其他 ID 展示风格一致（参考 `projectId` 的展示）
- 布局：左侧显示 session ID，右侧对齐复制按钮，使用 `flex justify-between items-center`

**样式细节：**
```
<div className="mt-2 flex items-center justify-between">
  <span className="text-xs font-mono text-neutral-500">
    Session: {selectedSession.id}
  </span>
  <CopyButton text={`--resume ${selectedSession.id}`} />
</div>
```

**验收标准：**
- [ ] 选中 session 后，header 区域显示 `Session: {id}` 和复制按钮
- [ ] 点击复制按钮后，剪贴板内容为 `--resume {session_id}` 格式
- [ ] 按钮始终可见（不依赖 hover）
- [ ] 未选中 session 或 `total === 0` 时不显示该区域
- [ ] 不影响现有 stats、controls、firstPrompt、type filters 的显示和交互

**验证步骤：**
1. 运行 `npm run dev` 启动开发服务器
2. 浏览器访问 `http://localhost:3000/projects/{projectId}`
3. 选中一个 session，确认 header 中显示 session ID 和复制按钮
4. 点击复制按钮，粘贴到文本编辑器验证内容为 `--resume {session_id}`
5. 验证图标变化反馈（1 秒内 Check → 恢复）
6. 切换不同 session，验证显示的 ID 随之更新
7. 验证移动端/窄屏下布局不崩坏（flex wrap）

---

## 阶段检查点

```
┌─────────────────────────────────────────────┐
│  Checkpoint 1: CopyButton 组件 + 测试通过    │
│  验证：npm test -- copy-button ✅            │
│  验证：npx tsc --noEmit ✅                   │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  Checkpoint 2: SessionBrowser 集成完成       │
│  验证：浏览器中 UI 显示正确 ✅               │
│  验证：复制功能正常工作 ✅                   │
│  验证：切换 session 后 ID 更新 ✅            │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  Checkpoint 3: 代码审查 + 提交              │
│  验证：npm test（全量测试通过）✅            │
│  验证：npm run lint ✅                       │
│  验证：npm run build ✅                      │
└─────────────────────────────────────────────┘
```

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| `navigator.clipboard` 在 HTTP 环境不可用 | 中 | 高 | 添加 try-catch，静默失败；或降级到 `document.execCommand`（如需要） |
| session ID 过长导致布局溢出 | 低 | 中 | 使用 `truncate` 或 `max-width` 限制显示长度，保持 `flex` 布局 |
| 与现有 header 内容拥挤 | 低 | 低 | 保持 `mt-2` 间距，使用 `flex-wrap` 适配窄屏 |

## 预估工作量

- **任务 1（CopyButton + 测试）**：15-20 分钟
- **任务 2（SessionBrowser 集成）**：10-15 分钟
- **验证与审查**：10-15 分钟
- **总计**：约 35-50 分钟
