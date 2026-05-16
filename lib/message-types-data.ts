export interface MessageTypeInfo {
  filterType: string
  label: string
  color: string
  bgColor: string
  description: string
  exampleJson?: object
}

export const mainMessageTypes: MessageTypeInfo[] = [
  {
    filterType: "user",
    label: "user",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    description:
      "用户发送的消息，包含文本输入、图片上传或文件引用。这是对话的主要输入来源，由人类用户直接产生。",
    exampleJson: {
      type: "user",
      role: "user",
      content: [{ type: "text", text: "帮我分析一下这段代码" }],
    },
  },
  {
    filterType: "assistant",
    label: "assistant",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/50",
    description:
      "AI 助手回复的消息，可能包含文本解释、代码片段、工具调用请求或思考过程。这是 Claude 模型的主要输出形式。",
    exampleJson: {
      type: "assistant",
      role: "assistant",
      content: [{ type: "text", text: "我来帮你分析这段代码..." }],
    },
  },
  {
    filterType: "system",
    label: "system",
    color: "text-neutral-500",
    bgColor: "bg-neutral-100 dark:bg-neutral-800",
    description:
      "系统内部事件消息，包括信息提示、API 错误、权限重试、连接状态变更、定时任务触发、会话紧凑化边界等。用于记录 Claude Code 运行时的内部状态变化。",
    exampleJson: {
      type: "system",
      subtype: "informational",
      content: "操作已完成",
      level: "info",
    },
  },
  {
    filterType: "attachment",
    label: "attach",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/50",
    description:
      "钩子执行结果或技能列表等附加信息。Attachment 类型包含多种子类型，如 Hook 执行结果（成功/错误/取消）、技能列表、Agent 提及等，用于扩展会话的上下文信息。",
    exampleJson: {
      type: "attachment",
      attachment: {
        type: "hook_success",
        hookName: "SessionStart:startup",
        content: "钩子执行成功",
      },
    },
  },
  {
    filterType: "last-prompt",
    label: "prompt",
    color: "text-neutral-400",
    bgColor: "bg-neutral-50 dark:bg-neutral-900/50",
    description:
      "最后一次发送给模型的完整提示词。这个类型记录了实际传入 Claude API 的完整消息内容，包括系统提示、历史上下文和当前用户输入。",
    exampleJson: {
      type: "last-prompt",
      content: "System: 你是一个助手...",
    },
  },
  {
    filterType: "permission-mode",
    label: "perms",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/50",
    description:
      "权限模式变更记录。当 Claude Code 切换不同的权限模式（如自动模式、建议模式、需要确认模式）时产生，用于追踪权限决策历史。",
    exampleJson: {
      type: "permission-mode",
      mode: "suggest",
      reason: "用户切换权限模式",
    },
  },
  {
    filterType: "file-history-snapshot",
    label: "files",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/50",
    description:
      "文件历史快照，记录某时刻的工作区文件状态。用于文件恢复、变更对比和上下文重建，通常在重要操作前自动创建。",
    exampleJson: {
      type: "file-history-snapshot",
      files: ["src/app.ts", "lib/utils.ts"],
      timestamp: "2024-01-01T00:00:00Z",
    },
  },
  {
    filterType: "user-turn",
    label: "turns",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    description:
      "用户对话轮次标记。用于标识用户发起的新一轮对话，帮助区分不同的对话主题和上下文边界。",
    exampleJson: {
      type: "user-turn",
      turnIndex: 5,
      timestamp: "2024-01-01T00:00:00Z",
    },
  },
  {
    filterType: "queue-operation",
    label: "queue",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    description:
      "队列操作记录，如任务排队、执行状态变更。用于追踪异步任务的队列状态，包括任务提交、开始执行、完成或失败。",
    exampleJson: {
      type: "queue-operation",
      operation: "enqueue",
      taskId: "task-123",
      status: "pending",
    },
  },
  {
    filterType: "ai-title",
    label: "title",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
    description:
      "AI 生成的会话标题。Claude 根据会话内容自动生成简洁的标题，用于快速识别和导航历史会话。",
    exampleJson: {
      type: "ai-title",
      title: "分析代码结构",
      generatedAt: "2024-01-01T00:00:00Z",
    },
  },
]
