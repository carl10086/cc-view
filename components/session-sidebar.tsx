"use client"

import { formatDistanceToNow } from "date-fns"
import { MessageSquare, FileText } from "lucide-react"
import type { SessionInfo } from "@/types/claude"

interface SessionSidebarProps {
  sessions: SessionInfo[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function SessionSidebar({ sessions, selectedId, onSelect }: SessionSidebarProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <FileText className="mb-3 h-8 w-8 text-neutral-400" />
        <p className="text-sm text-neutral-500">No sessions found</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Sessions
        </h2>
        <p className="text-xs text-neutral-500">{sessions.length} total</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`w-full cursor-pointer border-b border-neutral-100 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900 ${
              selectedId === session.id
                ? "bg-neutral-100 dark:bg-neutral-800"
                : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {session.title ?? session.id.slice(0, 8)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span>{session.messageCount} messages</span>
                  <span>·</span>
                  <span>
                    {formatDistanceToNow(session.lastModified, {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
