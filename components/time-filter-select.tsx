"use client"

import { cn } from "@/lib/utils"

interface TimeFilterSelectProps {
  value: string
  onChange: (value: string) => void
}

export const TIME_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "1天", value: "1d" },
  { label: "3天", value: "3d" },
  { label: "1周", value: "1w" },
  { label: "2周", value: "2w" },
  { label: "1月", value: "1m" },
]

export function TimeFilterSelect({ value, onChange }: TimeFilterSelectProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {TIME_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs transition-colors",
            value === option.value
              ? "border-neutral-400 bg-neutral-800 text-white font-medium dark:bg-neutral-200 dark:text-neutral-900"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-600"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
