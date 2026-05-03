"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Wrench, Clock } from "lucide-react"
import { JsonTree } from "./json-tree"

interface ToolCallCardProps {
  toolUse: Record<string, unknown>
  toolResult?: Record<string, unknown>
}

export function ToolCallCard({ toolUse, toolResult }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toolName = String(toolUse.name ?? "unknown")
  const toolInput = toolUse.input ?? {}
  const hasResult = toolResult !== undefined

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
      >
        <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          {toolName}
        </span>
        {!hasResult && (
          <span className="flex items-center gap-1 text-[10px] text-amber-500">
            <Clock className="h-3 w-3" />
            等待结果
          </span>
        )}
        <span className="ml-auto">
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          )}
        </span>
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="space-y-2 border-t border-amber-200 px-3 py-2.5 dark:border-amber-900">
          {/* Input */}
          <div>
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Input
            </span>
            <JsonTree data={toolInput} defaultCollapsed={2} />
          </div>

          {/* Result */}
          {hasResult ? (
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Result
              </span>
              <ToolResultContent result={toolResult} />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded bg-amber-100/50 px-2 py-1.5 text-[10px] text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              <span>结果尚未返回</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolResultContent({ result }: { result: Record<string, unknown> }) {
  // Handle different result formats
  const content = result.content

  if (typeof content === "string") {
    return (
      <div className="rounded-md border border-amber-200 bg-white p-2 text-xs text-neutral-700 dark:border-amber-900 dark:bg-neutral-950 dark:text-neutral-300">
        <pre className="whitespace-pre-wrap">{content}</pre>
      </div>
    )
  }

  if (Array.isArray(content)) {
    return <JsonTree data={content} defaultCollapsed={1} />
  }

  // Fallback: show the whole result object
  return <JsonTree data={result} defaultCollapsed={1} />
}
