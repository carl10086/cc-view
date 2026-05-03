import type { SessionMessage, MessageTurn } from "@/types/claude"

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
