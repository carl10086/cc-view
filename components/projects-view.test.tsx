import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { ProjectsView } from "./projects-view"
import * as NextNavigation from "next/navigation"
import type { ProjectInfo } from "@/types/claude"

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams("")),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}))

function mockSearchParams(query: string) {
  vi.mocked(NextNavigation.useSearchParams).mockReturnValue(
    new URLSearchParams(query) as any
  )
}

const mockProjects: ProjectInfo[] = [
  {
    id: "1",
    name: "Alpha",
    sessionCount: 5,
    lastModified: new Date(),
    worktrees: [],
  },
  {
    id: "2",
    name: "Beta",
    sessionCount: 3,
    lastModified: new Date(),
    worktrees: [],
  },
]

describe("ProjectsView", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders empty state when filters match nothing", () => {
    mockSearchParams("q=xyz123nothing")
    render(<ProjectsView projects={mockProjects} />)

    expect(screen.getByText("No projects match your filters")).toBeTruthy()
    expect(screen.getByText("Clear filters")).toBeTruthy()
  })
})
