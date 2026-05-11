"use client"

import { cn } from "@/lib/utils"

interface TimeFilterSelectProps {
  value: string
  onChange: (value: string) => void
}

export const TIME_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "1 天前", value: "1d" },
  { label: "3 天前", value: "3d" },
  { label: "1 周前", value: "1w" },
]

export function TimeFilterSelect({ value, onChange }: TimeFilterSelectProps) {
  return (
    <div className="flex rounded-md border border-neutral-200 p-0.5 dark:border-neutral-700">
      {TIME_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded px-2 py-1 text-xs transition-colors",
            value === option.value
              ? "bg-white shadow-sm font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
