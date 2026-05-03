import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ProjectsToolbar } from "./projects-toolbar"
import * as NextNavigation from "next/navigation"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}))

const replaceMock = vi.fn()

beforeEach(() => {
  replaceMock.mockClear()
  vi.mocked(NextNavigation.useRouter).mockReturnValue({
    replace: replaceMock,
  } as any)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ProjectsToolbar", () => {
  it("debounces search input by 250ms", () => {
    vi.useFakeTimers()
    render(
      <ProjectsToolbar
        urlState={{ q: "", period: "any", sort: "recent", order: "desc" }}
      />
    )

    const input = screen.getByLabelText("Search projects by name")
    fireEvent.change(input, { target: { value: "cc" } })

    expect(replaceMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(249)
    expect(replaceMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith("/projects?q=cc", { scroll: false })

    vi.useRealTimers()
  })

  it("syncs draft when external urlState.q changes", () => {
    const { rerender } = render(
      <ProjectsToolbar
        urlState={{ q: "", period: "any", sort: "recent", order: "desc" }}
      />
    )
    const input = screen.getByLabelText(
      "Search projects by name"
    ) as HTMLInputElement
    expect(input.value).toBe("")

    rerender(
      <ProjectsToolbar
        urlState={{ q: "foo", period: "any", sort: "recent", order: "desc" }}
      />
    )
    expect(input.value).toBe("foo")
  })

  it("resets order to default when sort changes", () => {
    render(
      <ProjectsToolbar
        urlState={{ q: "", period: "any", sort: "recent", order: "desc" }}
      />
    )

    const sortSelect = screen.getByLabelText("Sort projects by")
    fireEvent.change(sortSelect, { target: { value: "name" } })

    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith("/projects?sort=name", {
      scroll: false,
    })
  })
})
