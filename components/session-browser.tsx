"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { SessionSidebar } from "./session-sidebar"
import { MessageStream } from "./message-stream"
import { SessionDeleteDialog } from "./session-delete-dialog"
import { WorktreeDeleteDialog } from "./worktree-delete-dialog"
import { buildWorktreeProjectId } from "@/lib/worktree"
import { cn } from "@/lib/utils"
import type { SessionInfo, SessionMessage, WorktreeInfo } from "@/types/claude"

interface SessionBrowserProps {
  projectId: string
  projectName?: string
  sessions: SessionInfo[]
  worktrees: WorktreeInfo[]
  worktreeSessions: Record<string, SessionInfo[]>
}

const DEFAULT_PAGE_SIZE = 500

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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [sessionToDelete, setSessionToDelete] = useState<SessionInfo | null>(null)
  const [worktreeToDelete, setWorktreeToDelete] = useState<WorktreeInfo | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  function cancelPending() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

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

  // Reset and load first page when session/sort/pageSize changes
  useEffect(() => {
    if (!selectedId) return
    const sessionId = selectedId
    cancelPending()
    const controller = new AbortController()
    abortControllerRef.current = controller
    const myRequestId = ++requestIdRef.current

    async function fetchMessages() {
      setLoading(true)
      setError(null)
      setMessages([])
      setHasMore(false)
      setIsFullyLoaded(false)
      setSelectedTypes(new Set())
      setTotal(0)
      if (scrollRef.current) {
        scrollRef.current.scrollTop = sortOrder === 'asc' ? 0 : scrollRef.current.scrollHeight
      }
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(effectiveProjectId)}/sessions/${encodeURIComponent(sessionId)}?offset=0&limit=${pageSize}&order=${sortOrder}`,
          { signal: controller.signal }
        )
        if (requestIdRef.current !== myRequestId) {
          return
        }
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
        if (requestIdRef.current !== myRequestId) {
          return
        }
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        )
      } finally {
        if (requestIdRef.current === myRequestId) {
          setLoading(false)
        }
      }
    }

    fetchMessages()
    return () => controller.abort()
  }, [effectiveProjectId, selectedId, sortOrder, pageSize])

  async function loadMore() {
    if (!selectedId || loadingMore || isFullyLoaded) return
    const targetProjectId = effectiveProjectId
    const targetSessionId = selectedId
    const myRequestId = ++requestIdRef.current
    cancelPending()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(targetProjectId)}/sessions/${encodeURIComponent(targetSessionId)}?offset=${messages.length}&limit=${pageSize}&order=${sortOrder}`,
        { signal: controller.signal }
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
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      if (requestIdRef.current !== myRequestId) {
        return
      }
      setError(err instanceof Error ? err.message : "Failed to load more")
    } finally {
      if (requestIdRef.current === myRequestId) {
        setLoadingMore(false)
      }
    }
  }

  const selectedSession = currentSessions.find((s) => s.id === selectedId)

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
    cancelPending()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoadingMore(true)
    try {
      let accumulated = [...messages]
      let more = hasMore
      while (more) {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(targetProjectId)}/sessions/${encodeURIComponent(targetSessionId)}?offset=${accumulated.length}&limit=${pageSize}&order=${sortOrder}`,
          { signal: controller.signal }
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
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      if (requestIdRef.current !== myRequestId) {
        return
      }
      setError(err instanceof Error ? err.message : "Failed to load all")
    } finally {
      if (requestIdRef.current === myRequestId) {
        setLoadingMore(false)
      }
    }
  }

  // Derived: available types for filtering
  const availableTypes = useMemo(() => {
    if (!isFullyLoaded) return []
    const types = new Set<string>()
    messages.forEach((m) => types.add(m.type))
    return Array.from(types).sort()
  }, [messages, isFullyLoaded])

  // Derived: filtered messages
  const filteredMessages = useMemo(() => {
    if (!isFullyLoaded || selectedTypes.size === 0) return messages
    return messages.filter((m) => selectedTypes.has(m.type))
  }, [messages, isFullyLoaded, selectedTypes])

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
            <div className="border-b border-neutral-100 px-4 py-2 dark:border-neutral-800">
              {/* Row 1: stats + controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-neutral-500">
                  {isFullyLoaded && selectedTypes.size > 0
                    ? `Showing ${filteredMessages.length} of ${total} messages (filtered)`
                    : `Showing ${messages.length} of ${total} messages`}
                  {loadingMore && " • loading..."}
                </span>

                <div className="flex items-center gap-2">
                  {/* Sort order toggle */}
                  <div className="flex rounded-md border border-neutral-200 p-0.5 dark:border-neutral-700">
                    <button
                      onClick={() => setSortOrder("asc")}
                      disabled={loadingMore}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs transition-colors",
                        sortOrder === "asc"
                          ? "bg-white shadow-sm dark:bg-neutral-800"
                          : "text-neutral-500 hover:text-neutral-700"
                      )}
                    >
                      Oldest first
                    </button>
                    <button
                      onClick={() => setSortOrder("desc")}
                      disabled={loadingMore}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs transition-colors",
                        sortOrder === "desc"
                          ? "bg-white shadow-sm dark:bg-neutral-800"
                          : "text-neutral-500 hover:text-neutral-700"
                      )}
                    >
                      Newest first
                    </button>
                  </div>

                  {/* Page size selector */}
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    disabled={loadingMore}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                  >
                    <option value={500}>500/page</option>
                    <option value={1000}>1k/page</option>
                    <option value={2000}>2k/page</option>
                  </select>

                  {/* Load all */}
                  {!isFullyLoaded && (
                    <button
                      onClick={loadAll}
                      disabled={loadingMore}
                      className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      {loadingMore ? "Loading..." : "Load all"}
                    </button>
                  )}
                </div>
              </div>

              {/* Row 1.5: full firstPrompt preview */}
              {selectedSession?.firstPrompt && (
                <div className="mt-2 border-l-2 border-neutral-300 pl-3 dark:border-neutral-600">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {selectedSession.firstPrompt}
                  </p>
                </div>
              )}

              {/* Row 2: type filters */}
              {isFullyLoaded && availableTypes.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {availableTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setSelectedTypes((prev) => {
                          const next = new Set(prev)
                          if (next.has(type)) next.delete(type)
                          else next.add(type)
                          return next
                        })
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                        selectedTypes.has(type)
                          ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                  {selectedTypes.size > 0 && (
                    <button
                      onClick={() => setSelectedTypes(new Set())}
                      className="ml-1 text-xs text-neutral-400 hover:text-neutral-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Not fully loaded hint */}
              {!isFullyLoaded && (
                <p className="mt-1 text-xs text-neutral-400">
                  Scroll to load more, or click &quot;Load all&quot; to enable filtering
                </p>
              )}
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
              <MessageStream ref={scrollRef} messages={filteredMessages} onScrollNearBottom={handleScrollNearBottom} filterActive={isFullyLoaded && selectedTypes.size > 0} hasMore={hasMore} />
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
