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

export type SessionMessageKind =
  | "user"
  | "assistant"
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
  assistant: SessionMessage | null
  toolResults: SessionMessage[]
  metadata: SessionMessage[]
}

export interface UserTurnNavItem {
  turnIndex: number
  messageId: string
  preview: string
  timestamp: Date | null
  offset: number
}
