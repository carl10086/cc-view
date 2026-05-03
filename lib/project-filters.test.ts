import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  filterProjects,
  sortProjects,
  parseUrlState,
  serializeUrlState,
  defaultSortOrder,
  type Period,
  type SortKey,
} from "./project-filters"
import type { ProjectInfo } from "@/types/claude"

const NOW = new Date("2026-05-03T14:30:00")

const p1: ProjectInfo = {
  id: "p1",
  name: "cc-view",
  sessionCount: 10,
  lastModified: new Date("2026-05-03T10:00:00"),
  worktrees: [],
}
const p2: ProjectInfo = {
  id: "p2",
  name: "API.server",
  sessionCount: 5,
  lastModified: new Date("2026-05-02T12:00:00"),
  worktrees: [],
}
const p3: ProjectInfo = {
  id: "p3",
  name: "old-thing",
  sessionCount: 20,
  lastModified: new Date("2026-04-25T08:00:00"),
  worktrees: [],
}
const p4: ProjectInfo = {
  id: "p4",
  name: "ancient",
  sessionCount: 1,
  lastModified: new Date("2026-02-10T00:00:00"),
  worktrees: [],
}
const p5: ProjectInfo = {
  id: "p5",
  name: "fossil-old",
  sessionCount: 100,
  lastModified: new Date("2025-12-01T00:00:00"),
  worktrees: [],
}
const FIXTURE: ProjectInfo[] = [p1, p2, p3, p4, p5]

describe("filterProjects", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns all when q is empty and period is any", () => {
    expect(filterProjects(FIXTURE, { q: "", period: "any" })).toEqual(FIXTURE)
  })

  it("trims whitespace in q before treating as empty", () => {
    expect(filterProjects(FIXTURE, { q: "   ", period: "any" })).toEqual(FIXTURE)
  })

  it("matches name case-insensitively", () => {
    const upper = filterProjects(FIXTURE, { q: "CC", period: "any" })
    const lower = filterProjects(FIXTURE, { q: "cc", period: "any" })
    expect(upper).toEqual([p1])
    expect(lower).toEqual([p1])
  })

  it("matches name fragments containing special characters", () => {
    expect(filterProjects(FIXTURE, { q: ".server", period: "any" })).toEqual([p2])
    expect(filterProjects(FIXTURE, { q: "-", period: "any" })).toEqual([p1, p3, p5])
  })

  it("returns empty array when no name matches", () => {
    expect(filterProjects(FIXTURE, { q: "no-such", period: "any" })).toEqual([])
  })

  it("filters by period=today (local startOfDay)", () => {
    expect(filterProjects(FIXTURE, { q: "", period: "today" })).toEqual([p1])
  })

  it("filters by period=7d (rolling 7×24h window)", () => {
    expect(filterProjects(FIXTURE, { q: "", period: "7d" })).toEqual([p1, p2])
  })

  it("filters by period=30d (rolling 30×24h window)", () => {
    expect(filterProjects(FIXTURE, { q: "", period: "30d" })).toEqual([p1, p2, p3])
  })

  it("filters by period=90d (rolling 90×24h window)", () => {
    expect(filterProjects(FIXTURE, { q: "", period: "90d" })).toEqual([p1, p2, p3, p4])
  })

  it("includes projects exactly on the period boundary", () => {
    const boundary7d = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)
    const onEdge: ProjectInfo = { ...p3, id: "edge", lastModified: boundary7d }
    const result = filterProjects([onEdge], { q: "", period: "7d" })
    expect(result).toEqual([onEdge])
  })

  it("excludes projects modified before today's local startOfDay for period=today", () => {
    const lateYesterday: ProjectInfo = {
      ...p1,
      id: "yesterday-late",
      lastModified: new Date("2026-05-02T23:59:59"),
    }
    expect(
      filterProjects([lateYesterday], { q: "", period: "today" })
    ).toEqual([])
  })

  it("combines q and period (AND semantic)", () => {
    expect(
      filterProjects(FIXTURE, { q: "old", period: "30d" })
    ).toEqual([p3])
  })

  it("filters by emptyOnly=true (sessionCount === 0)", () => {
    const empty1: ProjectInfo = { ...p1, id: "empty1", sessionCount: 0 }
    const empty2: ProjectInfo = { ...p2, id: "empty2", sessionCount: 0 }
    const result = filterProjects(
      [p1, empty1, p2, empty2],
      { q: "", period: "any", emptyOnly: true }
    )
    expect(result).toEqual([empty1, empty2])
  })

  it("emptyOnly=false returns all projects", () => {
    expect(
      filterProjects(FIXTURE, { q: "", period: "any", emptyOnly: false })
    ).toEqual(FIXTURE)
  })

  it("emptyOnly undefined defaults to false", () => {
    expect(
      filterProjects(FIXTURE, { q: "", period: "any" })
    ).toEqual(FIXTURE)
  })

  it("combines emptyOnly with q (AND semantic)", () => {
    const emptyCc: ProjectInfo = { ...p1, id: "empty-cc", sessionCount: 0 }
    const emptyOther: ProjectInfo = { ...p2, id: "empty-other", sessionCount: 0 }
    const result = filterProjects(
      [p1, emptyCc, p2, emptyOther],
      { q: "cc", period: "any", emptyOnly: true }
    )
    expect(result).toEqual([emptyCc])
  })

  it("combines emptyOnly with period (AND semantic)", () => {
    const emptyOld: ProjectInfo = {
      ...p4,
      id: "empty-old",
      sessionCount: 0,
    }
    const emptyNew: ProjectInfo = {
      ...p1,
      id: "empty-new",
      sessionCount: 0,
    }
    const result = filterProjects(
      [p1, emptyOld, emptyNew],
      { q: "", period: "today", emptyOnly: true }
    )
    expect(result).toEqual([emptyNew])
  })

  it("does not mutate input array", () => {
    const copy = [...FIXTURE]
    filterProjects(FIXTURE, { q: "cc", period: "today" })
    expect(FIXTURE).toEqual(copy)
  })
})

describe("sortProjects", () => {
  it("sorts by recent desc (default)", () => {
    expect(sortProjects(FIXTURE, { sort: "recent", order: "desc" })).toEqual([
      p1,
      p2,
      p3,
      p4,
      p5,
    ])
  })

  it("sorts by recent asc", () => {
    expect(sortProjects(FIXTURE, { sort: "recent", order: "asc" })).toEqual([
      p5,
      p4,
      p3,
      p2,
      p1,
    ])
  })

  it("sorts by sessions desc", () => {
    expect(sortProjects(FIXTURE, { sort: "sessions", order: "desc" })).toEqual([
      p5,
      p3,
      p1,
      p2,
      p4,
    ])
  })

  it("sorts by sessions asc", () => {
    expect(sortProjects(FIXTURE, { sort: "sessions", order: "asc" })).toEqual([
      p4,
      p2,
      p1,
      p3,
      p5,
    ])
  })

  it("sorts by name asc (case-insensitive)", () => {
    expect(sortProjects(FIXTURE, { sort: "name", order: "asc" })).toEqual([
      p4, // ancient
      p2, // API.server
      p1, // cc-view
      p5, // fossil-old
      p3, // old-thing
    ])
  })

  it("sorts by name desc (case-insensitive)", () => {
    expect(sortProjects(FIXTURE, { sort: "name", order: "desc" })).toEqual([
      p3,
      p5,
      p1,
      p2,
      p4,
    ])
  })

  it("is stable when keys are equal", () => {
    const tieA: ProjectInfo = { ...p1, id: "tieA", name: "alpha", sessionCount: 5 }
    const tieB: ProjectInfo = { ...p1, id: "tieB", name: "alpha", sessionCount: 5 }
    const result = sortProjects([tieA, tieB], { sort: "sessions", order: "desc" })
    expect(result.map((x) => x.id)).toEqual(["tieA", "tieB"])
  })

  it("does not mutate input array", () => {
    const copy = [...FIXTURE]
    sortProjects(FIXTURE, { sort: "name", order: "asc" })
    expect(FIXTURE).toEqual(copy)
  })
})

describe("defaultSortOrder", () => {
  it("returns desc for recent", () => {
    expect(defaultSortOrder("recent")).toBe("desc")
  })
  it("returns desc for sessions", () => {
    expect(defaultSortOrder("sessions")).toBe("desc")
  })
  it("returns asc for name", () => {
    expect(defaultSortOrder("name")).toBe("asc")
  })
})

describe("parseUrlState", () => {
  it("returns full defaults when params are empty", () => {
    expect(parseUrlState(new URLSearchParams())).toEqual({
      q: "",
      period: "any",
      sort: "recent",
      order: "desc",
    })
  })

  it("trims q", () => {
    expect(parseUrlState(new URLSearchParams("q=  hello  ")).q).toBe("hello")
  })

  it("falls back to defaults on invalid period", () => {
    expect(parseUrlState(new URLSearchParams("period=foo")).period).toBe("any")
  })

  it("falls back to defaults on invalid sort", () => {
    expect(parseUrlState(new URLSearchParams("sort=bogus")).sort).toBe("recent")
  })

  it("derives default order from sort key when order is missing", () => {
    expect(parseUrlState(new URLSearchParams("sort=name")).order).toBe("asc")
    expect(parseUrlState(new URLSearchParams("sort=sessions")).order).toBe("desc")
    expect(parseUrlState(new URLSearchParams("sort=recent")).order).toBe("desc")
  })

  it("respects explicit order when valid", () => {
    expect(parseUrlState(new URLSearchParams("sort=name&order=desc")).order).toBe(
      "desc"
    )
    expect(parseUrlState(new URLSearchParams("sort=recent&order=asc")).order).toBe(
      "asc"
    )
  })

  it("falls back to default order on invalid order value", () => {
    expect(parseUrlState(new URLSearchParams("sort=name&order=bogus")).order).toBe(
      "asc"
    )
  })

  it("parses empty=1 as emptyOnly=true", () => {
    expect(parseUrlState(new URLSearchParams("empty=1")).emptyOnly).toBe(true)
  })

  it("parses empty=0 as emptyOnly=undefined", () => {
    expect(parseUrlState(new URLSearchParams("empty=0")).emptyOnly).toBeUndefined()
  })

  it("defaults emptyOnly to undefined when missing", () => {
    expect(parseUrlState(new URLSearchParams("")).emptyOnly).toBeUndefined()
  })

  it.each<Period>(["today", "7d", "30d", "90d"])(
    "accepts valid period=%s",
    (period) => {
      expect(
        parseUrlState(new URLSearchParams(`period=${period}`)).period
      ).toBe(period)
    }
  )

  it.each<SortKey>(["recent", "sessions", "name"])(
    "accepts valid sort=%s",
    (sort) => {
      expect(parseUrlState(new URLSearchParams(`sort=${sort}`)).sort).toBe(sort)
    }
  )
})

describe("serializeUrlState", () => {
  it("returns empty string for full defaults", () => {
    expect(
      serializeUrlState({ q: "", period: "any", sort: "recent", order: "desc" })
    ).toBe("")
  })

  it("omits keys that equal defaults", () => {
    expect(
      serializeUrlState({ q: "foo", period: "any", sort: "recent", order: "desc" })
    ).toBe("?q=foo")
    expect(
      serializeUrlState({ q: "", period: "7d", sort: "recent", order: "desc" })
    ).toBe("?period=7d")
  })

  it("omits order when it equals default for the sort key", () => {
    expect(
      serializeUrlState({ q: "", period: "any", sort: "name", order: "asc" })
    ).toBe("?sort=name")
    expect(
      serializeUrlState({ q: "", period: "any", sort: "sessions", order: "desc" })
    ).toBe("?sort=sessions")
  })

  it("includes order when it differs from default for the sort key", () => {
    expect(
      serializeUrlState({ q: "", period: "any", sort: "name", order: "desc" })
    ).toBe("?sort=name&order=desc")
    expect(
      serializeUrlState({ q: "", period: "any", sort: "recent", order: "asc" })
    ).toBe("?order=asc")
  })

  it("emits a stable key order: q, period, sort, order", () => {
    expect(
      serializeUrlState({ q: "x", period: "7d", sort: "name", order: "desc" })
    ).toBe("?q=x&period=7d&sort=name&order=desc")
  })

  it("includes empty when emptyOnly=true", () => {
    expect(
      serializeUrlState({ q: "", period: "any", sort: "recent", order: "desc", emptyOnly: true })
    ).toBe("?empty=1")
  })

  it("omits empty when emptyOnly=false", () => {
    expect(
      serializeUrlState({ q: "foo", period: "any", sort: "recent", order: "desc", emptyOnly: false })
    ).toBe("?q=foo")
  })

  it("trims and skips whitespace-only q", () => {
    expect(
      serializeUrlState({ q: "   ", period: "any", sort: "recent", order: "desc" })
    ).toBe("")
  })

  it("URL-encodes q (URLSearchParams encoding)", () => {
    expect(
      serializeUrlState({ q: "a b", period: "any", sort: "recent", order: "desc" })
    ).toBe("?q=a+b")
  })
})

describe("URL state round-trip", () => {
  it.each([
    { q: "", period: "any", sort: "recent", order: "desc" },
    { q: "foo", period: "7d", sort: "name", order: "asc" },
    { q: "Hello World", period: "30d", sort: "sessions", order: "asc" },
    { q: "x", period: "today", sort: "name", order: "desc" },
    { q: "", period: "any", sort: "recent", order: "desc", emptyOnly: true },
    { q: "test", period: "7d", sort: "sessions", order: "asc", emptyOnly: true },
  ] as const)("serialize → parse round-trips: %o", (state) => {
    const serialized = serializeUrlState(state)
    const params = new URLSearchParams(serialized.replace(/^\?/, ""))
    expect(parseUrlState(params)).toEqual(state)
  })
})
