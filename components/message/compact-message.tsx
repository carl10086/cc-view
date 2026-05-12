"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { JsonTree } from "./json-tree"
import { formatTime } from "./format-time"
import { cn } from "@/lib/utils"
import type { SessionMessage } from "@/types/claude"

interface CompactMessageProps {
  message: SessionMessage
  isHighlighted?: boolean
}

export const typeConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  system: {
    label: "system",
    color: "text-neutral-500",
    bgColor: "bg-neutral-100 dark:bg-neutral-800",
  },
  attachment: {
    label: "attach",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/50",
  },
  "ai-title": {
    label: "title",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
  },
  "last-prompt": {
    label: "prompt",
    color: "text-neutral-400",
    bgColor: "bg-neutral-50 dark:bg-neutral-900/50",
  },
  "permission-mode": {
    label: "perms",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/50",
  },
  "file-history-snapshot": {
    label: "files",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/50",
  },
  "user-turn": {
    label: "turns",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  "queue-operation": {
    label: "queue",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
}

export function CompactMessage({ message, isHighlighted: externalHighlighted }: CompactMessageProps) {
  const [showJson, setShowJson] = useState(false)
  const [isHighlighted, setIsHighlighted] = useState(externalHighlighted ?? false)

  // Sync external highlight prop
  useEffect(() => {
    setIsHighlighted(externalHighlighted ?? false)
  }, [externalHighlighted])

  // Auto-clear highlight after 2 seconds
  useEffect(() => {
    if (!isHighlighted) return
    const timer = setTimeout(() => {
      setIsHighlighted(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [isHighlighted])

  const config = Object.prototype.hasOwnProperty.call(typeConfig, message.type)
    ? typeConfig[message.type]
    : {
        label: message.type,
        color: "text-neutral-400",
        bgColor: "bg-neutral-50 dark:bg-neutral-900/50",
      }

  const preview = getCompactPreview(message)
  const summary = getCompactSummary(message)

  return (
    <div
      className={cn(
        "group flex flex-col px-4 py-1.5 transition-colors",
        isHighlighted
          ? "bg-blue-50 dark:bg-blue-900/20"
          : showJson
            ? "bg-neutral-50 dark:bg-neutral-900/30"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.color} ${config.bgColor}`}
        >
          {config.label}
        </span>
        <span className="flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {preview}
        </span>
        {message.timestamp && (
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            {formatTime(message.timestamp)}
          </span>
        )}
        <button
          onClick={() => setShowJson(!showJson)}
          className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-200 hover:text-neutral-600 group-hover:opacity-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          title={showJson ? "Collapse" : "Expand JSON"}
        >
          {showJson ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Hover summary */}
      <div className="mt-0.5 hidden text-[10px] text-neutral-400 group-hover:block dark:text-neutral-500">
        {summary}
      </div>

      {/* Expanded JSON */}
      {showJson && (
        <div className="mt-2">
          <JsonTree data={message.raw} defaultCollapsed={1} />
        </div>
      )}
    </div>
  )
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
      const backups = snapshot?.trackedFileBackups as
        | Record<string, unknown>
        | undefined
      return `${backups ? Object.keys(backups).length : 0} files`
    }
    case "queue-operation":
      return `${String(raw.operation ?? "")}`
    default:
      return Object.keys(raw).slice(0, 3).join(", ")
  }
}

function getCompactSummary(message: SessionMessage): string {
  const raw = message.raw as Record<string, unknown>

  switch (message.type) {
    case "system": {
      const parts: string[] = []
      if (raw.subtype) parts.push(`type: ${raw.subtype}`)
      if (raw.durationMs) parts.push(`duration: ${raw.durationMs}ms`)
      if (raw.messageCount) parts.push(`messages: ${raw.messageCount}`)
      return parts.join(" · ") || "system event"
    }
    case "attachment": {
      const att = raw.attachment as Record<string, unknown> | undefined
      if (!att) return "no attachment data"
      const parts: string[] = []
      if (att.fileName) parts.push(`file: ${att.fileName}`)
      if (att.fileSize) parts.push(`size: ${att.fileSize}`)
      if (att.hookName) parts.push(`hook: ${att.hookName}`)
      return parts.join(" · ") || String(att.type ?? "attachment")
    }
    case "ai-title":
      return String(raw.aiTitle ?? "no title")
    case "last-prompt":
      return `leaf UUID: ${String(raw.leafUuid ?? "unknown")}`
    case "permission-mode":
      return `mode: ${String(raw.permissionMode ?? "unknown")}`
    case "file-history-snapshot": {
      const snapshot = raw.snapshot as Record<string, unknown> | undefined
      const backups = snapshot?.trackedFileBackups as
        | Record<string, unknown>
        | undefined
      const count = backups ? Object.keys(backups).length : 0
      return `${count} tracked file${count !== 1 ? "s" : ""}`
    }
    case "queue-operation": {
      const op = String(raw.operation ?? "unknown")
      const status = String(raw.status ?? "")
      return status ? `${op} · ${status}` : op
    }
    default: {
      const keys = Object.keys(raw).slice(0, 5)
      return keys.length > 0 ? `keys: ${keys.join(", ")}` : "no data"
    }
  }
}
