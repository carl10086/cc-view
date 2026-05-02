"use client"

import { useState, memo } from "react"
import { ChevronDown, ChevronUp, User, Bot, Wrench, Brain } from "lucide-react"
import type { SessionMessage } from "@/types/claude"

interface MessageCardProps {
  message: SessionMessage
}

function MessageCardInner({ message }: MessageCardProps) {
  switch (message.type) {
    case "user":
      return <UserMessageCard message={message} />
    case "assistant":
      return <AssistantMessageCard message={message} />
    default:
      return <CompactMessageCard message={message} />
  }
}

export const MessageCard = memo(MessageCardInner)

// ─── User Message ───

function UserMessageCard({ message }: MessageCardProps) {
  const [showRaw, setShowRaw] = useState(false)
  const text = extractUserText(message)
  const isMeta = (message.raw as Record<string, unknown>)?.isMeta === true

  if (isMeta) {
    // Meta messages (skill docs) are shown compactly
    return <CompactMessageCard message={message} />
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

// ─── Assistant Message ───

function AssistantMessageCard({ message }: MessageCardProps) {
  const [showThinking, setShowThinking] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const raw = message.raw as Record<string, unknown>
  const msg = raw.message as Record<string, unknown> | undefined
  const content = (msg?.content ?? []) as Array<Record<string, unknown>>

  const thinkingItems = content.filter((c) => c.type === "thinking")
  const textItems = content.filter((c) => c.type === "text")
  const toolItems = content.filter((c) => c.type === "tool_use")

  return (
    <div className="group flex items-start gap-2 px-4 py-3">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
        <Bot className="h-3.5 w-3.5 text-green-600 dark:text-green-300" />
      </div>
      <div className="max-w-[85%]">
        {/* Thinking */}
        {thinkingItems.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            >
              <Brain className="h-3 w-3" />
              Thinking ({thinkingItems.length})
              {showThinking ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {showThinking && (
              <div className="mt-1 space-y-1">
                {thinkingItems.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-neutral-50 p-2 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400"
                  >
                    {String(item.thinking ?? "")
                      .slice(0, 500)
                      .replace(/\n/g, " ")}
                    {String(item.thinking ?? "").length > 500 ? "..." : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Text content */}
        {textItems.length > 0 && (
          <div className="rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-2.5 shadow-sm dark:bg-neutral-800">
            {textItems.map((item, i) => (
              <p
                key={i}
                className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
              >
                {String(item.text ?? "")}
              </p>
            ))}
          </div>
        )}

        {/* Tool use */}
        {toolItems.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {toolItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
              >
                <Wrench className="h-3 w-3" />
                <span className="font-medium">{String(item.name ?? "")}</span>
                <span className="text-amber-500">·</span>
                <span className="truncate max-w-[200px]">
                  {JSON.stringify(item.input ?? {}).slice(0, 60)}...
                </span>
              </div>
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

// ─── Compact Card (metadata messages) ───

function CompactMessageCard({ message }: MessageCardProps) {
  const [expanded, setExpanded] = useState(false)

  const typeConfig: Record<
    string,
    { label: string; color: string; icon?: string }
  > = {
    system: { label: "system", color: "text-neutral-500" },
    attachment: { label: "attach", color: "text-amber-500" },
    "ai-title": { label: "title", color: "text-purple-500" },
    "last-prompt": { label: "prompt", color: "text-neutral-400" },
    "permission-mode": { label: "perms", color: "text-neutral-400" },
    "file-history-snapshot": { label: "files", color: "text-neutral-400" },
    "queue-operation": { label: "queue", color: "text-neutral-400" },
  }

  const config = typeConfig[message.type] || {
    label: message.type,
    color: "text-neutral-400",
  }

  const preview = getCompactPreview(message)

  return (
    <div className="group flex items-center gap-2 px-4 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
      <span className={`text-[11px] font-medium uppercase ${config.color}`}>
        {config.label}
      </span>
      <span className="text-xs text-neutral-500 truncate flex-1">{preview}</span>
      {message.timestamp && (
        <span className="text-[10px] text-neutral-400">
          {formatTime(message.timestamp)}
        </span>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-neutral-400 opacity-0 transition-opacity hover:text-neutral-600 group-hover:opacity-100"
      >
        {expanded ? "−" : "+"}
      </button>
      {expanded && <RawJsonPanel raw={message.raw} />}
    </div>
  )
}

// ─── Helpers ───

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

function getCompactPreview(message: SessionMessage): string {
  const raw = message.raw as Record<string, unknown>

  switch (message.type) {
    case "system": {
      const subtype = raw.subtype as string
      const duration = raw.durationMs as number | undefined
      const count = raw.messageCount as number | undefined
      let s = subtype
      if (duration !== undefined) s += ` · ${duration}ms`
      if (count !== undefined) s += ` · ${count} msgs`
      return s
    }
    case "attachment": {
      const att = raw.attachment as Record<string, unknown> | undefined
      const hook = att?.hookName as string
      const type = att?.type as string
      return type + (hook ? ` · ${hook}` : "")
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

function RawJsonPanel({ raw }: { raw: unknown }) {
  return (
    <pre className="mt-2 max-h-48 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 text-[10px] leading-tight dark:border-neutral-800 dark:bg-neutral-900">
      <code>{JSON.stringify(raw, null, 2)}</code>
    </pre>
  )
}

function formatTime(timestamp: Date | string): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
