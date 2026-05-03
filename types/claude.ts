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
  messageCount: number
  lastModified: Date
}

export interface SessionMessage {
  id: string
  type: string
  timestamp: Date | null
  parentUuid: string | null
  raw: unknown
}

export interface MessageTurn {
  id: string
  user: SessionMessage | null
  assistant: SessionMessage | null
  metadata: SessionMessage[]
}
