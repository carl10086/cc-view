"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MessageTypeCardProps {
  filterType: string
  label: string
  color: string
  bgColor: string
  description: string
  exampleJson?: object
}

export function MessageTypeCard({
  filterType,
  label,
  color,
  bgColor,
  description,
  exampleJson,
}: MessageTypeCardProps) {
  const [showJson, setShowJson] = useState(false)

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-md"
      )}
      data-testid={`card-${filterType}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          data-testid="badge-label"
          className={cn(
            "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
            color,
            bgColor
          )}
        >
          {label}
        </span>
        <code data-testid="filter-type" className="text-sm text-muted-foreground">{filterType}</code>
      </div>

      <p className="text-sm text-card-foreground leading-relaxed">{description}</p>

      {exampleJson && (
        <div className="mt-3">
          <button
            onClick={() => setShowJson(!showJson)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showJson ? (
              <>
                <ChevronUp className="h-3 w-3" />
                收起示例
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                查看示例
              </>
            )}
          </button>

          {showJson && (
            <pre data-testid="json-example" className="mt-2 rounded-md bg-muted p-3 text-xs overflow-x-auto">
              <code>{JSON.stringify(exampleJson, null, 2)}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
