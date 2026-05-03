"use client"

import { useState, useCallback } from "react"
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react"

interface JsonTreeProps {
  data: unknown
  defaultCollapsed?: number
  className?: string
}

export function JsonTree({ data, defaultCollapsed = 1, className = "" }: JsonTreeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [data])

  return (
    <div className={`relative rounded-md border border-neutral-200 bg-neutral-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        title="Copy JSON"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </>
        )}
      </button>
      <div className="pr-16">
        <JsonNode value={data} depth={0} defaultCollapsed={defaultCollapsed} />
      </div>
    </div>
  )
}

interface JsonNodeProps {
  value: unknown
  depth: number
  propertyKey?: string
  defaultCollapsed: number
}

function JsonNode({ value, depth, propertyKey, defaultCollapsed }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < defaultCollapsed)

  const indent = depth > 0 ? `ml-3 pl-2 border-l border-neutral-200 dark:border-neutral-800` : ""

  // Property key prefix
  const keyPrefix = propertyKey !== undefined ? (
    <span className="text-neutral-500 dark:text-neutral-400">"{propertyKey}": </span>
  ) : null

  if (value === null) {
    return (
      <div className={`text-xs ${indent}`}>
        {keyPrefix}
        <span className="text-purple-500 dark:text-purple-400">null</span>
      </div>
    )
  }

  if (typeof value === "boolean") {
    return (
      <div className={`text-xs ${indent}`}>
        {keyPrefix}
        <span className="text-purple-500 dark:text-purple-400">{value ? "true" : "false"}</span>
      </div>
    )
  }

  if (typeof value === "number") {
    return (
      <div className={`text-xs ${indent}`}>
        {keyPrefix}
        <span className="text-blue-600 dark:text-blue-400">{value}</span>
      </div>
    )
  }

  if (typeof value === "string") {
    const display = value.length > 200 ? value.slice(0, 200) + "..." : value
    return (
      <div className={`text-xs ${indent}`}>
        {keyPrefix}
        <span className="text-green-600 dark:text-green-400">"{display}"</span>
      </div>
    )
  }

  if (Array.isArray(value)) {
    const isEmpty = value.length === 0
    return (
      <div className={indent}>
        <div className="flex items-center gap-0.5">
          {!isEmpty && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-4 w-4 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
          {keyPrefix}
          <span className="text-neutral-600 dark:text-neutral-300">
            {isEmpty ? "[]" : isExpanded ? "[" : `[...${value.length} items]`}
          </span>
        </div>
        {isExpanded && !isEmpty && (
          <div className="mt-0.5">
            {value.map((item, i) => (
              <JsonNode key={i} value={item} depth={depth + 1} defaultCollapsed={defaultCollapsed} />
            ))}
            <div className="text-xs text-neutral-600 dark:text-neutral-300">]</div>
          </div>
        )}
      </div>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    const isEmpty = entries.length === 0
    return (
      <div className={indent}>
        <div className="flex items-center gap-0.5">
          {!isEmpty && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-4 w-4 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
          {keyPrefix}
          <span className="text-neutral-600 dark:text-neutral-300">
            {isEmpty ? "{}" : isExpanded ? "{" : `{...${entries.length} keys}`}
          </span>
        </div>
        {isExpanded && !isEmpty && (
          <div className="mt-0.5">
            {entries.map(([key, val]) => (
              <JsonNode
                key={key}
                propertyKey={key}
                value={val}
                depth={depth + 1}
                defaultCollapsed={defaultCollapsed}
              />
            ))}
            <div className="text-xs text-neutral-600 dark:text-neutral-300">{"}"}</div>
          </div>
        )}
      </div>
    )
  }

  // Fallback for other types
  return (
    <div className={`text-xs ${indent}`}>
      {keyPrefix}
      <span className="text-neutral-600 dark:text-neutral-300">{String(value)}</span>
    </div>
  )
}
