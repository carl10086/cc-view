"use client"

import { useEffect, useRef } from "react"
import { Trash2, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

interface CleanupResult {
  deletedSessions: number
  deletedWorktrees: number
}

interface CleanupDialogProps {
  isOpen: boolean
  projectName: string
  estimatedSessions: number
  estimatedWorktrees: number
  result: CleanupResult | null
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

export function CleanupDialog({
  isOpen,
  projectName,
  estimatedSessions,
  estimatedWorktrees,
  result,
  error,
  onConfirm,
  onClose,
}: CleanupDialogProps) {
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

  const isConfirmationPhase = result === null && error === null

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg border border-neutral-200 bg-white p-0 shadow-lg backdrop:bg-neutral-900/50 dark:border-neutral-700 dark:bg-neutral-900"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose()
        }
      }}
    >
      {isOpen && (
        <div className="w-full max-w-sm p-6">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                error
                  ? "bg-red-100 dark:bg-red-900"
                  : isConfirmationPhase
                    ? "bg-amber-100 dark:bg-amber-900"
                    : "bg-green-100 dark:bg-green-900"
              }`}
            >
              {error ? (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
              ) : isConfirmationPhase ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {error
                  ? "Cleanup failed"
                  : isConfirmationPhase
                    ? "Clean up empty sessions"
                    : "Cleanup complete"}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                {isConfirmationPhase ? (
                  <>
                    Clean up empty sessions in{" "}
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {projectName}
                    </span>
                    ?
                  </>
                ) : error ? (
                  "The cleanup could not be completed."
                ) : (
                  "The following resources have been cleaned up:"
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {isConfirmationPhase ? (
              <>
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Will delete {estimatedSessions} empty session
                  {estimatedSessions !== 1 ? "s" : ""}
                </div>
                {estimatedWorktrees > 0 && (
                  <p className="mt-1">
                    May cascade delete {estimatedWorktrees} empty worktree
                    {estimatedWorktrees !== 1 ? "s" : ""}
                  </p>
                )}
                <p className="mt-1 font-medium text-amber-600 dark:text-amber-400">
                  This action cannot be undone.
                </p>
              </>
            ) : error ? (
              <p className="text-red-700 dark:text-red-400">{error}</p>
            ) : (
              <>
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  Deleted {result!.deletedSessions} empty session
                  {result!.deletedSessions !== 1 ? "s" : ""}
                </div>
                {result!.deletedWorktrees > 0 && (
                  <p className="mt-1 text-green-700 dark:text-green-400">
                    Deleted {result!.deletedWorktrees} empty worktree
                    {result!.deletedWorktrees !== 1 ? "s" : ""}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {isConfirmationPhase ? "Cancel" : "Close"}
            </button>
            {isConfirmationPhase && (
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none dark:bg-red-700 dark:hover:bg-red-800"
              >
                Clean up
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
