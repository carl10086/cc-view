"use client"

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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
    >
      {TIME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
