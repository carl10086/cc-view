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

const CONTROL_BASE =
  "rounded-md border border-neutral-300 bg-white text-neutral-700 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
const INPUT_CLASS = `${CONTROL_BASE} w-full py-1.5 pl-8 pr-3 text-sm`
const SELECT_CLASS = `${CONTROL_BASE} px-2 py-1.5 text-sm`
const BUTTON_CLASS = `${CONTROL_BASE} p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800`

function buildHref(state: UrlState): string {
  return `/projects${serializeUrlState(state)}`
}

export function ProjectsToolbar({ urlState }: ProjectsToolbarProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(urlState.q)

  useEffect(() => {
    // Sync local draft when URL state changes from outside (back/forward nav).
    // This is the controlled-input reset pattern; setState in effect is
    // intentional here. See https://react.dev/learn/you-might-not-need-an-effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(urlState.q)
  }, [urlState.q])

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
          className={INPUT_CLASS}
        />
      </div>
      <select
        value={urlState.period}
        onChange={(e) => {
          const period = e.target.value as Period
          router.replace(buildHref({ ...urlState, period }), { scroll: false })
        }}
        aria-label="Filter by last active time"
        className={SELECT_CLASS}
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
        className={SELECT_CLASS}
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
        className={BUTTON_CLASS}
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
