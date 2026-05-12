import type { SessionMessage, MessageTurn } from "@/types/claude"
import { getMessagePreview } from "./message-semantics"

export interface MessageNavItem {
  turnIndex: number
  messageId: string
  type: string
  preview: string
  timestamp: Date | null
}

export type CompactMessageNavItem = MessageNavItem

export function extractUserTurnNavItems(messages: SessionMessage[]): MessageNavItem[] {
  const turns = groupMessagesIntoTurns(messages)
  const result: MessageNavItem[] = []
  let userTurnIndex = 0

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
    const userMessage = turns[turnIndex].user
    if (!userMessage) continue

    userTurnIndex += 1
    result.push({
      turnIndex,
      messageId: userMessage.id,
      type: "user-turn",
      preview: `#${userTurnIndex} ${getMessagePreview(userMessage) || "User input"}`,
      timestamp: userMessage.timestamp,
    })
  }

  return result
}

export function extractMessageNavItems(messages: SessionMessage[]): MessageNavItem[] {
  return [
    ...extractUserTurnNavItems(messages),
    ...extractCompactBoundaryMessages(messages),
  ]
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

/**
 * Extract only compact_boundary messages (markers from /compact command).
 */
export function extractCompactBoundaryMessages(messages: SessionMessage[]): CompactMessageNavItem[] {
  const turns = groupMessagesIntoTurns(messages)
  const result: CompactMessageNavItem[] = []

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
    const turn = turns[turnIndex]
    for (const msg of turn.metadata) {
      const raw = msg.raw as Record<string, unknown>
      if (msg.type === "system" && raw.subtype === "compact_boundary") {
        result.push({
          turnIndex,
          messageId: msg.id,
          type: "compact_boundary",
          preview: getCompactPreview(msg),
          timestamp: msg.timestamp,
        })
      }
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
 * - "user" kind starts a new turn
 * - "assistant" kind joins the current turn
 * - "tool-result" kind joins current turn's toolResults
 * - Metadata joins current turn's metadata if a turn is open;
 *   otherwise they become a standalone turn
 */
export function groupMessagesIntoTurns(messages: SessionMessage[]): MessageTurn[] {
  const turns: MessageTurn[] = []
  let current: MessageTurn | null = null

  for (const message of messages) {
    if (message.kind === "user") {
      // Close previous turn if exists
      if (current) {
        turns.push(current)
      }
      // Start new turn with this user message
      current = createTurn(message.id, { user: message })
    } else if (message.kind === "assistant") {
      if (current) {
        // If current turn already has an assistant, close it and start new turn
        // (handles edge case of consecutive assistants)
        if (current.assistant) {
          turns.push(current)
          current = createTurn(message.id, { assistant: message })
        } else {
          current.assistant = message
        }
      } else {
        // Assistant without preceding user → standalone turn
        current = createTurn(message.id, { assistant: message })
      }
    } else if (message.kind === "tool-result") {
      if (current) {
        current.toolResults.push(message)
      } else {
        turns.push(createTurn(message.id, { toolResults: [message] }))
      }
    } else {
      // Compact/metadata messages
      if (current) {
        current.metadata.push(message)
      } else {
        // No open turn → standalone metadata turn
        turns.push(createTurn(message.id, { metadata: [message] }))
      }
    }
  }

  // Don't forget the last open turn
  if (current) {
    turns.push(current)
  }

  return turns
}

function createTurn(
  id: string,
  fields: Partial<Omit<MessageTurn, "id">>
): MessageTurn {
  return {
    id,
    user: null,
    assistant: null,
    toolResults: [],
    metadata: [],
    ...fields,
  }
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
 * Pair tool_use blocks with corresponding tool_result blocks by tool_use_id.
 * Falls back to index-based matching if tool_use_id is not available.
 */
export function pairToolCalls(
  toolUses: Array<Record<string, unknown>>,
  toolResults: Array<Record<string, unknown>>
): Array<{
  toolUse: Record<string, unknown>
  toolResult?: Record<string, unknown>
}> {
  return toolUses.map((toolUse, index) => {
    const toolUseId = toolUse.id as string | undefined
    if (toolUseId) {
      const matched = toolResults.find(
        (tr) => tr.tool_use_id === toolUseId
      )
      if (matched) {
        return { toolUse, toolResult: matched }
      }
      // tool_use has id but no matching tool_use_id found
      return { toolUse, toolResult: undefined }
    }
    // Fallback to index-based matching when no tool_use id
    return { toolUse, toolResult: toolResults[index] }
  })
}
