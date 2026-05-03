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

  const emptySessions = useMemo(() => {
    const mainEmpty = sessions.filter((s) => s.messageCount === 0)
    const wtEmpty: SessionInfo[] = []
    for (const wt of worktrees) {
      const wtSessions = worktreeSessions[wt.name] ?? []
      wtEmpty.push(...wtSessions.filter((s) => s.messageCount === 0))
    }
    return [...mainEmpty, ...wtEmpty]
  }, [sessions, worktrees, worktreeSessions])

  const estimatedWorktrees = useMemo(() => {
    return worktrees.filter((wt) => wt.sessionCount === 0).length
  }, [worktrees])

  const hasEmptySessions = emptySessions.length > 0

  const handleOpen = useCallback(() => {
    setResult(null)
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    const hadResult = result !== null
    setIsOpen(false)
    setResult(null)
    if (hadResult) {
      router.refresh()
    }
  }, [result, router])

  const handleConfirm = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/cleanup`,
        { method: "POST" }
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ deletedSessions: 0, deletedWorktrees: 0 })
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
        Clean up empty sessions ({emptySessions.length})
      </button>

      <CleanupDialog
        isOpen={isOpen}
        projectName={projectName}
        estimatedSessions={emptySessions.length}
        estimatedWorktrees={estimatedWorktrees}
        result={result}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    </>
  )
}
