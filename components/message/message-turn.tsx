"use client"

import { UserMessage } from "./user-message"
import { AssistantMessage } from "./assistant-message"
import { CompactMessage } from "./compact-message"
import { ToolCallCard } from "./tool-call-card"
import { ToolResultCard } from "./tool-result-card"
import { pairToolCalls } from "@/lib/message-grouping"
import type { MessageTurn, SessionMessage } from "@/types/claude"

interface MessageTurnProps {
  turn: MessageTurn
  highlightedMessageId?: string | null
}

function getToolResultBlock(message: SessionMessage): Record<string, unknown> | undefined {
  const raw = message.raw as Record<string, unknown> | undefined
  const msg = raw?.message as Record<string, unknown> | undefined
  const content = msg?.content
  if (!Array.isArray(content)) return undefined
  const blocks = content as Array<Record<string, unknown>>
  const suffixMatch = message.id.match(/tool-result-(\d+)$/)
  if (suffixMatch) {
    const idx = parseInt(suffixMatch[1], 10)
    const block = blocks[idx]
    if (block?.type === "tool_result") return block
  }
  return blocks.find((b) => b.type === "tool_result")
}

export function MessageTurn({ turn, highlightedMessageId }: MessageTurnProps) {
  const toolCalls = turn.events.filter((m) => m.kind === "tool-call")
  const toolResults = turn.events.filter((m) => m.kind === "tool-result")
  const { pairs, consumedResultIds } = pairToolCalls(toolCalls, toolResults)

  const hasContent =
    turn.user || turn.events.length > 0 || turn.metadata.length > 0

  if (!hasContent) return null

  return (
    <div className="my-4 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* Turn header with timestamp */}
      {turn.user?.timestamp && (
        <div className="border-b border-neutral-100 px-4 py-1.5 text-[10px] text-neutral-400 dark:border-neutral-800">
          {new Date(turn.user.timestamp).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      {/* User message */}
      {turn.user && <UserMessage message={turn.user} />}

      {/* Metadata messages inside the turn */}
      {turn.metadata.length > 0 && (
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          {turn.metadata.map((msg) => (
            <CompactMessage key={msg.id} message={msg} isHighlighted={msg.id === highlightedMessageId} />
          ))}
        </div>
      )}

      {/* Events: assistant / tool-call / orphan tool-result, in source order */}
      {turn.events.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-100 px-4 py-2 dark:border-neutral-800">
          {turn.events.map((event) => {
            if (event.kind === "assistant") {
              return <AssistantMessage key={event.id} message={event} />
            }
            if (event.kind === "tool-call") {
              const resultMessage = pairs.get(event.id)
              return (
                <ToolCallCard
                  key={event.id}
                  message={event}
                  resultMessage={resultMessage}
                  isHighlighted={event.id === highlightedMessageId}
                />
              )
            }
            if (event.kind === "tool-result") {
              if (consumedResultIds.has(event.id)) return null
              const block = getToolResultBlock(event)
              if (!block) return null
              return <ToolResultCard key={event.id} toolResult={block} />
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}
