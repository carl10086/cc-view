"use client"

import { useEffect, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { Trash2, AlertTriangle } from "lucide-react"
import type { SessionInfo } from "@/types/claude"

interface SessionBatchDeleteDialogProps {
  sessions: SessionInfo[]
  isOpen: boolean
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function SessionBatchDeleteDialog({
  sessions,
  isOpen,
  isDeleting,
  onConfirm,
  onCancel,
}: SessionBatchDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal?.()
    } else {
      dialog.close?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg border border-neutral-200 bg-white p-0 shadow-lg backdrop:bg-neutral-900/50 dark:border-neutral-700 dark:bg-neutral-900"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onCancel()
        }
      }}
    >
      <div className="w-full max-w-md p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              批量删除 Session
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              即将删除 <span className="font-medium text-neutral-900 dark:text-neutral-100">{sessions.length}</span> 个 session，此操作不可恢复。
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="h-4 w-4" />
            <span className="font-medium">将要删除的 session：</span>
            <span className="text-xs text-neutral-400 ml-auto">
              共 {totalMessages} 条消息
            </span>
          </div>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-700 last:border-0">
                <span className="truncate pr-2">{session.title ?? session.id.slice(0, 8)}</span>
                <span className="text-xs text-neutral-400 shrink-0">
                  {session.messageCount} 条 · {formatDistanceToNow(session.lastModified, { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
          >
            {isDeleting ? "删除中..." : `删除 ${sessions.length} 个`}
          </button>
        </div>
      </div>
    </dialog>
  )
}
