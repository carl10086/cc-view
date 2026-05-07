"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Wrench } from "lucide-react"
import { JsonTree } from "./json-tree"

interface ToolResultCardProps {
  toolResult: Record<string, unknown>
  toolName?: string
  onNavigateToTool?: () => void
}

export function ToolResultCard({ toolResult, toolName, onNavigateToTool }: ToolResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const displayName = toolName || "Tool Result"
  const content = toolResult.content
  const summary = typeof content === "string"
    ? content.slice(0, 50) + (content.length > 50 ? "..." : "")
    : "[Tool result]"

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Wrench className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        <button
          onClick={onNavigateToTool}
          className="text-xs font-medium text-green-700 hover:underline dark:text-green-300"
          title="Jump to tool call"
        >
          {displayName}
        </button>
        <span className="flex-1 truncate text-[10px] text-green-600 dark:text-green-400">
          {isExpanded ? "" : summary}
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded p-0.5 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/20"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="border-t border-green-200 px-3 py-2 dark:border-green-900">
          <ToolResultContent result={toolResult} />
        </div>
      )}
    </div>
  )
}

function ToolResultContent({ result }: { result: Record<string, unknown> }) {
  const content = result.content

  if (typeof content === "string") {
    return (
      <div className="rounded-md border border-green-200 bg-white p-2 text-xs text-neutral-700 dark:border-green-900 dark:bg-neutral-950 dark:text-neutral-300">
        <pre className="whitespace-pre-wrap">{content}</pre>
      </div>
    )
  }

  if (Array.isArray(content)) {
    return <JsonTree data={content} defaultCollapsed={1} />
  }

  return <JsonTree data={result} defaultCollapsed={1} />
}
