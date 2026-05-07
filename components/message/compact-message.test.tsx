import { describe, it, expect, vi } from "vitest"
import { render, act } from "@testing-library/react"
import { CompactMessage } from "./compact-message"
import type { SessionMessage } from "@/types/claude"

describe("CompactMessage", () => {
  const mockMessage: SessionMessage = {
    id: "msg-1",
    type: "attachment",
    timestamp: new Date("2024-01-01T00:00:00Z"),
    parentUuid: null,
    raw: { attachment: { type: "hook_success", hookName: "SessionStart" } },
  }

  it("renders without highlight by default", () => {
    const { container } = render(<CompactMessage message={mockMessage} />)
    const el = container.firstChild as HTMLElement
    expect(el.classList.contains("bg-blue-50")).toBe(false)
  })

  it("renders with highlight when isHighlighted", () => {
    const { container } = render(
      <CompactMessage message={mockMessage} isHighlighted={true} />
    )
    const el = container.firstChild as HTMLElement
    expect(el.classList.contains("bg-blue-50")).toBe(true)
  })

  it("clears highlight after 2 seconds", () => {
    vi.useFakeTimers()
    const { container } = render(
      <CompactMessage message={mockMessage} isHighlighted={true} />
    )
    const el = container.firstChild as HTMLElement
    expect(el.classList.contains("bg-blue-50")).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Re-query DOM after React re-render
    const updatedEl = container.firstChild as HTMLElement
    expect(updatedEl.classList.contains("bg-blue-50")).toBe(false)

    vi.useRealTimers()
  })
})
