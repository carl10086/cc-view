"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Search } from "lucide-react"
import {
  defaultSortOrder,
  serializeUrlState,
  type Period,
  type SortKey,
  type UrlState,
} from "@/lib/project-filters"

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

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "sessions", label: "Sessions" },
  { value: "name", label: "Name" },
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
      <select
        value={urlState.sort}
        onChange={(e) => {
          const sort = e.target.value as SortKey
          router.replace(
            buildHref({ ...urlState, sort, order: defaultSortOrder(sort) }),
            { scroll: false }
          )
        }}
        aria-label="Sort projects by"
        className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          const order = urlState.order === "asc" ? "desc" : "asc"
          router.replace(buildHref({ ...urlState, order }), { scroll: false })
        }}
        aria-label={`Toggle sort order (currently ${urlState.order === "asc" ? "ascending" : "descending"})`}
        className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-700 hover:bg-neutral-50 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {urlState.order === "asc" ? (
          <ArrowUp className="h-4 w-4" aria-hidden />
        ) : (
          <ArrowDown className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )
}
