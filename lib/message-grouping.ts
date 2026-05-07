import type { SessionMessage, MessageTurn } from "@/types/claude"

export interface CompactMessageNavItem {
  turnIndex: number
  messageId: string
  type: string
  preview: string
  timestamp: Date | null
}

export function extractCompactMessages(messages: SessionMessage[]): CompactMessageNavItem[] {
  const turns = groupMessagesIntoTurns(messages)
  const result: CompactMessageNavItem[] = []

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
    const turn = turns[turnIndex]
    for (const msg of turn.metadata) {
      result.push({
        turnIndex,
        messageId: msg.id,
        type: msg.type,
        preview: getCompactPreview(msg),
        timestamp: msg.timestamp,
      })
    }
  }

  return result
}

function getCompactPreview(message: SessionMessage): string {
  const raw = message.raw as Record<string, unknown>

  switch (message.type) {
    case "system": {
      const subtype = raw.subtype as string
      const duration = raw.durationMs as number | undefined
      const count = raw.messageCount as number | undefined
      let s = subtype || "system"
      if (duration !== undefined) s += ` · ${duration}ms`
      if (count !== undefined) s += ` · ${count} msgs`
      return s
    }
    case "attachment": {
      const att = raw.attachment as Record<string, unknown> | undefined
      const hook = att?.hookName as string
      const type = att?.type as string
      return (type || "") + (hook ? ` · ${hook}` : "")
    }
    case "ai-title":
      return String(raw.aiTitle ?? "")
    case "last-prompt":
      return `leaf: ${String(raw.leafUuid ?? "").slice(0, 8)}`
    case "permission-mode":
      return String(raw.permissionMode ?? "")
    case "file-history-snapshot": {
      const snapshot = raw.snapshot as Record<string, unknown> | undefined
      const backups = snapshot?.trackedFileBackups as Record<string, unknown> | undefined
      return `${backups ? Object.keys(backups).length : 0} files`
    }
    case "queue-operation":
      return `${String(raw.operation ?? "")}`
    default:
      return Object.keys(raw).slice(0, 3).join(", ")
  }
}

/**
 * Group flat messages into conversation turns.
 *
 * Rules:
 * - "user" message starts a new turn
 * - "assistant" message joins the current turn
 * - Other types join current turn's metadata if a turn is open;
 *   otherwise they become a standalone turn
 */
export function groupMessagesIntoTurns(messages: SessionMessage[]): MessageTurn[] {
  const turns: MessageTurn[] = []
  let current: MessageTurn | null = null

  for (const message of messages) {
    if (message.type === "user") {
      // Close previous turn if exists
      if (current) {
        turns.push(current)
      }
      // Start new turn with this user message
      current = {
        id: message.id,
        user: message,
        assistant: null,
        metadata: [],
      }
    } else if (message.type === "assistant") {
      if (current) {
        // If current turn already has an assistant, close it and start new turn
        // (handles edge case of consecutive assistants)
        if (current.assistant) {
          turns.push(current)
          current = {
            id: message.id,
            user: null,
            assistant: message,
            metadata: [],
          }
        } else {
          current.assistant = message
        }
      } else {
        // Assistant without preceding user → standalone turn
        current = {
          id: message.id,
          user: null,
          assistant: message,
          metadata: [],
        }
      }
    } else {
      // Compact/metadata messages
      if (current) {
        current.metadata.push(message)
      } else {
        // No open turn → standalone metadata turn
        turns.push({
          id: message.id,
          user: null,
          assistant: null,
          metadata: [message],
        })
      }
    }
  }

  // Don't forget the last open turn
  if (current) {
    turns.push(current)
  }

  return turns
}

/**
 * Extract tool_use blocks from an assistant message's content.
 */
export function extractToolUses(
  message: SessionMessage
): Array<Record<string, unknown>> {
  if (message.type !== "assistant") return []

  const raw = message.raw as Record<string, unknown>
  const msg = raw.message as Record<string, unknown> | undefined
  const content = (msg?.content ?? []) as Array<Record<string, unknown>>

  return content.filter((c) => c.type === "tool_use")
}

/**
 * Extract tool_result blocks from a user message's content.
 */
export function extractToolResults(
  message: SessionMessage
): Array<Record<string, unknown>> {
  if (message.type !== "user") return []

  const raw = message.raw as Record<string, unknown>
  const msg = raw.message as Record<string, unknown> | undefined
  const content = msg?.content

  if (typeof content === "string") return []
  if (!Array.isArray(content)) return []

  return content.filter((c: Record<string, unknown>) => c.type === "tool_result")
}

/**
 * Pair tool_use blocks with corresponding tool_result blocks by index.
 * Assumes order is preserved (LLM constraint).
 */
export function pairToolCalls(
  toolUses: Array<Record<string, unknown>>,
  toolResults: Array<Record<string, unknown>>
): Array<{
  toolUse: Record<string, unknown>
  toolResult?: Record<string, unknown>
}> {
  return toolUses.map((toolUse, index) => ({
    toolUse,
    toolResult: toolResults[index],
  }))
}
