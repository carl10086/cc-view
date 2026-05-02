"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { serializeUrlState, type Period, type UrlState } from "@/lib/project-filters"

interface ProjectsToolbarProps {
  urlState: UrlState
}

const SEARCH_DEBOUNCE_MS = 250

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
]

function buildHref(state: UrlState): string {
  return `/projects${serializeUrlState(state)}`
}

export function ProjectsToolbar({ urlState }: ProjectsToolbarProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(urlState.q)
  const [lastSyncedQ, setLastSyncedQ] = useState(urlState.q)

  if (urlState.q !== lastSyncedQ) {
    setLastSyncedQ(urlState.q)
    setDraft(urlState.q)
  }

  useEffect(() => {
    if (draft === urlState.q) return
    const id = setTimeout(() => {
      router.replace(buildHref({ ...urlState, q: draft }), { scroll: false })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [draft, urlState, router])

  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search projects by name"
          className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-sm text-neutral-700 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
        />
      </div>
      <select
        value={urlState.period}
        onChange={(e) => {
          const period = e.target.value as Period
          router.replace(buildHref({ ...urlState, period }), { scroll: false })
        }}
        aria-label="Filter by last active time"
        className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
