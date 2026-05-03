"use client"

import { useState } from "react"
import { User } from "lucide-react"
import { formatTime } from "./format-time"
import { CompactMessage } from "./compact-message"
import type { SessionMessage } from "@/types/claude"

interface UserMessageProps {
  message: SessionMessage
}

export function UserMessage({ message }: UserMessageProps) {
  const [showRaw, setShowRaw] = useState(false)
  const text = extractUserText(message)
  const isMeta = (message.raw as Record<string, unknown>)?.isMeta === true

  if (isMeta) {
    return <CompactMessage message={message} />
  }

  return (
    <div className="group flex items-start justify-end gap-2 px-4 py-3">
      <div className="max-w-[85%]">
        <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-white shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        </div>
        <div className="mt-1 flex items-center justify-end gap-2">
          {message.timestamp && (
            <span className="text-[10px] text-neutral-400">
              {formatTime(message.timestamp)}
            </span>
          )}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-[10px] text-neutral-400 opacity-0 transition-opacity hover:text-neutral-600 group-hover:opacity-100"
          >
            {showRaw ? "Hide JSON" : "JSON"}
          </button>
        </div>
        {showRaw && <RawJsonPanel raw={message.raw} />}
      </div>
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
        <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
      </div>
    </div>
  )
}

function extractUserText(message: SessionMessage): string {
  const raw = message.raw as Record<string, unknown>
  const msg = raw.message as Record<string, unknown> | undefined
  if (!msg) return ""

  const content = msg.content
  if (typeof content === "string") {
    return content
  }
  if (Array.isArray(content)) {
    const textItem = content.find(
      (c: Record<string, unknown>) => c.type === "text"
    )
    if (textItem?.text) return String(textItem.text)

    const toolResult = content.find(
      (c: Record<string, unknown>) => c.type === "tool_result"
    )
    if (toolResult) {
      const resultContent = toolResult.content
      if (typeof resultContent === "string") {
        return `[Tool result]\n${resultContent.slice(0, 300)}${resultContent.length > 300 ? "..." : ""}`
      }
    }
  }
  return ""
}

function RawJsonPanel({ raw }: { raw: unknown }) {
  return (
    <pre className="mt-2 max-h-48 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 text-[10px] leading-tight dark:border-neutral-800 dark:bg-neutral-900">
      <code>{JSON.stringify(raw, null, 2)}</code>
    </pre>
  )
}
