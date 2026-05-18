export interface WorktreeInfo {
  name: string
  sessionCount: number
}

export interface ProjectInfo {
  id: string
  name: string
  sessionCount: number
  lastModified: Date
  worktrees: WorktreeInfo[]
}

export interface SessionInfo {
  id: string
  title: string | null
  firstPrompt: string | null
  messageCount: number
  lastModified: Date
}

/**
 * 产品语义层面的消息分类。
 *
 * - `user`: 用户真实输入（文本、附件等）
 * - `assistant`: AI 助手的文字/思考回复
 * - `tool-call`: 助手发起的工具调用（由 assistant 消息中的 tool_use 块拆分而来）
 * - `tool-result`: 工具执行结果（由 user 消息中的 tool_result 块拆分而来）
 * - `metadata`: 非对话类系统消息（system、attachment、last-prompt 等）的兜底分类
 */
export type SessionMessageKind =
  | "user"
  | "assistant"
  | "tool-call"
  | "tool-result"
  | "metadata"

export interface SessionMessage {
  id: string
  type: string
  kind: SessionMessageKind
  filterType: string
  timestamp: Date | null
  parentUuid: string | null
  raw: unknown
}

export interface MessageTurn {
  id: string
  user: SessionMessage | null
  events: SessionMessage[]
  metadata: SessionMessage[]
}

export interface UserTurnNavItem {
  turnIndex: number
  messageId: string
  preview: string
  timestamp: Date | null
  offset: number
}
