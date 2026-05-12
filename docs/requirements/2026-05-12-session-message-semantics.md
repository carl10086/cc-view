# Session Message 语义区分需求

## 背景

cc-view 的 session message 列表目前主要依赖 Claude jsonl 里的顶层 `type` 或 `message.role` 来判断消息类别。

在 Claude Code 的协议数据中，工具执行结果通常记录为顶层 `type: "user"`、`message.role: "user"`，但它并不是用户输入，而是 `message.content[]` 中的 `tool_result` 内容块。当前实现会把这类消息和真实用户输入混在一起，导致列表展示、turn 分组和类型过滤都存在语义混淆。

已知问题可以在当前的 `30001` session 中观察到：部分 `role: "user"` 的消息实际上是 tool result。

## 目标

建立 cc-view 自己的产品语义分类，明确区分“用户输入”和“工具结果”。

核心目标：

- `user` 在 cc-view UI 中只代表真实用户输入。
- `tool_result` 即使原始 `role` 是 `user`，也必须被识别为工具结果。
- 消息展示、turn 分组、过滤器和导航都不能再把 tool result 当作用户输入。
- 保留原始 jsonl 数据，不改变 Claude 原始记录结构。

## 术语定义

### 原始协议类型

来自 Claude jsonl 的原始字段，例如：

- 顶层 `type`
- `message.role`
- `message.content[]`

这些字段用于还原原始记录和调试，不直接等同于 cc-view 的 UI 语义。

### 产品语义类型

cc-view 派生出的消息语义，用于驱动展示、过滤、分组和导航。

初始语义分类：

- `user`：真实用户输入。
- `tool-result`：工具执行结果。
- `assistant`：助手消息，包括 text、thinking、tool_use 等内容。
- `metadata`：system、attachment、ai-title、last-prompt、permission-mode、file-history-snapshot、queue-operation 等非对话主体消息。

## 功能需求

### R1. 真实用户输入识别

当一条原始消息满足以下条件时，cc-view 应将它识别为 `user`：

- 原始顶层 `type` 或 `message.role` 表示 user。
- `message.content` 中存在真实用户输入文本。
- 该消息不是纯工具结果。

验收标准：

- 类型过滤器选择 `user` 时，只显示真实用户输入。
- 真实用户输入仍使用用户消息样式展示。
- 用户输入可以继续作为一个新的 conversation turn 边界。

### R2. Tool result 识别

当一条原始消息满足以下条件时，cc-view 应将它识别为 `tool-result`：

- 原始顶层 `type` 或 `message.role` 可能是 user。
- `message.content` 为数组，且内容块包含 `type: "tool_result"`。
- 该消息语义上来自工具执行返回，而不是用户主动输入。

验收标准：

- `tool-result` 不显示为用户气泡。
- `tool-result` 不计入 `user` 类型过滤结果。
- `tool-result` 不开启新的用户 turn。
- UI 上必须能明确看出这是工具结果。

### R3. 混合内容处理

如果一条原始 user-role 消息同时包含文本内容和 `tool_result` 内容块，cc-view 必须分别处理两类内容，而不是整条消息粗略归为 user。

验收标准：

- 文本内容按用户输入展示。
- `tool_result` 内容按工具结果展示。
- 过滤器和导航不能因为混合消息而把 tool result 算入 `user`。

### R4. 类型过滤语义

过滤器中的 `user` 必须采用产品语义，而不是原始协议语义。

验收标准：

- 选择 `user` 只显示真实用户输入。
- tool result 应有独立语义，可被单独展示或过滤。
- 现有 assistant、system、attachment 等过滤行为应保持可理解且不回退到原始协议歧义。

### R5. Turn 分组语义

Conversation turn 的边界应基于真实用户输入，而不是所有原始 user-role 消息。

验收标准：

- 真实用户输入开启新的 turn。
- tool result 归属于相关 tool call 或当前上下文，不开启新的 turn。
- `user -> assistant -> tool use -> tool result -> assistant` 的因果链在列表中保持可读。

### R6. 原始数据保留

cc-view 不修改 `.jsonl` 文件，也不丢弃原始字段。

验收标准：

- Raw JSON 面板仍能看到原始 `type`、`role` 和 `content`。
- 派生语义不能覆盖或篡改原始记录。
- 调试时可以同时看到原始协议类型和产品语义类型。

### R7. 右侧导航栏按真实用户输入区分轮次

右侧导航栏应定位为“按用户输入快速跳转”的 session outline，而不是 metadata 事件列表。

导航栏的轮次边界必须基于产品语义中的真实用户输入，而不是原始协议里的所有 `role: "user"` 消息。

验收标准：

- 导航栏一级列表只显示真实用户输入，不显示 tool result。
- 每条导航项代表一个 conversation turn。
- 导航项文案使用用户输入内容的短 preview。
- 点击导航项后跳转到该轮用户输入位置，并短暂高亮对应轮次或用户输入消息。
- tool result、assistant、compact boundary、attachment 等内容不作为导航主项。
- session 开头如果只有 system 或 metadata，在该导航栏中不单独生成轮次入口。

设计原则：

- `uuid` / `parentUuid` 等原始消息链路可作为辅助调试信息，但不直接作为 UI 轮次来源。
- UI 轮次服务于用户浏览体验，因此以“用户主动输入一次”作为主边界。
- tool result 归属于相关上下文或工具调用，不创建新的用户轮次。

## 非目标

- 不修改 Claude Code 生成的 jsonl 文件格式。
- 不实现消息编辑、删除或重新写入。
- 不把协议层的 `role: "user"` 重命名或改写为其他值。
- 不要求一次性重做全部 session message UI，但新的设计不能继续依赖错误语义。

## 已讨论但暂不处理

### 过滤与分页语义

当前 filter 只有在 `Load all` 后才能使用，因为前端只对已加载消息做过滤。已讨论的更合理方向是“先 filter，再分页”：

- filter 应作用于整个 session，而不是当前已加载页。
- 分页应发生在 filter 之后。
- `total`、`hasMore`、剩余数量等状态应基于过滤后的结果。
- `Load all` 在过滤状态下应表示加载当前查询条件下的全部匹配结果。

该需求暂不进入当前实现范围，后续需要单独确认 API、性能和 UI 状态设计。

## 待补充需求

后续需求将在此节继续追加。当前已知待确认方向：

- tool result 是否需要独立过滤 chip，以及 chip 文案使用 `tool-result` 还是 `tool result`。
- tool result 是否默认聚合到对应 tool call 卡片，还是保留独立记录。
- 右侧导航栏是否需要在用户轮次主项之外提供二级事件导航。
- 混合内容消息是否需要拆成多个展示块，还是在单条消息内分区展示。
- `30001` session 中的具体样例是否需要加入测试 fixture。

## 成功标准

- 打开包含 tool result 的 session 时，真实用户输入和工具结果一眼可区分。
- 过滤 `user` 后不会出现工具返回内容。
- tool result 不再制造错误的 conversation turn。
- 右侧导航栏只按真实用户输入生成轮次入口，点击后可快速跳转到对应用户输入。
- 现有 session 浏览、虚拟滚动、加载更多、排序和 raw JSON 查看能力不受破坏。

