import type { SessionMessage, MessageTurn } from "@/types/claude"
import { getMessagePreview, asRecord } from "./message-semantics"

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
      const raw = asRecord(msg.raw)
      if (msg.type === "system" && raw?.subtype === "compact_boundary") {
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
 * - "assistant" | "tool-call" | "tool-result" kinds append to current turn's events
 *   (preserving source order); when no turn is open, a standalone turn is created
 * - "metadata" joins current turn's metadata (or a standalone metadata turn)
 */
export function groupMessagesIntoTurns(messages: SessionMessage[]): MessageTurn[] {
  const turns: MessageTurn[] = []
  let current: MessageTurn | null = null

  for (const message of messages) {
    if (message.kind === "user") {
      if (current) {
        turns.push(current)
      }
      current = createTurn(message.id, { user: message })
    } else if (
      message.kind === "assistant" ||
      message.kind === "tool-call" ||
      message.kind === "tool-result"
    ) {
      if (current) {
        current.events.push(message)
      } else {
        current = createTurn(message.id, { events: [message] })
      }
    } else {
      if (current) {
        current.metadata.push(message)
      } else {
        turns.push(createTurn(message.id, { metadata: [message] }))
      }
    }
  }

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
    events: [],
    metadata: [],
    ...fields,
  }
}

function getToolUseIdFromCallMessage(message: SessionMessage): string | undefined {
  const match = message.id.match(/tool-call-(\d+)$/)
  if (!match) return undefined
  const index = parseInt(match[1], 10)
  const raw = asRecord(message.raw)
  const msg = asRecord(raw?.message)
  const content = msg?.content
  if (!Array.isArray(content) || index < 0 || index >= content.length) return undefined
  const block = asRecord(content[index])
  return typeof block?.id === "string" ? block.id : undefined
}

function getToolUseIdFromResultMessage(message: SessionMessage): string | undefined {
  const match = message.id.match(/tool-result-(\d+)$/)
  if (!match) return undefined
  const index = parseInt(match[1], 10)
  const raw = asRecord(message.raw)
  const msg = asRecord(raw?.message)
  const content = msg?.content
  if (!Array.isArray(content) || index < 0 || index >= content.length) return undefined
  const block = asRecord(content[index])
  return typeof block?.tool_use_id === "string" ? block.tool_use_id : undefined
}

/**
 * Pair tool-call SessionMessages with their corresponding tool-result SessionMessages.
 *
 * Matching strategy:
 * - If the tool-call has an underlying `tool_use.id`, match strictly by id; no fallback.
 *   This avoids accidentally pairing a tool-call whose result is genuinely missing
 *   with an unrelated tool-result.
 * - If the tool-call has no `tool_use.id` (unusual), fall back to positional matching.
 *
 * Returns an object containing:
 * - `pairs`: Map keyed by the tool-call SessionMessage.id, valued by the paired
 *   tool-result SessionMessage. Unmatched tool-calls are absent.
 * - `consumedResultIds`: Set of tool-result SessionMessage.id that have been paired.
 */
export function pairToolCalls(
  toolCalls: SessionMessage[],
  toolResults: SessionMessage[]
): { pairs: Map<string, SessionMessage>; consumedResultIds: Set<string> } {
  const pairs = new Map<string, SessionMessage>()
  const consumedResultIds = new Set<string>()

  toolCalls.forEach((call, index) => {
    const callToolUseId = getToolUseIdFromCallMessage(call)
    if (callToolUseId !== undefined) {
      const match = toolResults.find((r) => {
        if (consumedResultIds.has(r.id)) return false
        return getToolUseIdFromResultMessage(r) === callToolUseId
      })
      if (match) {
        pairs.set(call.id, match)
        consumedResultIds.add(match.id)
      }
      return
    }
    const fallback = toolResults[index]
    if (fallback && !consumedResultIds.has(fallback.id)) {
      pairs.set(call.id, fallback)
      consumedResultIds.add(fallback.id)
    }
  })

  return { pairs, consumedResultIds }
}
