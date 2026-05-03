"use client"

import { UserMessage } from "./user-message"
import { AssistantMessage } from "./assistant-message"
import { CompactMessage } from "./compact-message"
import { ToolCallCard } from "./tool-call-card"
import {
  extractToolUses,
  extractToolResults,
  pairToolCalls,
} from "@/lib/message-grouping"
import type { MessageTurn } from "@/types/claude"

interface MessageTurnProps {
  turn: MessageTurn
}

export function MessageTurn({ turn }: MessageTurnProps) {
  const toolUses = turn.assistant ? extractToolUses(turn.assistant) : []
  const toolResults = turn.user ? extractToolResults(turn.user) : []
  const pairedTools = pairToolCalls(toolUses, toolResults)

  const hasContent =
    turn.user || turn.assistant || turn.metadata.length > 0 || pairedTools.length > 0

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
            <CompactMessage key={msg.id} message={msg} />
          ))}
        </div>
      )}

      {/* Assistant message */}
      {turn.assistant && <AssistantMessage message={turn.assistant} />}

      {/* Tool calls */}
      {pairedTools.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-100 px-4 py-2 dark:border-neutral-800">
          {pairedTools.map((pair, i) => (
            <ToolCallCard key={i} toolUse={pair.toolUse} toolResult={pair.toolResult} />
          ))}
        </div>
      )}
    </div>
  )
}
