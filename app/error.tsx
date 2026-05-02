"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Something went wrong
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Unable to load Claude Code data. Make sure ~/.claude directory exists.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-2 text-xs text-red-500 font-mono">{error.message}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
