"use client"

import { useState, useMemo } from "react"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, FileText, Trash2 } from "lucide-react"
import { TimeFilterSelect } from "./time-filter-select"
import { SessionBatchDeleteDialog } from "./session-batch-delete-dialog"
import type { SessionInfo, WorktreeInfo } from "@/types/claude"

const SIDEBAR_PREVIEW_MAX = 80

const TIME_THRESHOLDS: Record<string, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
}

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
  onBatchDelete?: (sessionIds: string[]) => Promise<void> | void
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
  onBatchDelete,
}: SessionSidebarProps) {
  const hasWorktrees = worktrees.length > 0
  const [timeFilter, setTimeFilter] = useState("all")
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isBatchMode = timeFilter !== "all"

  const filteredSessions = useMemo(() => {
    if (!isBatchMode) return sessions
    const threshold = TIME_THRESHOLDS[timeFilter]
    if (!threshold) return sessions
    const now = Date.now()
    return sessions.filter((s) => now - s.lastModified.getTime() > threshold)
  }, [sessions, timeFilter, isBatchMode])

  const sessionsToShow = isBatchMode ? filteredSessions : sessions
  const selectedSessions = useMemo(
    () => filteredSessions.filter((s) => selectedSessionIds.has(s.id)),
    [filteredSessions, selectedSessionIds]
  )

  const handleToggleSession = (sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      next.has(sessionId) ? next.delete(sessionId) : next.add(sessionId)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedSessionIds.size === filteredSessions.length) {
      setSelectedSessionIds(new Set())
    } else {
      setSelectedSessionIds(new Set(filteredSessions.map((s) => s.id)))
    }
  }

  const handleBatchDeleteConfirm = async () => {
    if (!onBatchDelete || selectedSessionIds.size === 0) return
    setIsDeleting(true)
    try {
      await onBatchDelete(Array.from(selectedSessionIds))
      setSelectedSessionIds(new Set())
      setTimeFilter("all")
    } finally {
      setIsDeleting(false)
      setIsBatchDeleteOpen(false)
    }
  }

  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value)
    setSelectedSessionIds(new Set())
  }

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
        {onBatchDelete && (
          <div className="mt-2">
            <TimeFilterSelect value={timeFilter} onChange={handleTimeFilterChange} />
          </div>
        )}
        {isBatchMode && filteredSessions.length > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSessionIds.size === filteredSessions.length && filteredSessions.length > 0}
                onChange={handleSelectAll}
                className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
              />
              全选
            </label>
            <span className="text-xs text-neutral-500">
              {filteredSessions.length} 个符合条件
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <FileText className="mb-3 h-8 w-8 text-neutral-400" />
            <p className="text-sm text-neutral-500">No sessions found</p>
          </div>
        ) : (
          sessionsToShow.map((session) => (
            <div
              key={session.id}
              className={`group relative flex cursor-pointer items-center border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900 ${
                selectedId === session.id
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : ""
              }`}
            >
              {isBatchMode && (
                <input
                  type="checkbox"
                  checked={selectedSessionIds.has(session.id)}
                  onChange={() => handleToggleSession(session.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-3 mr-1 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                />
              )}
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
      {isBatchMode && selectedSessionIds.size > 0 && (
        <div className="sticky bottom-0 border-t border-neutral-200 bg-gradient-to-t from-white via-white to-transparent px-4 py-3 dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950"
        >
          <button
            onClick={() => setIsBatchDeleteOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          >
            <Trash2 className="h-4 w-4" />
            删除已选的 {selectedSessionIds.size} 个 session
          </button>
        </div>
      )}
      <SessionBatchDeleteDialog
        sessions={selectedSessions}
        isOpen={isBatchDeleteOpen}
        isDeleting={isDeleting}
        onConfirm={handleBatchDeleteConfirm}
        onCancel={() => setIsBatchDeleteOpen(false)}
      />
    </div>
  )
}
