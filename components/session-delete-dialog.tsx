"use client"

import { useEffect, useRef } from "react"
import { Trash2, AlertTriangle } from "lucide-react"
import type { SessionInfo } from "@/types/claude"

interface SessionDeleteDialogProps {
  session: SessionInfo | null
  onConfirm: () => void
  onCancel: () => void
}

export function SessionDeleteDialog({
  session,
  onConfirm,
  onCancel,
}: SessionDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (session) {
      dialog.showModal?.()
    } else {
      dialog.close?.()
    }
  }, [session])

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
      {session && (
        <div className="w-full max-w-sm p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Delete session
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Are you sure you want to delete{" "}
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {session.title ?? session.id.slice(0, 8)}
                </span>?
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              This will remove {session.messageCount} message
              {session.messageCount !== 1 ? "s" : ""}.
            </div>
            <p className="mt-1 font-medium text-red-600 dark:text-red-400">
              This action cannot be undone.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none dark:bg-red-700 dark:hover:bg-red-800"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
