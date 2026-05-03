"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Brain } from "lucide-react"

interface ThinkingBlockProps {
  thinking: string
}

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
      >
        <Brain className="h-3 w-3" />
        <span>Thinking</span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-1.5 max-h-60 overflow-y-auto rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            {thinking}
          </pre>
        </div>
      )}
    </div>
  )
}
