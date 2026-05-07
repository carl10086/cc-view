"use client"

import { X } from "lucide-react"

interface FocusContextBarProps {
  messageCount: number
  onClear: () => void
}

export function FocusContextBar({ messageCount, onClear }: FocusContextBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-900/20">
      <span className="text-xs text-blue-700 dark:text-blue-300">
        Viewing message context · {messageCount} messages
      </span>
      <button
        onClick={onClear}
        className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700"
      >
        <X className="h-3 w-3" />
        Return to filter view
      </button>
    </div>
  )
}
