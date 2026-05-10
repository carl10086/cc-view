"use client"

import { formatDistanceToNow } from "date-fns"
import { MessageSquare, FileText, Trash2 } from "lucide-react"
import type { SessionInfo, WorktreeInfo } from "@/types/claude"

const SIDEBAR_PREVIEW_MAX = 80

function truncatePreview(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + "…"
}

interface SessionSidebarProps {
  sessions: SessionInfo[]
  selectedId: string | null
  onSelect: (id: string) => void
  worktrees?: WorktreeInfo[]
  activeWorktree?: string | null
  onWorktreeChange?: (name: string | null) => void
  onSessionDelete?: (sessionId: string) => void
  onWorktreeDelete?: (worktreeName: string) => void
}

export function SessionSidebar({
  sessions,
  selectedId,
  onSelect,
  worktrees = [],
  activeWorktree,
  onWorktreeChange,
  onSessionDelete,
  onWorktreeDelete,
}: SessionSidebarProps) {
  const hasWorktrees = worktrees.length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        {hasWorktrees && (
          <div className="mb-2 flex items-center gap-2">
            <select
              value={activeWorktree ?? "main"}
              onChange={(e) => {
                const value = e.target.value
                onWorktreeChange?.(value === "main" ? null : value)
              }}
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            >
              <option value="main">main</option>
              {worktrees.map((wt) => (
                <option key={wt.name} value={wt.name}>
                  {wt.name}
                </option>
              ))}
            </select>
            {onWorktreeDelete && activeWorktree && (
              <button
                onClick={() => onWorktreeDelete(activeWorktree)}
                className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                title="Delete worktree"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Sessions
        </h2>
        <p className="text-xs text-neutral-500">{sessions.length} total</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <FileText className="mb-3 h-8 w-8 text-neutral-400" />
            <p className="text-sm text-neutral-500">No sessions found</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative flex cursor-pointer items-center border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900 ${
                selectedId === session.id
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : ""
              }`}
            >
              <button
                onClick={() => onSelect(session.id)}
                className="flex-1 min-w-0 px-4 py-3 text-left"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    {session.firstPrompt && (
                      <p className="truncate text-xs text-neutral-700 dark:text-neutral-300">
                        {truncatePreview(session.firstPrompt, SIDEBAR_PREVIEW_MAX)}
                      </p>
                    )}
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
              {onSessionDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSessionDelete(session.id)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  title="Delete session"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
