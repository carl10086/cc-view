"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { CleanupDialog } from "./cleanup-dialog"
import type { SessionInfo, WorktreeInfo } from "@/types/claude"

interface ProjectCleanupButtonProps {
  projectId: string
  projectName: string
  sessions: SessionInfo[]
  worktrees: WorktreeInfo[]
  worktreeSessions: Record<string, SessionInfo[]>
}

export function ProjectCleanupButton({
  projectId,
  projectName,
  sessions,
  worktrees,
  worktreeSessions,
}: ProjectCleanupButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    deletedSessions: number
    deletedWorktrees: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const emptySessionCount = useMemo(() => {
    const mainEmpty = sessions.filter((s) => s.messageCount === 0).length
    let wtEmpty = 0
    for (const wt of worktrees) {
      const wtSessions = worktreeSessions[wt.name] ?? []
      wtEmpty += wtSessions.filter((s) => s.messageCount === 0).length
    }
    return mainEmpty + wtEmpty
  }, [sessions, worktrees, worktreeSessions])

  const estimatedWorktrees = useMemo(() => {
    // A worktree will be deleted only if ALL its sessions are empty
    let count = 0
    for (const wt of worktrees) {
      const wtSessions = worktreeSessions[wt.name] ?? []
      const hasNonEmpty = wtSessions.some((s) => s.messageCount > 0)
      if (!hasNonEmpty && wtSessions.length > 0) {
        count++
      }
    }
    return count
  }, [worktrees, worktreeSessions])

  const hasEmptySessions = emptySessionCount > 0

  const handleOpen = useCallback(() => {
    setResult(null)
    setError(null)
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    const hadResult = result !== null
    setIsOpen(false)
    setResult(null)
    setError(null)
    if (hadResult) {
      router.refresh()
    }
  }, [result, router])

  const handleConfirm = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/cleanup`,
        { method: "POST" }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setResult(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  if (!hasEmptySessions) {
    return null
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
      >
        <Trash2 className="h-4 w-4" />
        Clean up empty sessions ({emptySessionCount})
      </button>

      <CleanupDialog
        isOpen={isOpen}
        projectName={projectName}
        estimatedSessions={emptySessionCount}
        estimatedWorktrees={estimatedWorktrees}
        result={result}
        error={error}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    </>
  )
}
