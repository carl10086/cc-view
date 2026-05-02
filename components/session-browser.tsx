"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
import { SessionSidebar } from "./session-sidebar"
import { MessageStream } from "./message-stream"
import { buildWorktreeProjectId } from "@/lib/worktree"
import type { SessionInfo, SessionMessage, WorktreeInfo } from "@/types/claude"

interface SessionBrowserProps {
  projectId: string
  sessions: SessionInfo[]
  worktrees: WorktreeInfo[]
  worktreeSessions: Record<string, SessionInfo[]>
}

const PAGE_SIZE = 500

export function SessionBrowser({ projectId, sessions, worktrees, worktreeSessions }: SessionBrowserProps) {
  const [activeWorktree, setActiveWorktree] = useState<string | null>(null)

  const effectiveProjectId = activeWorktree
    ? buildWorktreeProjectId(projectId, activeWorktree)
    : projectId

  const currentSessions = activeWorktree
    ? (worktreeSessions[activeWorktree] ?? [])
    : sessions

  const [selectedId, setSelectedId] = useState<string | null>(
    currentSessions[0]?.id ?? null
  )
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset selectedId when worktree changes to avoid stale selection
  useEffect(() => {
    setSelectedId(currentSessions[0]?.id ?? null)
  }, [effectiveProjectId, currentSessions])

  // Reset and load first page when session changes
  useEffect(() => {
    if (!selectedId) return
    const sessionId = selectedId
    const controller = new AbortController()

    async function fetchMessages() {
      setLoading(true)
      setError(null)
      setMessages([])
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0
      }
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(effectiveProjectId)}/sessions/${encodeURIComponent(sessionId)}?offset=0&limit=${PAGE_SIZE}`,
          { signal: controller.signal }
        )
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json()
        setMessages(data.messages || [])
        setHasMore(data.hasMore || false)
        setTotal(data.total || 0)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        )
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
    return () => controller.abort()
  }, [effectiveProjectId, selectedId])

  async function loadMore() {
    if (!selectedId || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(effectiveProjectId)}/sessions/${encodeURIComponent(selectedId)}?offset=${messages.length}&limit=${PAGE_SIZE}`
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setMessages((prev) => [...prev, ...(data.messages || [])])
      setHasMore(data.hasMore || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <Card className="h-[calc(100vh-12rem)] overflow-hidden">
          <SessionSidebar
            sessions={currentSessions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Card>
      </div>

      {/* Detail */}
      <div className="lg:col-span-3">
        <Card className="flex h-[calc(100vh-12rem)] flex-col overflow-hidden">
          {/* Header */}
          {total > 0 && (
            <div className="border-b border-neutral-100 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800">
              Showing {messages.length} of {total} messages
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-neutral-500">Loading messages...</p>
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-red-500">Error: {error}</p>
              </div>
            )}
            {!loading && !error && (
              <MessageStream ref={scrollRef} messages={messages} />
            )}
          </div>

          {/* Load more */}
          {hasMore && !loading && (
            <div className="border-t border-neutral-100 p-3 text-center dark:border-neutral-800">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                {loadingMore ? "Loading..." : `Load more (${total - messages.length} remaining)`}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
