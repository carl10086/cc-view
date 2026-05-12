"use client"

import { useState, useMemo } from "react"
import { ChevronRight, ChevronDown, PanelLeftOpen, PanelLeftClose } from "lucide-react"
import { typeConfig } from "./compact-message"
import { formatTime } from "./format-time"
import type { MessageNavItem } from "@/lib/message-grouping"

interface MessageNavPanelProps {
  items: MessageNavItem[]
  onNavigate: (messageId: string) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  disabledHint?: string
}

export function MessageNavPanel({
  items,
  onNavigate,
  isCollapsed: externalCollapsed,
  onToggleCollapse,
  disabledHint,
}: MessageNavPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = externalCollapsed ?? internalCollapsed

  const grouped = useMemo(() => {
    const map = new Map<string, MessageNavItem[]>()
    for (const item of items) {
      const list = map.get(item.type) ?? []
      list.push(item)
      map.set(item.type, list)
    }
    return map
  }, [items])

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(type: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  if (isCollapsed) {
    return (
      <div className="flex h-full w-8 flex-col items-center border-l border-neutral-200 bg-neutral-50 py-2 dark:border-neutral-800 dark:bg-neutral-950">
        <button
          onClick={onToggleCollapse ?? (() => setInternalCollapsed(false))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          title="Expand navigation panel"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-60 flex-col border-l border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500">Nav</span>
        <button
          onClick={onToggleCollapse ?? (() => setInternalCollapsed(true))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          title="Collapse navigation panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {disabledHint ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-center text-xs text-neutral-400">{disabledHint}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-center text-xs text-neutral-400">No special messages</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([type, groupItems]) => {
            const config = Object.prototype.hasOwnProperty.call(typeConfig, type)
              ? typeConfig[type]
              : {
                  label: type,
                  color: "text-neutral-400",
                  bgColor: "bg-neutral-50 dark:bg-neutral-900/50",
                }
            const isExpanded = !collapsedGroups.has(type)

            return (
              <div key={type} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-800">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(type)}
                  aria-label={`${config.label} · ${groupItems.length}`}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900/50"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-neutral-400" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-neutral-400" />
                  )}
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.color} ${config.bgColor}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-[10px] text-neutral-400">· {groupItems.length}</span>
                </button>

                {/* Items */}
                {isExpanded && (
                  <div className="pb-1">
                    {groupItems.map((item) => (
                      <button
                        key={item.messageId}
                        onClick={() => onNavigate(item.messageId)}
                        className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900/50"
                      >
                        <span className="flex-1 truncate text-[11px] text-neutral-600 dark:text-neutral-400">
                          {item.preview.length > 30
                            ? item.preview.slice(0, 30) + "..."
                            : item.preview}
                        </span>
                        {item.timestamp && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            {formatTime(item.timestamp)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
