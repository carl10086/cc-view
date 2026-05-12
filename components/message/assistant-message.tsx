"use client"

import { useState } from "react"
import { Bot } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { ThinkingBlock } from "./thinking-block"
import { formatTime } from "./format-time"
import type { SessionMessage } from "@/types/claude"

interface AssistantMessageProps {
  message: SessionMessage
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const [showRaw, setShowRaw] = useState(false)

  const raw = message.raw as Record<string, unknown>
  const msg = raw.message as Record<string, unknown> | undefined
  const content = (msg?.content ?? []) as Array<Record<string, unknown>>

  const thinkingItems = content.filter((c) => c.type === "thinking")
  const textItems = content.filter((c) => c.type === "text")

  return (
    <div className="group flex items-start gap-2 px-4 py-3">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
        <Bot className="h-3.5 w-3.5 text-green-600 dark:text-green-300" />
      </div>
      <div className="max-w-[85%]">
        {/* Thinking */}
        {thinkingItems.map((item, i) => (
          <ThinkingBlock key={i} thinking={String(item.thinking ?? "")} />
        ))}

        {/* Text content */}
        {textItems.length > 0 && (
          <div className="rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 shadow-sm dark:bg-neutral-800 prose prose-sm dark:prose-invert max-w-none">
            {textItems.map((item, i) => (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {String(item.text ?? "")}
              </ReactMarkdown>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-1 flex items-center gap-2">
          {message.timestamp && (
            <span className="text-[10px] text-neutral-400">
              {formatTime(message.timestamp)}
            </span>
          )}
          {!!raw.attributionSkill && (
            <span className="text-[10px] text-neutral-400">
              via {String(raw.attributionSkill)}
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
    </div>
  )
}

function RawJsonPanel({ raw }: { raw: unknown }) {
  return (
    <pre className="mt-2 max-h-48 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 text-[10px] leading-tight dark:border-neutral-800 dark:bg-neutral-900">
      <code>{JSON.stringify(raw, null, 2)}</code>
    </pre>
  )
}
