"use client"

import { Eye } from "lucide-react"
import { UserMessage } from "./user-message"
import { AssistantMessage } from "./assistant-message"
import { CompactMessage } from "./compact-message"
import { ToolCallCard } from "./tool-call-card"
import {
  extractToolUses,
  extractToolResults,
  pairToolCalls,
} from "@/lib/message-grouping"
import { cn } from "@/lib/utils"
import type { MessageTurn } from "@/types/claude"

interface MessageTurnProps {
  turn: MessageTurn
  isFocused?: boolean
  showFocusButton?: boolean
  onFocus?: () => void
}

export function MessageTurn({ turn, isFocused, showFocusButton, onFocus }: MessageTurnProps) {
  const toolUses = turn.assistant ? extractToolUses(turn.assistant) : []
  const toolResults = turn.user ? extractToolResults(turn.user) : []
  const pairedTools = pairToolCalls(toolUses, toolResults)

  const hasContent =
    turn.user || turn.assistant || turn.metadata.length > 0 || pairedTools.length > 0

  if (!hasContent) return null

  return (
    <div
      className={cn(
        "my-4 rounded-xl border bg-white dark:bg-neutral-950",
        isFocused
          ? "border-blue-500 dark:border-blue-400"
          : "border-neutral-200 dark:border-neutral-800"
      )}
    >
      {/* Turn header with timestamp */}
      {(turn.user?.timestamp || showFocusButton) && (
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-1.5 text-[10px] text-neutral-400 dark:border-neutral-800">
          <span>
            {turn.user?.timestamp &&
              new Date(turn.user.timestamp).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
          </span>
          {showFocusButton && (
            <button
              title="View context"
              onClick={onFocus}
              className="ml-2 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
            >
              <Eye className="h-3 w-3" />
            </button>
          )}
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
