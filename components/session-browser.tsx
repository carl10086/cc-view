"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
import { SessionSidebar } from "./session-sidebar"
import { MessageStream } from "./message-stream"
import { SessionDeleteDialog } from "./session-delete-dialog"
import { WorktreeDeleteDialog } from "./worktree-delete-dialog"
import { buildWorktreeProjectId } from "@/lib/worktree"
import type { SessionInfo, SessionMessage, WorktreeInfo } from "@/types/claude"

interface SessionBrowserProps {
  projectId: string
  projectName?: string
  sessions: SessionInfo[]
  worktrees: WorktreeInfo[]
  worktreeSessions: Record<string, SessionInfo[]>
}

const PAGE_SIZE = 500

export function SessionBrowser({ projectId, projectName, sessions, worktrees, worktreeSessions }: SessionBrowserProps) {
  const [activeWorktree, setActiveWorktree] = useState<string | null>(null)

  const effectiveProjectId = activeWorktree
    ? buildWorktreeProjectId(projectId, activeWorktree)
    : projectId

  const [currentSessions, setCurrentSessions] = useState<SessionInfo[]>(
    activeWorktree ? (worktreeSessions[activeWorktree] ?? []) : sessions
  )

  useEffect(() => {
    setCurrentSessions(activeWorktree ? (worktreeSessions[activeWorktree] ?? []) : sessions)
  }, [activeWorktree, worktreeSessions, sessions])

  const [selectedId, setSelectedId] = useState<string | null>(
    currentSessions[0]?.id ?? null
  )
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [isFullyLoaded, setIsFullyLoaded] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<SessionInfo | null>(null)
  const [worktreeToDelete, setWorktreeToDelete] = useState<WorktreeInfo | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  // Reset selectedId when worktree changes to avoid stale selection
  useEffect(() => {
    setSelectedId(currentSessions[0]?.id ?? null)
  }, [effectiveProjectId])

  // Defensive: reset selectedId if it no longer exists in currentSessions
  useEffect(() => {
    setSelectedId((prev) => {
      if (prev && currentSessions.some((s) => s.id === prev)) {
        return prev
      }
      return currentSessions[0]?.id ?? null
    })
  }, [currentSessions])

  // Reset and load first page when session changes
  useEffect(() => {
    if (!selectedId) return
    const sessionId = selectedId
    const controller = new AbortController()

    async function fetchMessages() {
      setLoading(true)
      setError(null)
      setMessages([])
      setHasMore(false)
      setIsFullyLoaded(false)
      setTotal(0)
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
        if (!data.hasMore) {
          setIsFullyLoaded(true)
        }
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
    if (!selectedId || loadingMore || isFullyLoaded) return
    const targetProjectId = effectiveProjectId
    const targetSessionId = selectedId
    const myRequestId = ++requestIdRef.current
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(targetProjectId)}/sessions/${encodeURIComponent(targetSessionId)}?offset=${messages.length}&limit=${PAGE_SIZE}`
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      // Discard stale results if user switched worktree or session
      if (requestIdRef.current !== myRequestId) {
        return
      }
      setMessages((prev) => [...prev, ...(data.messages || [])])
      setHasMore(data.hasMore || false)
      if (!data.hasMore) {
        setIsFullyLoaded(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

  const handleScrollNearBottom = useCallback(() => {
    if (hasMore && !loadingMore && !isFullyLoaded) {
      loadMore()
    }
  }, [hasMore, loadingMore, isFullyLoaded])

  async function loadAll() {
    if (!selectedId || loadingMore || isFullyLoaded) return
    const targetProjectId = effectiveProjectId
    const targetSessionId = selectedId
    const myRequestId = ++requestIdRef.current
    setLoadingMore(true)
    try {
      let accumulated = [...messages]
      let more = hasMore
      while (more) {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(targetProjectId)}/sessions/${encodeURIComponent(targetSessionId)}?offset=${accumulated.length}&limit=${PAGE_SIZE}`
        )
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json()
        if (requestIdRef.current !== myRequestId) {
          return
        }
        accumulated = [...accumulated, ...(data.messages || [])]
        more = data.hasMore || false
        setMessages(accumulated)
        setHasMore(more)
      }
      setIsFullyLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load all")
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleConfirmDelete() {
    if (!sessionToDelete) return

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(effectiveProjectId)}/sessions/${encodeURIComponent(sessionToDelete.id)}`,
        { method: "DELETE" }
      )

      if (res.status === 204) {
        // Remove from local state
        setCurrentSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id))
        setSessionToDelete(null)
      } else if (res.status === 409) {
        alert("Cannot delete an active session.")
        setSessionToDelete(null)
      } else {
        const body = await res.json().catch(() => ({ error: "Unknown error" }))
        alert(body.error || "Failed to delete session.")
        setSessionToDelete(null)
      }
    } catch {
      alert("Failed to delete session.")
      setSessionToDelete(null)
    }
  }

  async function handleConfirmDeleteWorktree() {
    if (!worktreeToDelete) return

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/worktrees/${encodeURIComponent(worktreeToDelete.name)}`,
        { method: "DELETE" }
      )

      if (res.status === 204) {
        setActiveWorktree(null)
        setWorktreeToDelete(null)
      } else {
        const body = await res.json().catch(() => ({ error: "Unknown error" }))
        alert(body.error || "Failed to delete worktree.")
        setWorktreeToDelete(null)
      }
    } catch {
      alert("Failed to delete worktree.")
      setWorktreeToDelete(null)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="h-[calc(100vh-12rem)] overflow-hidden">
            <SessionSidebar
              sessions={currentSessions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              worktrees={worktrees}
              activeWorktree={activeWorktree}
              onWorktreeChange={setActiveWorktree}
              onSessionDelete={(id) => {
                const session = currentSessions.find((s) => s.id === id)
                if (session) setSessionToDelete(session)
              }}
              onWorktreeDelete={(name) => {
                const wt = worktrees.find((w) => w.name === name)
                if (wt) setWorktreeToDelete(wt)
              }}
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
              <MessageStream ref={scrollRef} messages={messages} onScrollNearBottom={handleScrollNearBottom} />
            )}
          </div>

          {/* Load more */}
          {!loading && !isFullyLoaded && (
            <div className="border-t border-neutral-100 p-2 text-center text-xs text-neutral-400 dark:border-neutral-800">
              {hasMore
                ? `Scroll to load more • ${total - messages.length} remaining`
                : "All messages loaded"}
            </div>
          )}
          {isFullyLoaded && (
            <div className="border-t border-neutral-100 p-2 text-center text-xs text-neutral-400 dark:border-neutral-800">
              All messages loaded
            </div>
          )}
        </Card>
      </div>
    </div>
    <SessionDeleteDialog
      session={sessionToDelete}
      onConfirm={handleConfirmDelete}
      onCancel={() => setSessionToDelete(null)}
    />
    <WorktreeDeleteDialog
      worktree={worktreeToDelete}
      projectName={projectName ?? ""}
      onConfirm={handleConfirmDeleteWorktree}
      onCancel={() => setWorktreeToDelete(null)}
    />
  </>
  )
}
