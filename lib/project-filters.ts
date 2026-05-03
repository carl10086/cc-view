import type { ProjectInfo } from "@/types/claude"

export type Period = "any" | "today" | "7d" | "30d" | "90d"
export type SortKey = "recent" | "sessions" | "name"
export type SortOrder = "asc" | "desc"

export interface FilterState {
  q: string
  period: Period
  emptyOnly?: boolean
}

export interface SortState {
  sort: SortKey
  order: SortOrder
}

export type UrlState = FilterState & SortState

const PERIODS: readonly Period[] = ["any", "today", "7d", "30d", "90d"] as const
const SORT_KEYS: readonly SortKey[] = ["recent", "sessions", "name"] as const
const SORT_ORDERS: readonly SortOrder[] = ["asc", "desc"] as const

const DAY_MS = 24 * 60 * 60 * 1000

export function defaultSortOrder(sort: SortKey): SortOrder {
  return sort === "name" ? "asc" : "desc"
}

function periodLowerBound(period: Period): number | null {
  if (period === "any") return null
  if (period === "today") {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
  return Date.now() - days * DAY_MS
}

export function filterProjects(
  projects: ProjectInfo[],
  state: FilterState
): ProjectInfo[] {
  const needle = state.q.trim().toLowerCase()
  const lowerBound = periodLowerBound(state.period)

  return projects.filter((p) => {
    if (needle && !p.name.toLowerCase().includes(needle)) return false
    if (lowerBound !== null && p.lastModified.getTime() < lowerBound) return false
    if (state.emptyOnly && p.sessionCount !== 0) return false
    return true
  })
}

export function sortProjects(
  projects: ProjectInfo[],
  state: SortState
): ProjectInfo[] {
  const direction = state.order === "asc" ? 1 : -1
  const copy = [...projects]
  copy.sort((a, b) => {
    let cmp: number
    switch (state.sort) {
      case "recent":
        cmp = a.lastModified.getTime() - b.lastModified.getTime()
        break
      case "sessions":
        cmp = a.sessionCount - b.sessionCount
        break
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        break
    }
    return cmp * direction
  })
  return copy
}

function isPeriod(v: string | null): v is Period {
  return v !== null && (PERIODS as readonly string[]).includes(v)
}
function isSortKey(v: string | null): v is SortKey {
  return v !== null && (SORT_KEYS as readonly string[]).includes(v)
}
function isSortOrder(v: string | null): v is SortOrder {
  return v !== null && (SORT_ORDERS as readonly string[]).includes(v)
}

export function parseUrlState(sp: Pick<URLSearchParams, "get">): UrlState {
  const q = (sp.get("q") ?? "").trim()
  const rawPeriod = sp.get("period")
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : "any"
  const rawSort = sp.get("sort")
  const sort: SortKey = isSortKey(rawSort) ? rawSort : "recent"
  const rawOrder = sp.get("order")
  const order: SortOrder = isSortOrder(rawOrder) ? rawOrder : defaultSortOrder(sort)
  const result: UrlState = { q, period, sort, order }
  if (sp.get("empty") === "1") {
    result.emptyOnly = true
  }
  return result
}

export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams()
  const q = state.q.trim()
  if (q) params.set("q", q)
  if (state.period !== "any") params.set("period", state.period)
  if (state.sort !== "recent") params.set("sort", state.sort)
  if (state.order !== defaultSortOrder(state.sort)) params.set("order", state.order)
  if (state.emptyOnly) params.set("empty", "1")
  const s = params.toString()
  return s ? `?${s}` : ""
}
